/**
 * Emet, en JSON, la composition que l'application calcule pour une liste de pages.
 *
 * Sert a la preuve hors application (`prouver-composition-page.py`) : celle-ci a
 * besoin des tailles de police et de l'avance de reference, et les recalculer en
 * Python ferait deux sources pour une meme verite. Elles finiraient par diverger,
 * et la preuve validerait alors une regle qui n'est plus celle de l'application.
 *
 * Usage : node --import ./outils/enregistrer-tests.mjs outils/tailles-pages.mjs 3 604
 */

import { avanceDeReference, tailleLigne, taillePolicePage } from '../src/lib/composition.ts';
import { metriquesPage } from '../src/services/mushaf/metriques.ts';

const LARGEUR = Number(process.env.LARGEUR_TEXTE ?? 378);

/**
 * `REGLE=par-ligne` rejoue l'ancienne formule — une taille par ligne, chaque
 * avance amenee sur la largeur. Ce n'est pas une option de l'application : c'est
 * de quoi eprouver la preuve elle-meme, en lui donnant la composition fautive.
 * Un controle qui ne sait pas echouer ne prouve rien.
 */
const PAR_LIGNE = process.env.REGLE === 'par-ligne';

const pages = process.argv.slice(2).map(Number).filter(Number.isInteger);
if (pages.length === 0) {
  process.stderr.write('Aucune page demandee.\n');
  process.exit(2);
}

const sortie = {};
for (const page of pages) {
  const metriques = metriquesPage(page);
  if (!metriques) {
    sortie[page] = null;
    continue;
  }
  const avances = Object.values(metriques.avances);
  const taille = taillePolicePage(avances, metriques.upem, LARGEUR);
  sortie[page] = {
    edition: metriques.edition,
    upem: metriques.upem,
    largeur: LARGEUR,
    reference: avanceDeReference(avances),
    taille,
    lignes: Object.fromEntries(
      Object.entries(metriques.avances)
        .map(([numero, avance]) => [
          numero,
          {
            avance,
            taille: PAR_LIGNE
              ? (LARGEUR * metriques.upem) / avance
              : tailleLigne(taille, avance, metriques.upem, LARGEUR),
          },
        ])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ),
  };
}

process.stdout.write(`${JSON.stringify(sortie)}\n`);
