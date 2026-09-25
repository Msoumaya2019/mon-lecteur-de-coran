/**
 * Protocole de l'API : gabarit audio et champs demandes.
 *
 * Le gabarit audio merite des tests parce qu'il est **derive** et non ecrit en
 * dur : les recitateurs ne partagent ni le meme hote ni la meme arborescence
 * (mesure du 25 septembre 2026). Une erreur de derivation ne se verrait pas —
 * l'audio se lancerait, simplement sur le mauvais verset.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { codeAudio } from '../src/lib/verset';
import { CHAMPS_MOT, normaliserGabarit } from '../src/services/quran/api';

describe('normaliserGabarit', () => {
  test('rend absolue une URL relative au protocole', () => {
    // Cas reel : Al-Husary sert depuis un autre hote, et l'API rend une URL en
    // « // ». Sans ce traitement, le lecteur recevrait une URL sans protocole.
    assert.equal(
      normaliserGabarit('//mirrors.quranicaudio.com/everyayah/Husary_64kbps/001001.mp3'),
      'https://mirrors.quranicaudio.com/everyayah/Husary_64kbps/{code}.mp3',
    );
  });

  test('complete un chemin nu avec l hote de verses.quran.com', () => {
    assert.equal(
      normaliserGabarit('Alafasy/mp3/001001.mp3'),
      'https://verses.quran.com/Alafasy/mp3/{code}.mp3',
    );
    assert.equal(
      normaliserGabarit('/Alafasy/mp3/001001.mp3'),
      'https://verses.quran.com/Alafasy/mp3/{code}.mp3',
    );
  });

  test('laisse intacte une URL deja absolue', () => {
    assert.equal(
      normaliserGabarit('https://verses.quran.com/Alafasy/mp3/001001.mp3'),
      'https://verses.quran.com/Alafasy/mp3/{code}.mp3',
    );
  });

  test('le gabarit substitue donne bien l URL d un verset', () => {
    const gabarit = normaliserGabarit(
      '//mirrors.quranicaudio.com/everyayah/Husary_64kbps/001001.mp3',
    );
    assert.equal(
      gabarit.replace('{code}', codeAudio('2:255')),
      'https://mirrors.quranicaudio.com/everyayah/Husary_64kbps/002255.mp3',
    );
  });

  test('remplace la derniere occurrence, celle du nom de fichier', () => {
    assert.equal(
      normaliserGabarit('https://x/001001/001001.mp3'),
      'https://x/001001/{code}.mp3',
    );
  });

  test('leve si l ancre est absente, plutot que de rendre un gabarit inchange', () => {
    // Sans ce refus, le gabarit resterait tel quel et **chaque verset jouerait
    // la recitation de 1:1** : un defaut silencieux, puisque l'audio se
    // lancerait quand meme.
    assert.throws(() => normaliserGabarit('https://verses.quran.com/Alafasy/mp3/002255.mp3'));
    assert.throws(() => normaliserGabarit('https://verses.quran.com/Alafasy/mp3/'));
  });

  test('l ancre est exactement le code de 1:1', () => {
    assert.equal(normaliserGabarit('https://x/001001.mp3'), 'https://x/{code}.mp3');
  });
});

describe('CHAMPS_MOT', () => {
  test('demande les deux codes du moushaf', () => {
    // `code_v2` sert les 599 pages de l'edition v4, `code_v1` les cinq pages que
    // v4 ne couvre pas. En oublier un rendrait ces cinq pages illisibles.
    assert.ok(CHAMPS_MOT.includes('code_v2'));
    assert.ok(CHAMPS_MOT.includes('code_v1'));
  });

  test('demande le numero de ligne, sans lequel il n y a pas de moushaf', () => {
    // Sans `line_number`, les mots ne se regroupent pas en 15 lignes : on
    // retombe sur une liste de versets, ce que le projet refuse.
    assert.ok(CHAMPS_MOT.includes('line_number'));
  });

  test('demande le type de segment, pour distinguer les medaillons', () => {
    assert.ok(CHAMPS_MOT.includes('char_type_name'));
  });
});
