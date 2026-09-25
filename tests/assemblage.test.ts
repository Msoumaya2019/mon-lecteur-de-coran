/**
 * Assemblage d'une page du moushaf, sur des reponses **reelles** de l'API.
 *
 * Les jeux d'essai de `tests/donnees/` sont des reponses capturees le
 * 25 septembre 2026, conservees telles quelles :
 *
 *  - `page-3.json`  : une page ordinaire, servie par l'edition `v4` ;
 *  - `page-121.json` : une des cinq pages que `v4` ne couvre pas, servie par
 *    `v1` — celle ou le juz 7 commence au milieu de la page.
 *
 * C'est le coeur du rendu fidele, et le piege qu'il faut tenir : **les points de
 * code sont locaux a la page**. U+FC41 vaut « قُلْ » page 604 mais « الم » page 2.
 * Prendre les codes d'une page avec la police d'une autre donne un texte arabe
 * parfaitement lisible et entierement faux. Le seul rempart est de choisir le
 * bon champ selon l'edition mesuree — ce que ces tests verifient.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { VersetBrut } from '../src/services/quran/api';
import { assemblerPage } from '../src/services/quran/pages';

const ICI = path.dirname(fileURLToPath(import.meta.url));

/**
 * Lit un jeu d'essai capture.
 *
 * `JSON.parse` rend `any` : c'est le seul endroit ou le typage est affirme
 * plutot que verifie. L'affirmation porte sur le type de l'application, et non
 * sur une copie locale, pour qu'un changement de forme des reponses de l'API
 * fasse echouer ce fichier des la compilation.
 */
function jeu(nom: string): readonly VersetBrut[] {
  const brut = readFileSync(path.join(ICI, 'donnees', nom), 'utf8');
  const sansBom = brut.charCodeAt(0) === 0xfeff ? brut.slice(1) : brut;
  return (JSON.parse(sansBom) as { verses: VersetBrut[] }).verses;
}

/** Tous les codes d'un jeu d'essai, pour une edition donnee. */
function codesDuJeu(
  versets: readonly VersetBrut[],
  champ: 'code_v1' | 'code_v2',
): ReadonlySet<string> {
  const codes = new Set<string>();
  for (const verset of versets) {
    for (const mot of verset.words ?? []) {
      const code = mot[champ];
      if (code) {
        codes.add(code);
      }
    }
  }
  return codes;
}

function nombreDeMots(versets: readonly VersetBrut[]): number {
  return versets.reduce((total, v) => total + (v.words?.length ?? 0), 0);
}

function nombreDeSegments(page: ReturnType<typeof assemblerPage>): number {
  return page.lignes.reduce((total, l) => total + l.segments.length, 0);
}

const JEUX = [
  { page: 3, nom: 'page-3.json', edition: 'v4' as const, champ: 'code_v2' as const },
  { page: 121, nom: 'page-121.json', edition: 'v1' as const, champ: 'code_v1' as const },
];

