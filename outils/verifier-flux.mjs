#!/usr/bin/env node
/**
 * Vérifie les flux de travail GitHub Actions avant de les pousser.
 *
 * Un flux ne se teste normalement qu'en le poussant, et c'est le pire moment
 * pour découvrir une virgule : sur ce projet, la compilation Android installe
 * Java, le SDK et les dépendances avant d'échouer — vingt minutes pour rien.
 *
 * ── PORTÉE : CE QUE CE CONTRÔLE ATTRAPE ──────────────────────────────────────
 *
 *   [yaml-invalide]              le fichier n'est pas analysable
 *   [flux-absent]                un flux attendu manque dans le dossier
 *   [flux-non-declare]           un flux du dossier n'est pas dans la liste
 *   [declencheur-absent]         `on:` manquant, ou lu comme un booléen
 *   [travaux-absents]            pas de bloc `jobs:`
 *   [runs-on-absent]             un travail sans exécuteur
 *   [etapes-absentes]            un travail sans étape
 *   [etape-vide]                 une étape sans `uses` ni `run`
 *   [action-non-epinglee]        `uses:` sans `@vN`
 *   [permissions-absentes]       ni à la racine, ni sur le travail
 *   [permission-insuffisante]    `gh release create` sans `contents: write`
 *   [expression-malfermee]       `${{` et `}}` en nombre inégal
 *   [script-invalide]            `bash -n` refuse le `run:`
 *   [sortie-inconnue]            `steps.X.outputs.Y` : aucune étape `X`
 *   [sortie-avant-producteur]    `steps.X.outputs.Y` : `X` est définie plus bas
 *   [sortie-non-declaree]        `steps.X.outputs.Y` : `X` n'écrit pas `Y`
 *   [run-agrege-sans-garde]      plusieurs contrôles dans un `run:` sans `|| code=1`
 *   [run-agrege-sans-verdict]    … et sans `exit "$code"` final
 *
 * ── PORTÉE : CE QUE CE CONTRÔLE NE VOIT PAS ─────────────────────────────────
 *
 *   - `bash -n` analyse SANS évaluer les expansions. Un `${CHEMIN}` mal
 *     orthographié, un `$GITHUB_OUTPUT` mal écrit, une substitution fautive
 *     passent : mesuré, `echo ${a b}` et `echo ${}` sont tous deux acceptés
 *     par `bash -n` et refusés à l'exécution (« bad substitution »). Ce
 *     contrôle attrape une structure — `then` manquant, `fi` orphelin, quote
 *     non fermée — jamais une valeur ;
 *   - une version d'action qui existe mais dont le moteur est déprécié. Le
 *     moteur se lit dans le manifeste de l'action, pas dans le YAML ;
 *   - tout ce qui se décide à l'exécution : une commande qui échoue au milieu
 *     d'un `run:`, un exécuteur sans le bon Xcode, un quota épuisé.
 *
 * La neutralisation des `${{ … }}` avant `bash -n` n'existe pas pour éviter un
 * faux positif — `bash -n` les tolère très bien. Elle existe pour la fidélité :
 * c'est le texte substitué que le shell recevra, et c'est celui-là qu'un
 * contrôle portant sur le *contenu* d'un script doit juger.
 *
 * Usage : node outils/verifier-flux.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parse } from 'yaml';

// `FLUX_DOSSIER` n'existe que pour le banc d'épreuve, qui doit juger des flux
// fabriqués — la liste fermée et la règle des permissions ne s'éprouvent pas
// autrement. La chaîne de vérification ne définit jamais cette variable.
const DOSSIER =
  process.env.FLUX_DOSSIER ?? fileURLToPath(new URL('../.github/workflows', import.meta.url));

/**
 * Liste FERMÉE. Ce contrôle est le seul lecteur de `.github/workflows` : rien
 * d'autre dans la chaîne ne verrait disparaître un flux, pas même `tsc`. Un
 * `readdir` mesure donc ce qui RESTE, jamais ce qui MANQUE — et un flux écarté
 * produirait un rapport vert.
 *
 * Déclarer un flux nouveau est le prix à payer, et il est utile : il force à se
 * demander si le flux doit tourner à chaque poussée ou seulement sur demande.
 */
const FLUX_ATTENDUS = ['android-apk.yml', 'ci.yml', 'eas-build.yml', 'ios-unsigned.yml'];

/**
 * Commandes qui, dans un `run:`, comptent comme un contrôle à part entière.
 *
 * La fin de ligne est une frontière valide autant que l'espace : `npm test`
 * écrit seul sur sa ligne ne se termine par aucun blanc. Mesuré par le banc —
 * sans le `|$`, une ligne `npm test` n'était pas reconnue, le compte tombait à
 * un, et la règle du verdict agrégé ne se déclenchait pas.
 */
