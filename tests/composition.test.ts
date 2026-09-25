/**
 * La composition d'une page.
 *
 * Ce fichier existe a cause d'un defaut reel, trouve en comparant la page
 * recomposee a la page **imprimee** : l'application calculait la taille de
 * police **ligne par ligne**, en amenant l'avance de chaque ligne sur la largeur
 * disponible. Sur les pages ou toutes les lignes sont pleines, c'est juste —
 * c'est meme la justification du papier. Mais une ligne courte y etait
 * **grossie** au lieu d'etre laissee courte, et deux pages le montrent :
 *
 *   - page 604, emplacement 4 : avance 8,822 cadratins contre 15,782 pour les
 *     lignes pleines, soit une taille 1,79 fois trop grande ;
 *   - page 2, derniere ligne : 63,1 pt la ou la hauteur de ligne en vaut 47 —
 *     un debordement sur les lignes voisines.
 *
 * Les nombres de ce fichier ne sont pas inventes : ils viennent du fichier de
 * metriques et de la page imprimee. La confrontation complete est dans
 * `outils/prouver-composition-page.py`.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { LIGNES_PAR_PAGE, PAGES_DU_MOUSHAF } from '../src/constants/theme';
import { avanceDeReference, tailleLigne, taillePolicePage } from '../src/lib/composition';
import { metriquesPage } from '../src/services/mushaf/metriques';

/** Un ecran d'iPhone : 390 pt de large, 763 pt utiles, marges du cadre deduites. */
const LARGEUR_TEXTE = 378;
const HAUTEUR_LIGNE = (763 / LIGNES_PAR_PAGE) * 0.92;

const UPEM_V4 = 2500;

/** Les quinze avances reelles de la page 3, en unites de dessin. */
const PAGE_3 = [
  40464, 40371, 40479, 40586, 40623, 40572, 40865, 40583, 40856, 40600, 41273, 40729, 40909, 40722,
  40673,
];

/** Les six avances reelles de la page 2. */
const PAGE_2 = [25812, 32457, 33343, 31969, 24707, 14985];

/** La formule d'avant, gardee ici pour mesurer ce qu'elle produisait. */
function tailleLigneParLigne(avance: number, upem: number, largeur: number): number {
  return (largeur * upem) / avance;
}

function mediane(valeurs: readonly number[]): number {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 1
    ? triees[milieu]!
    : (triees[milieu - 1]! + triees[milieu]!) / 2;
}

describe('avance de reference', () => {
  test('sur une page ordinaire, c est la mediane — la mesure du calligraphe', () => {
    assert.equal(avanceDeReference(PAGE_3), mediane(PAGE_3));
    assert.equal(avanceDeReference(PAGE_3), 40623);
  });

  test('une ligne aberrante ne tire pas la page a elle seule', () => {
    // Les onze avances reelles de la page 599 : deux emplacements a 49 718 et
    // 50 893 unites, un a 6 782, et une majorite autour de 40 000. Ancrer la
    // page sur le maximum la rapetissait de 10 % tout entiere.
    const page599 = [
      49718, 50893, 6782, 40219, 40416, 40793, 38519, 42963, 40506, 39648, 39688,
    ];
    const reference = avanceDeReference(page599);
    assert.equal(reference, 40416);
    assert.ok(reference < 49718 && reference > 6782);
  });

  test('sans avance exploitable, elle vaut zero plutot que de lever', () => {
    assert.equal(avanceDeReference([]), 0);
    assert.equal(avanceDeReference([0, -1, Number.NaN]), 0);
  });
});

