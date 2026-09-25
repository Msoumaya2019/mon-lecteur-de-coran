/**
 * Les 30 juz, lus dans la table engendree.
 *
 * La table vient de `/juzs`, la source officielle, et non d'une deduction. La
 * raison est mesuree : le juz d'une page est porte par le **premier verset** de
 * cette page, et un juz peut commencer **au milieu d'une page**. La page 121
 * contient 5:77 a 5:82, et 5:82 ouvre le juz 7 — deduire le debut du juz de la
 * premiere page ou il apparait donnait 122, soit huit versets trop loin. Le meme
 * ecart existait pour les juz 4, 11 et 26 : quatre juz sur trente ouvraient au
 * mauvais endroit.
 *
 * La table est figee dans `src/donnees/juz.json`, engendree par
 * `outils/generer-juz.py` : aucune requete au moment de l'affichage, et l'ecran
 * des juz s'ouvre hors connexion.
 */

import brut from '@/donnees/juz.json';

import type { Juz } from '@/types/coran';

interface FichierJuz {
  readonly juzs: readonly Juz[];
}

const fichier = brut as unknown as FichierJuz;

/** Les 30 juz, dans l'ordre, avec leur page de debut et leur premier verset. */
export function chargerJuz(): readonly Juz[] {
  return fichier.juzs;
}