const COMMANDE_DE_CONTROLE = /(^|\s)(npm run|npm test|node|npx|python3?)(\s|$)/;

const MARQUEURS = {
  'yaml-invalide': '[yaml-invalide]',
  'flux-absent': '[flux-absent]',
  'flux-non-declare': '[flux-non-declare]',
  'declencheur-absent': '[declencheur-absent]',
  'travaux-absents': '[travaux-absents]',
  'runs-on-absent': '[runs-on-absent]',
  'etapes-absentes': '[etapes-absentes]',
  'etape-vide': '[etape-vide]',
  'action-non-epinglee': '[action-non-epinglee]',
  'permissions-absentes': '[permissions-absentes]',
  'permission-insuffisante': '[permission-insuffisante]',
  'expression-malfermee': '[expression-malfermee]',
  'script-invalide': '[script-invalide]',
  'sortie-inconnue': '[sortie-inconnue]',
  'sortie-avant-producteur': '[sortie-avant-producteur]',
  'sortie-non-declaree': '[sortie-non-declaree]',
  'run-agrege-sans-garde': '[run-agrege-sans-garde]',
  'run-agrege-sans-verdict': '[run-agrege-sans-verdict]',
};

let verifications = 0;
const defauts = [];

/** Enregistre une vérification, et le défaut correspondant si elle échoue. */
function verifier(condition, marqueur, fichier, etape, message) {
  verifications += 1;
  if (!condition) {
    defauts.push({ marqueur: MARQUEURS[marqueur], fichier, etape, message });
  }
  return condition;
}

const libelle = (fichier, etape) => (etape ? `${fichier} › ${etape}` : fichier);

/** Remplace chaque expression GitHub par une chaîne inerte, comme le fera GitHub. */
function neutraliser(script) {
  return script.replace(/\$\{\{[^}]*\}\}/g, 'VALEUR');
}

/** `bash -n` : analyse sans exécuter. Renvoie `null` si le script est valide. */
function refusDeBash(script) {
  const resultat = spawnSync('bash', ['-n'], {
    input: neutraliser(script),
    encoding: 'utf8',
  });
  if (resultat.error) {
    throw new Error(
      `« bash » est introuvable : ce contrôle ne peut pas analyser les scripts (${resultat.error.message}).`,
    );
  }
  if (resultat.status === 0) return null;
  const message = (resultat.stderr || '').trim().split('\n').slice(0, 3).join(' / ');
  return message || 'refusé sans message';
}