describe('taille de police d une page', () => {
  test('une ligne d avance mediane tombe exactement sur la largeur disponible', () => {
    const avances = [40000, 40500, 41000];
    const taille = taillePolicePage(avances, UPEM_V4, LARGEUR_TEXTE);
    assert.ok(Math.abs((40500 * taille) / UPEM_V4 - LARGEUR_TEXTE) < 0.001);
  });

  test('une ligne courte garde la taille de sa page, elle n est pas grossie', () => {
    // Page 604 : six lignes pleines autour de 15,7 cadratins, trois courtes.
    const pleine = 15.782 * UPEM_V4;
    const courte = 8.822 * UPEM_V4;
    const avances = [pleine, pleine, pleine, pleine, pleine, pleine, courte, courte, courte];
    const page = taillePolicePage(avances, UPEM_V4, LARGEUR_TEXTE);

    const ancienne = tailleLigneParLigne(courte, UPEM_V4, LARGEUR_TEXTE);
    assert.ok(
      ancienne / page > 1.7,
      `l ancienne formule donnait ${(ancienne / page).toFixed(2)} fois la taille de la page`,
    );

    // La nouvelle rend la ligne courte a la taille de sa page.
    assert.equal(tailleLigne(page, courte, UPEM_V4, LARGEUR_TEXTE), page);
  });

  test('la page 2 ne deborde plus de sa hauteur de ligne', () => {
    const derniere = PAGE_2[5]!;

    const ancienne = tailleLigneParLigne(derniere, UPEM_V4, LARGEUR_TEXTE);
    assert.ok(
      ancienne > HAUTEUR_LIGNE,
      `l ancienne formule donnait ${ancienne.toFixed(1)} pt pour une hauteur de ligne de ${HAUTEUR_LIGNE.toFixed(1)} pt`,
    );

    const page = taillePolicePage(PAGE_2, UPEM_V4, LARGEUR_TEXTE);
    assert.ok(
      page < HAUTEUR_LIGNE,
      `la taille de page ${page.toFixed(1)} pt doit tenir dans la ligne`,
    );
    // Et chaque ligne de la page tient aussi.
    for (const avance of PAGE_2) {
      const rendue = tailleLigne(page, avance, UPEM_V4, LARGEUR_TEXTE);
      assert.ok(
        (avance * rendue) / UPEM_V4 <= LARGEUR_TEXTE + 0.001,
        `une ligne rendue a ${rendue.toFixed(1)} pt deborderait`,
      );
    }
  });

  test('une ligne plus longue que la reference est reduite juste assez pour tenir', () => {
    const reference = 16000;
    const trop = 20000;
    const page = taillePolicePage([reference, reference, reference, trop], UPEM_V4, LARGEUR_TEXTE);
    const reduite = tailleLigne(page, trop, UPEM_V4, LARGEUR_TEXTE);
    assert.ok(reduite < page);
    assert.ok(Math.abs((trop * reduite) / UPEM_V4 - LARGEUR_TEXTE) < 0.001);
  });

  test('sans cadratin ni largeur, elle vaut zero', () => {
    assert.equal(taillePolicePage([10000], 0, LARGEUR_TEXTE), 0);
    assert.equal(taillePolicePage([10000], UPEM_V4, 0), 0);
    assert.equal(taillePolicePage([], UPEM_V4, LARGEUR_TEXTE), 0);
    assert.equal(tailleLigne(0, 10000, UPEM_V4, LARGEUR_TEXTE), 0);
  });
});

describe('les 604 pages reelles', () => {
  test('chaque page tient dans sa hauteur de ligne, et reste lisible', () => {
    let pireGrande = 0;
    let pireGrandePage = 0;
    let plusPetite = Infinity;
    let plusPetitePage = 0;

    for (let page = 1; page <= PAGES_DU_MOUSHAF; page += 1) {
      const metriques = metriquesPage(page);
      assert.ok(metriques, `page ${page} absente du fichier`);
      const avances = Object.values(metriques.avances);
      const taille = taillePolicePage(avances, metriques.upem, LARGEUR_TEXTE);

      assert.ok(taille > 0, `page ${page} : taille nulle`);
      if (taille > pireGrande) {
        pireGrande = taille;
        pireGrandePage = page;
      }
      if (taille < plusPetite) {
        plusPetite = taille;
        plusPetitePage = page;
      }
    }

    // Aucune page ne doit deborder de sa ligne — c'est ce que faisait la page 2.
    assert.ok(
      pireGrande < HAUTEUR_LIGNE,
      `page ${pireGrandePage} : ${pireGrande.toFixed(1)} pt pour une hauteur de ligne de ${HAUTEUR_LIGNE.toFixed(1)} pt`,
    );
    // Et aucune ne doit tomber sous un seuil illisible.
    assert.ok(
      plusPetite > 15,
      `page ${plusPetitePage} : ${plusPetite.toFixed(1)} pt, trop petit pour lire`,
    );
  });

  test('aucune ligne ne depasse la largeur disponible', () => {
    for (let page = 1; page <= PAGES_DU_MOUSHAF; page += 1) {
      const metriques = metriquesPage(page)!;
      const avances = Object.values(metriques.avances);
      const taille = taillePolicePage(avances, metriques.upem, LARGEUR_TEXTE);
      for (const [numero, avance] of Object.entries(metriques.avances)) {
        const rendue = tailleLigne(taille, avance, metriques.upem, LARGEUR_TEXTE);
        const largeurRendue = (avance * rendue) / metriques.upem;
        assert.ok(
          largeurRendue <= LARGEUR_TEXTE + 0.001,
          `page ${page} ligne ${numero} : ${largeurRendue.toFixed(1)} pt pour ${LARGEUR_TEXTE} pt`,
        );
      }
    }
  });

  test('la plupart des pages gardent leurs lignes a moins de 10 % de la taille de la page', () => {
    // C'est ce que fait le papier : une seule taille pour les quinze lignes. La
    // reference etant la mediane, la ligne la plus longue est reduite de l'ecart
    // entre le maximum et la mediane — mesure : 2,2 % sur la page 3, et sous
    // 10 % sur 538 pages sur 604. Les pages qui s'en ecartent portent une avance
    // aberrante, et cela vient des donnees, pas de la regle.
    let serrees = 0;
    for (let page = 1; page <= PAGES_DU_MOUSHAF; page += 1) {
      const metriques = metriquesPage(page)!;
      const avances = Object.values(metriques.avances);
      const taille = taillePolicePage(avances, metriques.upem, LARGEUR_TEXTE);
      const toutesProches = avances.every(
        (avance) =>
          tailleLigne(taille, avance, metriques.upem, LARGEUR_TEXTE) >= taille * 0.9,
      );
      if (toutesProches) {
        serrees += 1;
      }
    }
    assert.ok(serrees > 520, `seulement ${serrees} pages a taille resserree`);
  });
});
