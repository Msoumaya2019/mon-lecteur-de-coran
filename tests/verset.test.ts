/**
 * Les cles de verset, socle de l'audio, du surlignage et des favoris.
 *
 * Ce sont des fonctions pures : elles se verifient sans appareil, et une erreur
 * ici se propagerait partout. D'ou le soin mis sur les cas limites.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  codeAudio,
  composerVerset,
  decomposerVerset,
  enChiffresArabes,
} from '../src/lib/verset';

describe('decomposerVerset', () => {
  test('lit une cle bien formee', () => {
    assert.deepEqual(decomposerVerset('2:255'), { sourate: 2, verset: 255 });
    assert.deepEqual(decomposerVerset('1:1'), { sourate: 1, verset: 1 });
    assert.deepEqual(decomposerVerset('114:6'), { sourate: 114, verset: 6 });
  });

  test('refuse tout ce qui n est pas « sourate:verset »', () => {
    const mauvaises = [
      '',
      '2',
      '2:255:1',
      'a:b',
      '0:1',
      '1:0',
      '-1:2',
      '2:',
      ':5',
      '2:1.5',
      '2:-1',
    ];
    for (const cle of mauvaises) {
      assert.throws(() => decomposerVerset(cle), `« ${cle} » aurait du etre refusee`);
    }
  });
});

describe('composerVerset', () => {
  test('fait l aller-retour avec decomposerVerset', () => {
    for (const cle of ['1:1', '2:255', '9:129', '114:6']) {
      const { sourate, verset } = decomposerVerset(cle);
      assert.equal(composerVerset(sourate, verset), cle);
    }
  });
});

describe('codeAudio', () => {
  test('compose six chiffres, comme les fichiers de l API', () => {
    assert.equal(codeAudio('2:255'), '002255');
    assert.equal(codeAudio('9:129'), '009129');
    assert.equal(codeAudio('114:6'), '114006');
  });

  test('les trois chiffres sont toujours remplis', () => {
    assert.equal(codeAudio('1:1'), '001001');
    assert.equal(codeAudio('10:10'), '010010');
    assert.equal(codeAudio('100:100'), '100100');
  });

  test('« 1:1 » donne exactement l ancre du gabarit audio', () => {
    // Le gabarit d'URL de chaque recitateur est derive en remplacant « 001001 »
    // dans l'URL du premier verset. Si cette valeur changeait, la derivation ne
    // trouverait plus rien et **tous** les recitateurs tomberaient.
    assert.equal(codeAudio('1:1'), '001001');
  });
});

describe('enChiffresArabes', () => {
  test('rend les chiffres arabes orientaux', () => {
    assert.equal(enChiffresArabes(1), '\u0661');
    assert.equal(enChiffresArabes(10), '\u0661\u0660');
    assert.equal(enChiffresArabes(604), '\u0666\u0660\u0664');
  });

  test('conserve les nombres a plusieurs chiffres', () => {
    assert.equal(enChiffresArabes(30).length, 2);
    assert.equal(enChiffresArabes(114).length, 3);
  });
});
