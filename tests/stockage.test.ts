/**
 * Stockage local : cache, favoris, reglages, derniere lecture.
 *
 * Deux contrats sont verifies ici, parce qu'ils sont promis par le code et
 * faciles a casser sans qu'on s'en apercoive :
 *
 *  - **une lecture de cache ne leve jamais.** Un cache corrompu doit se
 *    comporter comme un cache vide, jamais comme une panne — sinon une entree
 *    abimee rendrait l'application inutilisable ;
 *  - **vider le cache du moushaf ne touche ni aux favoris, ni aux reglages, ni a
 *    la position de lecture.** C'est ce que l'ecran Reglages annonce.
 *
 * Ces tests passent par le faux AsyncStorage en memoire, ce qui permet en plus
 * de fabriquer des entrees corrompues — chose qu'aucune API publique ne laisse
 * faire.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import { contenu, poserBrut, vider } from '../outils/faux-async-storage';
import {
  CLE_DERNIERE_LECTURE,
  CLE_FAVORIS,
  CLE_REGLAGES,
  clePage,
  cleTraductionsPage,
  compterPagesEnCache,
  ecrireCache,
  lireCache,
  supprimerCache,
  viderCacheMoushaf,
} from '../src/services/storage/cache';
import {
  basculerFavori,
  chargerFavoris,
  estFavori,
  retirerFavori,
} from '../src/services/storage/favoris';
import {
  CHOIX_REPETITIONS,
  REGLAGES_PAR_DEFAUT,
  chargerDerniereLecture,
  chargerReglages,
  completerReglages,
  enregistrerDerniereLecture,
  enregistrerReglages,
  libelleRepetition,
} from '../src/services/storage/preferences';

beforeEach(() => {
  vider();
});

describe('cache', () => {
  test('fait l aller-retour d une valeur', async () => {
    await ecrireCache('mlc:essai', { a: 1, b: ['x'] });
    assert.deepEqual(await lireCache('mlc:essai'), { a: 1, b: ['x'] });
  });

  test('rend null pour une cle absente', async () => {
    assert.equal(await lireCache('mlc:jamais-ecrite'), null);
  });

  test('traite une entree corrompue comme absente, sans lever', async () => {
    poserBrut('mlc:corrompue', '{ ceci n est pas du JSON');
    assert.equal(await lireCache('mlc:corrompue'), null);
  });

  test('supprime une entree', async () => {
    await ecrireCache('mlc:essai', 1);
    await supprimerCache('mlc:essai');
    assert.equal(await lireCache('mlc:essai'), null);
  });

  test('compte les pages en cache, et seulement elles', async () => {
    await ecrireCache(clePage(1), { numero: 1 });
    await ecrireCache(clePage(2), { numero: 2 });
    await ecrireCache(cleTraductionsPage(1, 31), { '1:1': 'x' });
    await ecrireCache(CLE_REGLAGES, REGLAGES_PAR_DEFAUT);
    assert.equal(await compterPagesEnCache(), 2);
  });

  test('vider le cache du moushaf epargne les favoris, les reglages et la position', async () => {
    await ecrireCache(clePage(1), { numero: 1 });
    await ecrireCache(cleTraductionsPage(1, 31), { '1:1': 'x' });
    await ecrireCache(CLE_FAVORIS, []);
    await ecrireCache(CLE_REGLAGES, REGLAGES_PAR_DEFAUT);
    await ecrireCache(CLE_DERNIERE_LECTURE, { page: 5, verset: null, majLe: 0 });

    await viderCacheMoushaf();

    assert.equal(await compterPagesEnCache(), 0);
    assert.ok(contenu().has(CLE_FAVORIS), 'les favoris ne doivent pas etre touches');
    assert.ok(contenu().has(CLE_REGLAGES), 'les reglages ne doivent pas etre touches');
    assert.ok(contenu().has(CLE_DERNIERE_LECTURE), 'la position ne doit pas etre touchee');
  });
});

describe('favoris', () => {
  test('bascule : ajoute, puis retire', async () => {
    assert.equal(estFavori(await chargerFavoris(), 'verset', '2:255'), false);

    let liste = await basculerFavori('verset', '2:255', 'Al-Baqara 2:255');
    assert.equal(liste.length, 1);
    assert.equal(estFavori(liste, 'verset', '2:255'), true);

    liste = await basculerFavori('verset', '2:255', 'Al-Baqara 2:255');
    assert.equal(liste.length, 0);
    assert.equal(estFavori(liste, 'verset', '2:255'), false);
  });

  test('distingue le type : la page 5 n est pas le verset 5', async () => {
    const liste = await basculerFavori('page', '5', 'Page 5');
    assert.equal(estFavori(liste, 'page', '5'), true);
    assert.equal(estFavori(liste, 'verset', '5'), false);
    assert.equal(estFavori(liste, 'sourate', '5'), false);
  });

  test('range le plus recent en tete', async () => {
    await basculerFavori('page', '1', 'Page 1');
    await basculerFavori('page', '2', 'Page 2');
    const liste = await chargerFavoris();
    assert.deepEqual(
      liste.map((f) => f.valeur),
      ['2', '1'],
    );
  });

  test('retire une entree par son type et sa valeur', async () => {
    await basculerFavori('page', '1', 'Page 1');
    await basculerFavori('page', '2', 'Page 2');
    const restants = await retirerFavori('page', '1');
    assert.deepEqual(
      restants.map((f) => f.valeur),
      ['2'],
    );
  });

  test('ignore une entree illisible plutot que de lever', async () => {
    poserBrut(CLE_FAVORIS, 'pas un tableau');
    assert.deepEqual(await chargerFavoris(), []);
  });

  test('ecarte les entrees mal formees', async () => {
    poserBrut(
      CLE_FAVORIS,
      JSON.stringify([
        { type: 'page', valeur: '1', libelle: 'bonne', ajouteLe: 1 },
        { type: 'page' },
        null,
        'texte',
      ]),
    );
    const liste = await chargerFavoris();
    assert.equal(liste.length, 1);
    assert.equal(liste[0].valeur, '1');
  });
});

describe('reglages', () => {
  test('rend les valeurs par defaut quand rien n a ete enregistre', async () => {
    assert.deepEqual(await chargerReglages(), REGLAGES_PAR_DEFAUT);
  });

  test('complete une entree partielle par les valeurs par defaut', async () => {
    // Le cas se produit a chaque fois qu'un reglage est ajoute apres coup : les
    // installations existantes n'ont pas la nouvelle cle.
    poserBrut(CLE_REGLAGES, JSON.stringify({ idRecitateur: 3 }));
    const reglages = await chargerReglages();
    assert.equal(reglages.idRecitateur, 3);
    assert.equal(reglages.idTraduction, REGLAGES_PAR_DEFAUT.idTraduction);
    assert.equal(reglages.repetitions, REGLAGES_PAR_DEFAUT.repetitions);
  });

  test('fait l aller-retour', async () => {
    const modifie = { ...REGLAGES_PAR_DEFAUT, idRecitateur: 6, repetitions: 3 };
    await enregistrerReglages(modifie);
    assert.deepEqual(await chargerReglages(), modifie);
  });

  test('completerReglages accepte null', () => {
    assert.deepEqual(completerReglages(null), REGLAGES_PAR_DEFAUT);
  });

  test('les repetitions proposees sont celles demandees', () => {
    assert.deepEqual([...CHOIX_REPETITIONS], [1, 2, 3, 5, 0]);
    assert.equal(libelleRepetition(0), 'Boucle');
    assert.equal(libelleRepetition(3), '3x');
  });
});

describe('derniere lecture', () => {
  test('fait l aller-retour', async () => {
    await enregistrerDerniereLecture({ page: 42, verset: '2:255', majLe: 1 });
    assert.deepEqual(await chargerDerniereLecture(), { page: 42, verset: '2:255', majLe: 1 });
  });

  test('rend null quand rien n a ete enregistre', async () => {
    assert.equal(await chargerDerniereLecture(), null);
  });

  test('refuse une position hors du moushaf', async () => {
    for (const page of [0, -1, 605, 9999, Number.NaN]) {
      poserBrut(CLE_DERNIERE_LECTURE, JSON.stringify({ page, verset: null, majLe: 0 }));
      assert.equal(await chargerDerniereLecture(), null, `la page ${page} aurait du etre refusee`);
    }
  });
});
