/**
 * Nettoyage et mise en forme des textes venus de l'API.
 *
 * Le cas qui compte : les appels de note de la traduction de Hamidullah. Les
 * afficher tels quels donne un texte illisible ; les retirer sans rien mettre a
 * la place fait disparaitre une information. On verifie donc la marque posee.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { abreger, duree, motsUthmani, nettoyerTraduction } from '../src/lib/texte';

describe('nettoyerTraduction', () => {
  test('remplace un appel de note par une marque discrete', () => {
    assert.equal(
      nettoyerTraduction('Un.<sup foot_note=195250>1</sup>'),
      'Un. \u00b7',
    );
  });

  test('traite plusieurs appels de note', () => {
    assert.equal(
      nettoyerTraduction('a<sup foot_note=1>1</sup>b<sup foot_note=2>2</sup>c'),
      'a \u00b7b \u00b7c',
    );
  });

  test('retire les balises de bloc', () => {
    assert.equal(nettoyerTraduction('<p>Un texte.</p>'), 'Un texte.');
  });

  test('rend les espaces insecables a leur place', () => {
    assert.equal(nettoyerTraduction('«&nbsp;Sois&nbsp;!&nbsp;»'), '« Sois ! »');
  });

  test('desentite les esperluettes', () => {
    assert.equal(nettoyerTraduction('a&amp;b'), 'a&b');
  });

  test('reduit les suites d espaces et de sauts de ligne', () => {
    assert.equal(nettoyerTraduction('  a\n\n  b  '), 'a b');
  });

  test('rend une chaine vide pour une entree vide', () => {
    assert.equal(nettoyerTraduction(''), '');
  });

  test('n invente rien sur un texte sans balise', () => {
    assert.equal(nettoyerTraduction('Un texte simple.'), 'Un texte simple.');
  });
});

describe('motsUthmani', () => {
  test('decoupe sur les espaces, sans garder le vide', () => {
    assert.deepEqual(motsUthmani('  a  b '), ['a', 'b']);
    assert.deepEqual(motsUthmani(''), []);
    assert.deepEqual(motsUthmani('   '), []);
  });
});

describe('duree', () => {
  test('formate en minutes et secondes', () => {
    assert.equal(duree(0), '0:00');
    assert.equal(duree(9), '0:09');
    assert.equal(duree(60), '1:00');
    assert.equal(duree(72), '1:12');
    assert.equal(duree(3599), '59:59');
  });

  test('tronque les fractions', () => {
    assert.equal(duree(59.9), '0:59');
  });

  test('rend « 0:00 » plutot qu une valeur absurde', () => {
    assert.equal(duree(-1), '0:00');
    assert.equal(duree(Number.NaN), '0:00');
    assert.equal(duree(Number.POSITIVE_INFINITY), '0:00');
  });
});

describe('abreger', () => {
  test('laisse un texte court intact', () => {
    assert.equal(abreger('court'), 'court');
    assert.equal(abreger('x'.repeat(42), 42), 'x'.repeat(42));
  });

  test('coupe sur un espace quand il en trouve un pres de la fin', () => {
    assert.equal(abreger('mot mot mot mot mot mot', 20), 'mot mot mot mot mot\u2026');
  });

  test('coupe net quand il n y a aucun espace', () => {
    assert.equal(abreger('a'.repeat(50), 10), `${'a'.repeat(10)}\u2026`);
  });
});
