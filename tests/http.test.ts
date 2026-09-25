/**
 * Acces reseau : construction d'URL et lecture de corps JSON.
 *
 * Rien ici ne touche au reseau : ce sont les deux morceaux purs de `http.ts`,
 * precisement ceux dont une erreur se paie ailleurs — une URL mal composee fait
 * echouer une requete, un BOM mal digere rend une page muette.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ErreurReseau,
  analyserJson,
  construireUrl,
  messageErreur,
} from '../src/services/http';

describe('analyserJson', () => {
  test('lit un corps JSON ordinaire', () => {
    assert.deepEqual(analyserJson('{"a":1}'), { a: 1 });
  });

  test('lit un corps precede d un BOM', () => {
    assert.deepEqual(analyserJson('\uFEFF{"a":1}'), { a: 1 });
  });

  test('la tolerance n est pas decorative : JSON.parse refuse ce meme corps', () => {
    // C'est la raison d'etre de `analyserJson`. Si ce test se met a passer, la
    // tolerance est devenue inutile — mais elle ne coute rien.
    assert.throws(() => JSON.parse('\uFEFF{"a":1}'));
  });
});

describe('construireUrl', () => {
  test('ajoute les parametres renseignes', () => {
    assert.equal(construireUrl('https://x/y', { a: 1 }), 'https://x/y?a=1');
  });

  test('omet les parametres absents ou vides', () => {
    assert.equal(
      construireUrl('https://x/y', { a: undefined, b: null, c: '', d: true }),
      'https://x/y?d=true',
    );
  });

  test('n ajoute rien quand tout est vide', () => {
    assert.equal(construireUrl('https://x/y', { a: undefined }), 'https://x/y');
    assert.equal(construireUrl('https://x/y'), 'https://x/y');
  });

  test('respecte une chaine de requete deja presente', () => {
    assert.equal(construireUrl('https://x/y?z=1', { a: 1 }), 'https://x/y?z=1&a=1');
  });

  test('encode les valeurs et les noms de parametre', () => {
    assert.equal(construireUrl('https://x/y', { q: 'a b' }), 'https://x/y?q=a%20b');
    assert.equal(construireUrl('https://x/y', { 'a b': 1 }), 'https://x/y?a%20b=1');
  });
});

describe('messageErreur', () => {
  test('rend le message d une erreur reseau', () => {
    assert.equal(
      messageErreur(new ErreurReseau('La connexion est indisponible.')),
      'La connexion est indisponible.',
    );
  });

  test('rend le message d une erreur ordinaire', () => {
    assert.equal(messageErreur(new Error('boum')), 'boum');
  });

  test('rend un message generique pour tout le reste', () => {
    assert.equal(messageErreur('une chaine'), 'Une erreur inattendue est survenue.');
    assert.equal(messageErreur(null), 'Une erreur inattendue est survenue.');
    assert.equal(messageErreur(undefined), 'Une erreur inattendue est survenue.');
  });
});

describe('ErreurReseau', () => {
  test('reste une Error, avec son nom et son statut', () => {
    const erreur = new ErreurReseau('coucou', 404);
    assert.ok(erreur instanceof Error);
    assert.equal(erreur.name, 'ErreurReseau');
    assert.equal(erreur.statut, 404);
  });

  test('le statut est nul quand il n y en a pas', () => {
    assert.equal(new ErreurReseau('coucou').statut, null);
  });
});