/** Les noms de sortie qu'une étape `run:` déclare, ou `null` si on n'a rien pu lire. */
function sortiesDeclarees(script) {
  const noms = new Set();
  for (const ligne of script.split('\n')) {
    const trouve = ligne.match(/(?:echo|printf)\s+["']?([A-Za-z_][A-Za-z0-9_]*)=/);
    if (trouve) noms.add(trouve[1]);
  }
  return noms.size > 0 ? noms : null;
}

/**
 * Une expression `${{ … }}` laissée ouverte.
 *
 * Comparer le NOMBRE de `${{` à celui de `}}` ne marche pas : la chaîne
 * inspectée est du JSON, qui ferme ses propres accolades, et une étape sans
 * aucune expression ressortait avec un `}}` orphelin. Mesuré : 10 faux défauts
 * sur les seules étapes `uses:`. La bonne question est « chaque ouverture
 * trouve-t-elle sa fermeture ? », et elle se pose par recherche, pas par
 * comptage.
 */
function expressionOuverte(texte) {
  const ouvertures = /\$\{\{/g;
  let ouverture = ouvertures.exec(texte);
  while (ouverture !== null) {
    const fermeture = texte.indexOf('}}', ouverture.index + 3);
    if (fermeture < 0) return true;
    ouvertures.lastIndex = fermeture + 2;
    ouverture = ouvertures.exec(texte);
  }
  return false;
}

/** Les identifiants d'étape référencés dans les expressions d'une étape. */
function sortiesReferencees(etape) {
  const brut = JSON.stringify(etape);
  const references = [];
  const motif = /steps\.([A-Za-z_][A-Za-z0-9_-]*)\.outputs\.([A-Za-z_][A-Za-z0-9_-]*)/g;
  let trouve = motif.exec(brut);
  while (trouve !== null) {
    references.push({ producteur: trouve[1], nom: trouve[2] });
    trouve = motif.exec(brut);
  }
  return references;
}

function analyserFlux(fichier) {
  const chemin = join(DOSSIER, fichier);
  const texte = readFileSync(chemin, 'utf8');

  let flux;
  try {
    flux = parse(texte);
    verifications += 1;
  } catch (erreur) {
    verifications += 1;
    defauts.push({
      marqueur: MARQUEURS['yaml-invalide'],
      fichier,
      etape: '',
      message: `le YAML est refusé par l'analyseur : ${erreur.message.split('\n')[0]}`,
    });
    return;
  }

  if (!verifier(flux !== null && typeof flux === 'object', 'yaml-invalide', fichier, '', 'le fichier est vide ou n\'est pas une table')) {
    return;
  }

  // Le déclencheur. Un analyseur en schéma YAML 1.1 lit `on:` comme `true` et
  // le flux ne se déclencherait jamais. Mesuré sur `yaml@2.9.1` et
  // `js-yaml@4.3.2` : tous deux rendent une chaîne, le piège ne mord pas ici —
  // le contrôle reste, parce que le paquet peut changer.
  verifier(
    Object.hasOwn(flux, 'on') && typeof flux.on !== 'boolean',
    'declencheur-absent',
    fichier,
    '',
    'le déclencheur `on:` est absent, ou lu comme un booléen',
  );

  if (!verifier(flux.jobs !== null && typeof flux.jobs === 'object', 'travaux-absents', fichier, '', 'aucun bloc `jobs:`')) {
    return;
  }

  const permissionsRacine = flux.permissions;
  verifier(
    permissionsRacine !== undefined,
    'permissions-absentes',
    fichier,
    '',
    'aucun `permissions:` à la racine : le jeton reçoit les droits par défaut',
  );

  for (const [nomJob, job] of Object.entries(flux.jobs)) {
    const ou = libelle(fichier, nomJob);
    if (!verifier(job !== null && typeof job === 'object', 'travaux-absents', fichier, nomJob, 'le travail n\'est pas une table')) {
      continue;
    }

    verifier(typeof job['runs-on'] === 'string', 'runs-on-absent', fichier, nomJob, 'le travail ne déclare pas `runs-on:`');

    // Un `permissions:` de travail REMPLACE celui de la racine : il ne s'y
    // ajoute pas. C'est la sémantique qui rend un job incapable de publier
    // alors que la racine l'y autorise.
    const permissionsEffectives = job.permissions ?? permissionsRacine;
    const droitEcriture =
      permissionsEffectives === 'write-all' ||
      (permissionsEffectives !== null &&
        typeof permissionsEffectives === 'object' &&
        permissionsEffectives.contents === 'write');

    if (!verifier(Array.isArray(job.steps) && job.steps.length > 0, 'etapes-absentes', fichier, nomJob, 'le travail n\'a aucune étape')) {
      continue;
    }

    const identifiants = job.steps.map((etape, rang) => ({ id: etape?.id, rang }));
    const producteurs = new Map();
    for (const { id, rang } of identifiants) {
      if (typeof id === 'string') producteurs.set(id, rang);
    }

    job.steps.forEach((etape, rang) => {
      const nomEtape = typeof etape?.name === 'string' ? etape.name : `étape ${rang + 1}`;
      const ouEtape = libelle(fichier, `${nomJob} › ${nomEtape}`);

      if (!verifier(etape !== null && typeof etape === 'object', 'etape-vide', fichier, `${nomJob} › ${nomEtape}`, 'l\'étape n\'est pas une table')) {
        return;
      }

      // Les expressions se vérifient pour TOUTES les étapes, y compris celles
      // qui ne portent qu'un `uses:` — c'est précisément là que se cachent les
      // `retention-days: ${{ inputs.x }}` fautifs. Les enfermer dans la branche
      // `run:` ci-dessous laisserait ces étapes sans examen.
      const brutEtape = JSON.stringify(etape);
      verifier(
        !expressionOuverte(brutEtape),
        'expression-malfermee',
        fichier,
        `${nomJob} › ${nomEtape}`,
        'une expression « ${{ » n\'est jamais refermée par « }} »',
      );

      // Une sortie référencée doit être ÉCRITE par son producteur, et pas
      // seulement portée par une étape qui existe : `steps.cible.outputs.typo`
      // vaut la chaîne vide à l'exécution, sans que rien ne le signale.
      for (const { producteur, nom } of sortiesReferencees(etape)) {
        if (!producteurs.has(producteur)) {
          verifier(false, 'sortie-inconnue', fichier, `${nomJob} › ${nomEtape}`, `aucune étape ne porte l'identifiant « ${producteur} »`);
          continue;
        }
        if (producteurs.get(producteur) >= rang) {
          verifier(false, 'sortie-avant-producteur', fichier, `${nomJob} › ${nomEtape}`, `l'étape « ${producteur} » est définie plus bas`);
          continue;
        }
        const ecrites = sortiesDeclarees(job.steps[producteurs.get(producteur)]?.run ?? '');
        if (ecrites !== null) {
          verifier(
            ecrites.has(nom),
            'sortie-non-declaree',
            fichier,
            `${nomJob} › ${nomEtape}`,
            `l'étape « ${producteur} » n'écrit pas la sortie « ${nom} » (elle écrit : ${[...ecrites].join(', ')})`,
          );
        }
      }

      if (typeof etape.uses === 'string') {
        const action = etape.uses;
        verifier(
          action.startsWith('./') || action.includes('@'),
          'action-non-epinglee',
          fichier,
          `${nomJob} › ${nomEtape}`,
          `l'action « ${action} » n'est pas épinglée : elle peut changer sans qu'aucune ligne du dépôt ne bouge`,
        );
        return;
      }

      if (typeof etape.run !== 'string') {
        verifier(false, 'etape-vide', fichier, `${nomJob} › ${nomEtape}`, 'l\'étape n\'a ni `uses:` ni `run:`');
        return;
      }

      const refus = refusDeBash(etape.run);
      verifications += 1;
      if (refus !== null) {
        defauts.push({
          marqueur: MARQUEURS['script-invalide'],
          fichier,
          etape: `${nomJob} › ${nomEtape}`,
          message: `« bash -n » refuse le script : ${refus}`,
        });
      }

      if (/gh\s+release\s+create/.test(etape.run)) {
        verifier(
          droitEcriture,
          'permission-insuffisante',
          fichier,
          `${nomJob} › ${nomEtape}`,
          '`gh release create` écrit dans les publications du dépôt : il exige `contents: write`',
        );
      }

      verifierRunAgrege(fichier, `${nomJob} › ${nomEtape}`, etape.run);
    });
  }
}

/**
 * Un `run:` qui enchaîne plusieurs contrôles doit les exécuter TOUS. Le shell
 * par défaut est `bash -e` : la première commande en échec termine le script, et
 * les suivantes ne tournent jamais. Le pas est déjà rouge, donc personne ne
 * regarde, et le second contrôle devient invisible.
 *
 * La forme qui garde le verdict agrégé est `|| code=1` par commande, puis
 * `exit "$code"` en dernière ligne. Ce projet utilise des étapes séparées, qui
 * n'ont pas ce défaut — la règle protège les réécritures futures, et le rapport
 * dit combien de `run:` agrégés elle a examinés.
 */
function verifierRunAgrege(fichier, etape, script) {
  const lignes = script
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== '' && !ligne.startsWith('#'));

  const commandes = lignes.filter((ligne) => COMMANDE_DE_CONTROLE.test(ligne));
  if (commandes.length < 2) return;

  verifications += 1;
  const sansGarde = commandes.filter((ligne) => !ligne.includes('|| code=1'));
  if (sansGarde.length > 0) {
    defauts.push({
      marqueur: MARQUEURS['run-agrege-sans-garde'],
      fichier,
      etape,
      message: `${commandes.length} contrôles dans un même \`run:\`, dont ${sansGarde.length} sans « || code=1 » — sous « bash -e », l'échec du premier supprimerait les suivants`,
    });
  }

  verifications += 1;
  if (lignes.at(-1) !== 'exit "$code"') {
    defauts.push({
      marqueur: MARQUEURS['run-agrege-sans-verdict'],
      fichier,
      etape,
      message: 'un `run:` agrégé doit finir par `exit "$code"`, sinon le verdict de la dernière commande décide seul',
    });
  }
}

// ── La liste fermée, dans les deux sens ──────────────────────────────────────

const fichiers = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith('.yml') || nom.endsWith('.yaml'))
  .sort(); // readdirSync ne garantit aucun ordre : trier rend les messages comparables.

for (const nom of FLUX_ATTENDUS) {
  verifier(
    fichiers.includes(nom),
    'flux-absent',
    nom,
    '',
    'flux attendu absent du dossier — le contrôle est le seul à lire `.github/workflows`, sa disparition ne produirait aucun autre signal',
  );
}

for (const nom of fichiers) {
  verifier(
    FLUX_ATTENDUS.includes(nom),
    'flux-non-declare',
    nom,
    '',
    'flux présent dans le dossier mais absent de FLUX_ATTENDUS : le déclarer, en se demandant s\'il doit tourner à chaque poussée',
  );
}

for (const nom of fichiers) analyserFlux(nom);

// ── Rapport ─────────────────────────────────────────────────────────────────

if (defauts.length === 0) {
  console.log(
    `${fichiers.length} flux analysé(s), ${verifications} vérification(s) — aucun défaut.`,
  );
  console.log('Portée : structure et syntaxe seulement. Aucune expansion n\'est évaluée.');
  process.exit(0);
}

console.error(`${defauts.length} défaut(s) sur ${fichiers.length} flux, ${verifications} vérification(s) :\n`);
for (const { marqueur, fichier, etape, message } of defauts) {
  console.error(`  ${marqueur} ${libelle(fichier, etape)}\n      ${message}`);
}
console.error('\nCorriger, puis relancer : node outils/verifier-flux.mjs');
process.exit(1);
