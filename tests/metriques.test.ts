/**
 * Metriques de composition du moushaf.
 *
 * Ce fichier engendre porte deux choses dont depend tout le rendu :
 *
 *  - l'**edition de police** de chaque page. 599 pages sont servies par `v4`,
 *    cinq par `v1` ; le generateur le constate en verifiant chaque point de code
 *    contre la table de la police, et refuse de finir s'il reste un trou ;
 *  - l'**avance** de chaque ligne, en unites de dessin. C'est d'elle que se
 *    deduit la taille de police qui justifie la ligne exactement sur la largeur
 *    disponible.
 *
 * Une page manquante, ou une avance nulle, ne se verrait pas a la compilation :
 * la page s'afficherait simplement mal. D'ou une verification page par page.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { PAGES_DU_MOUSHAF } from '../src/constants/theme';
import {
  metriquesPage,
  nombreDePagesCouvertes,
  pagesEnEditionDeSecours,
} from '../src/services/mushaf/metriques';

/**
 * Cadratin de chaque edition, mesure.
 *
 * Les deux editions viennent de la meme calligraphie mais pas du meme fichier :
 * `v4` est allégée et garde un cadratin de 2500, `v1` en a 2048. La taille de
 * police etant calculee a partir de cette valeur, se tromper d'edition ne
 * decalerait pas seulement la mise en page : la ligne ne tomberait plus juste.
 */
const UPEM_PAR_EDITION: Readonly<Record<string, number>> = {
  v4: 2500,
  v1: 2048,
};

describe('couverture du fichier de metriques', () => {
  test('decrit les 604 pages du moushaf, pas une de moins', () => {
    assert.equal(PAGES_DU_MOUSHAF, 604);
    assert.equal(nombreDePagesCouvertes(), PAGES_DU_MOUSHAF);
  });

  test('les cinq pages de secours sont exactement celles mesurees', () => {
    // L'edition v4 ne fournit pas tous les glyphes de ces cinq pages : le
    // generateur bascule alors sur v1, interrogee avec `code_v1`.
    assert.deepEqual([...pagesEnEditionDeSecours()], [121, 533, 534, 568, 570]);
  });
});

describe('invariants, page par page', () => {
  test('chaque page est decrite, avec son edition et son cadratin', () => {
    for (let page = 1; page <= PAGES_DU_MOUSHAF; page += 1) {
      const metriques = metriquesPage(page);
      assert.ok(metriques, `page ${page} absente du fichier`);

      const upemAttendu = UPEM_PAR_EDITION[metriques.edition];
      assert.ok(upemAttendu, `edition inattendue page ${page} : ${metriques.edition}`);
      assert.equal(metriques.upem, upemAttendu, `cadratin inattendu page ${page}`);
    }
  });

  test('chaque page porte un juz et un hizb dans les bornes', () => {
    for (let page = 1; page <= PAGES_DU_MOUSHAF; page += 1) {
      const metriques = metriquesPage(page)!;
      assert.ok(metriques.juz >= 1 && metriques.juz <= 30, `juz ${metriques.juz} page ${page}`);
      assert.ok(metriques.hizb >= 1 && metriques.hizb <= 60, `hizb ${metriques.hizb} page ${page}`);
    }
  });

  test('chaque page porte au moins une avance, toutes strictement positives', () => {
    for (let page = 1; page <= PAGES_DU_MOUSHAF; page += 1) {
      const metriques = metriquesPage(page)!;
      const lignes = Object.keys(metriques.avances).map(Number);
      assert.ok(lignes.length > 0, `aucune avance page ${page}`);
      for (const ligne of lignes) {
        assert.ok(ligne >= 1 && ligne <= 15, `ligne ${ligne} hors bornes page ${page}`);
        assert.ok(metriques.avances[ligne] > 0, `avance nulle page ${page} ligne ${ligne}`);
      }
    }
  });

  test('aucune page ne prend l edition de secours sans raison', () => {
    const secours = new Set(pagesEnEditionDeSecours());
    for (let page = 1; page <= PAGES_DU_MOUSHAF; page += 1) {
      const metriques = metriquesPage(page)!;
      if (metriques.edition === 'v1') {
        assert.ok(secours.has(page), `page ${page} en v1 alors qu elle n est pas au nombre des pages de secours`);
      }
    }
  });
});

describe('pages hors bornes', () => {
  test('rend null plutot que de lever', () => {
    assert.equal(metriquesPage(0), null);
    assert.equal(metriquesPage(-1), null);
    assert.equal(metriquesPage(605), null);
    assert.equal(metriquesPage(9999), null);
  });
});