describe('assemblerPage — invariants communs aux deux editions', () => {
  for (const { page: numero, nom, edition, champ } of JEUX) {
    const versets = jeu(nom);
    const page = assemblerPage(numero, versets);

    test(`page ${numero} : porte son numero et l edition mesuree (${edition})`, () => {
      assert.equal(page.numero, numero);
      assert.equal(page.edition, edition);
      assert.ok(page.upem > 0, 'les unites par cadratin doivent etre renseignees');
    });

    test(`page ${numero} : ne perd aucun mot`, () => {
      assert.equal(nombreDeSegments(page), nombreDeMots(versets));
    });

    test(`page ${numero} : les lignes sont croissantes et dans les 15 du moushaf`, () => {
      const numeros = page.lignes.map((l) => l.numero);
      assert.deepEqual(numeros, [...numeros].sort((a, b) => a - b));
      assert.equal(new Set(numeros).size, numeros.length, 'une ligne ne peut apparaitre deux fois');
      for (const ligne of numeros) {
        assert.ok(ligne >= 1 && ligne <= 15, `ligne ${ligne} hors des 15 lignes du moushaf`);
      }
    });

    test(`page ${numero} : chaque segment porte au moins un run sans espace`, () => {
      for (const ligne of page.lignes) {
        for (const segment of ligne.segments) {
          assert.ok(segment.runs.length > 0, `segment sans run : ${JSON.stringify(segment)}`);
          for (const run of segment.runs) {
            assert.ok(run.length > 0, 'un run ne peut pas etre vide');
            assert.ok(!run.includes(' '), `un run ne peut pas contenir d espace : ${JSON.stringify(run)}`);
          }
        }
      }
    });

    test(`page ${numero} : chaque segment appartient a un verset de la page`, () => {
      const cles = new Set(page.versets.map((v) => v.cle));
      for (const ligne of page.lignes) {
        for (const segment of ligne.segments) {
          assert.ok(cles.has(segment.verset), `verset inconnu : ${segment.verset}`);
        }
      }
    });

    test(`page ${numero} : les lignes annoncees par un verset sont exactement celles qui le portent`, () => {
      for (const verset of page.versets) {
        const reelles = page.lignes
          .filter((l) => l.segments.some((s) => s.verset === verset.cle))
          .map((l) => l.numero);
        assert.deepEqual(verset.lignes, reelles, `lignes de ${verset.cle}`);
        assert.ok(verset.lignes.length > 0, `${verset.cle} n a aucune ligne`);
      }
    });

    test(`page ${numero} : chaque ligne de texte a une avance mesuree`, () => {
      // C'est de cette avance que se deduit la taille de police qui justifie la
      // ligne. Sans elle, la ligne retombe sur une taille de repli et ne tombe
      // plus juste sur la largeur de la page.
      for (const ligne of page.lignes) {
        const avance = page.avances[ligne.numero];
        assert.ok(
          typeof avance === 'number' && avance > 0,
          `avance absente ou nulle pour la ligne ${ligne.numero}`,
        );
      }
    });

    test(`page ${numero} : le medaillon clot son verset`, () => {
      // Le numero de verset est imprime dans le glyphe du medaillon : il doit
      // rester le dernier segment du verset, sur sa derniere ligne.
      for (const verset of page.versets) {
        const derniere = Math.max(...verset.lignes);
        const ligne = page.lignes.find((l) => l.numero === derniere);
        assert.ok(ligne, `ligne ${derniere} absente`);
        const duVerset = ligne.segments.filter((s) => s.verset === verset.cle);
        const dernier = duVerset[duVerset.length - 1];
        assert.equal(dernier?.type, 'medaillon', `le verset ${verset.cle} ne finit pas par un medaillon`);
      }
    });

    test(`page ${numero} : les medaillons sont tous reconnus`, () => {
      const attendus = versets.reduce(
        (total, v) => total + (v.words ?? []).filter((m) => m.char_type_name === 'end').length,
        0,
      );
      const obtenus = page.lignes.reduce(
        (total, l) => total + l.segments.filter((s) => s.type === 'medaillon').length,
        0,
      );
      assert.ok(attendus > 0, 'le jeu d essai doit contenir des medaillons');
      assert.equal(obtenus, attendus);
    });

    test(`page ${numero} : les positions des mots sont conservees`, () => {
      for (const verset of page.versets) {
        const positions = page.lignes
          .flatMap((l) => l.segments)
          .filter((s) => s.verset === verset.cle)
          .map((s) => s.position);
        const attendues = versets
          .find((v) => v.verse_key === verset.cle)!
          .words!.map((m) => m.position);
        assert.deepEqual(positions, attendues, `positions de ${verset.cle}`);
      }
    });

    test(`page ${numero} : la traduction est absente quand elle n est pas demandee`, () => {
      for (const verset of page.versets) {
        assert.equal(verset.traduction, null);
      }
    });

    test(`page ${numero} : les codes employes sont ceux de l edition ${edition}`, () => {
      const attendus = codesDuJeu(versets, champ);
      for (const ligne of page.lignes) {
        for (const segment of ligne.segments) {
          assert.ok(
            attendus.has(segment.code),
            `code etranger a l edition ${edition} : ${JSON.stringify(segment.code)}`,
          );
        }
      }
    });
  }
});

describe('assemblerPage — le choix d edition est bien porteur', () => {
  test('page 121 : les codes v1 et v2 sont disjoints, donc le basculement compte', () => {
    // Si les deux editions partageaient des codes, choisir l'une ou l'autre
    // serait sans consequence. Mesure : sur cette page, ils sont entierement
    // disjoints — 116 codes de chaque cote, aucun commun.
    const versets = jeu('page-121.json');
    const v1 = codesDuJeu(versets, 'code_v1');
    const v2 = codesDuJeu(versets, 'code_v2');
    assert.ok(v1.size > 0 && v2.size > 0);
    for (const code of v1) {
      assert.ok(!v2.has(code), `code commun aux deux editions : ${JSON.stringify(code)}`);
    }
  });

  test('page 121 : aucun segment ne prend un code de code_v2', () => {
    const versets = jeu('page-121.json');
    const v2 = codesDuJeu(versets, 'code_v2');
    const page = assemblerPage(121, versets);
    for (const ligne of page.lignes) {
      for (const segment of ligne.segments) {
        assert.ok(
          !v2.has(segment.code),
          `la page est en v1, mais ce code vient de code_v2 : ${JSON.stringify(segment.code)}`,
        );
      }
    }
  });
});

describe('assemblerPage — donnees de page', () => {
  test('reprend le juz et le hizb du premier verset', () => {
    const versets = jeu('page-121.json');
    const page = assemblerPage(121, versets);
    // La page 121 commence dans le juz 6, et voit le juz 7 commencer en 5:82 :
    // c'est bien le juz du **premier** verset qui decrit la page.
    assert.equal(page.juz, versets[0].juz_number);
    assert.equal(page.hizb, versets[0].hizb_number);
    assert.equal(page.juz, 6);
  });

  test('survit a une page vide sans lever', () => {
    const page = assemblerPage(7, []);
    assert.equal(page.numero, 7);
    assert.equal(page.lignes.length, 0);
    assert.equal(page.versets.length, 0);
    assert.ok(page.edition === 'v4' || page.edition === 'v1');
  });
});
