/**
 * Temoin du harnais.
 *
 * Ce fichier n'eprouve pas l'application : il eprouve le **harnais**. Il touche
 * les trois cas que le chargeur doit resoudre — alias `@/`, module JSON, module
 * natif remplace — de sorte qu'une panne du harnais se voie ici, en une seconde,
 * plutot que de faire accuser le code de l'application.
 *
 * Il a une seconde raison d'etre : si le motif de fichiers ne designait plus
 * rien, `node --test` sortirait en 0 sans avoir rien joue. Les quatre tests
 * ci-dessous sont donc aussi un compteur.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { codeAudio } from '../src/lib/verset';
import { chargerJuz } from '../src/services/mushaf/juz';
import { nombreDePagesCouvertes } from '../src/services/mushaf/metriques';
import { ecrireCache, lireCache } from '../src/services/storage/cache';

test('un module source est depouille et charge', () => {
  assert.equal(codeAudio('2:255'), '002255');
});

test('un alias @/ vers un module TypeScript est resolu', () => {
  assert.equal(nombreDePagesCouvertes(), 604);
});

test('un module JSON est importe malgre l absence d assertion de type', () => {
  assert.equal(chargerJuz().length, 30);
});

test('le module natif AsyncStorage est remplace', async () => {
  await ecrireCache('mlc:temoin', { vu: true });
  assert.deepEqual(await lireCache('mlc:temoin'), { vu: true });
});
