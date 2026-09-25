/**
 * La table des 30 juz.
 *
 * Ce fichier existe parce qu'une deduction etait **fausse**. Le juz d'une page
 * est porte par son premier verset, alors qu'un juz peut commencer au milieu
 * d'une page : la page 121 contient 5:77 a 5:82, et 5:82 ouvre le juz 7. Deduire
 * le debut du juz de la premiere page ou il apparait donnait 122 — huit versets
 * trop loin. Le meme ecart existait pour les juz 4, 11 et 26 : quatre juz sur
 * trente ouvraient au mauvais endroit.
 *
 * Les valeurs attendues ci-dessous viennent de `/juzs`, la source officielle, et
 * sont figees : ce sont elles qui empechent la deduction fausse de revenir.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { PAGES_DU_MOUSHAF } from '../src/constants/theme';
import { chargerJuz } from '../src/services/mushaf/juz';
import { metriquesPage } from '../src/services/mushaf/metriques';

const JUZ = chargerJuz();

describe('forme de la table', () => {
  test('contient les 30 juz, numerotes de 1 a 30 dans l ordre', () => {
    assert.equal(JUZ.length, 30);
    assert.deepEqual(
      JUZ.map((j) => j.numero),
      Array.from({ length: 30 }, (_, indice) => indice + 1),
    );
  });

  test('chaque entree porte une page valide et un premier verset bien forme', () => {
    for (const juz of JUZ) {
      assert.ok(
        Number.isInteger(juz.page) && juz.page >= 1 && juz.page <= PAGES_DU_MOUSHAF,
        `page invalide pour le juz ${juz.numero} : ${juz.page}`,
      );
      assert.match(juz.premierVerset, /^\d{1,3}:\d{1,3}$/, `premier verset du juz ${juz.numero}`);
    }
  });

  test('les pages de debut sont strictement croissantes', () => {
    for (let indice = 1; indice < JUZ.length; indice += 1) {
      assert.ok(
        JUZ[indice].page > JUZ[indice - 1].page,
        `le juz ${JUZ[indice].numero} commence page ${JUZ[indice].page}, avant le juz ${JUZ[indice - 1].numero}`,
      );
    }
  });

  test('le premier juz commence page 1', () => {
    assert.equal(JUZ[0].page, 1);
    assert.equal(JUZ[0].premierVerset, '1:1');
  });
});

describe('les pages que la deduction avait faussees', () => {
  // Ces quatre valeurs sont le coeur du fichier : ce sont exactement les juz que
  // la deduction a partir des metriques plaçait une page trop loin.
  const ATTENDU: Readonly<Record<number, number>> = {
    4: 62,
    7: 121,
    11: 201,
    26: 502,
  };

  for (const [numero, page] of Object.entries(ATTENDU)) {
    test(`le juz ${numero} commence page ${page}`, () => {
      const juz = JUZ.find((j) => j.numero === Number(numero));
      assert.ok(juz, `juz ${numero} absent de la table`);
      assert.equal(juz.page, page);
    });
  }

  test('le juz 7 commence au verset 5:82, qui ouvre bien le juz', () => {
    const juz = JUZ.find((j) => j.numero === 7)!;
    assert.equal(juz.premierVerset, '5:82');
  });

  test('le juz 26 commence au verset 46:1', () => {
    assert.equal(JUZ.find((j) => j.numero === 26)!.premierVerset, '46:1');
  });
});

describe('accord entre la table des juz et les metriques', () => {
  test('la page de debut d un juz s ouvre sur ce juz, ou sur le precedent', () => {
    // Verification croisee entre deux sources independantes, toutes deux issues
    // de l'API : la table `/juzs` et le `juz_number` porte par les versets. Un
    // ecart de plus d'un juz signalerait une table fausse — c'est exactement ce
    // que la deduction produisait.
    for (const juz of JUZ) {
      const metriques = metriquesPage(juz.page);
      assert.ok(metriques, `page ${juz.page} absente des metriques`);
      const ecart = juz.numero - metriques.juz;
      assert.ok(
        ecart === 0 || ecart === 1,
        `juz ${juz.numero} : sa page de debut ${juz.page} est decrite comme le juz ${metriques.juz}`,
      );
    }
  });

  test('le juz 7 illustre le cas : sa page de debut appartient encore au juz 6', () => {
    const juz = JUZ.find((j) => j.numero === 7)!;
    assert.equal(metriquesPage(juz.page)!.juz, 6);
  });
});
