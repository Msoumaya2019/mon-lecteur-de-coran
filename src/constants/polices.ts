/**
 * Noms de polices utilises par l'application.
 *
 * Deux familles, et elles ne servent pas a la meme chose :
 *
 *  - `Amiri Quran` — police uthmani libre (SIL OFL), embarquee dans
 *    l'application. Elle sert a tout ce que la police de page ne porte pas :
 *    l'en-tete de sourate, la basmala, les libelles arabes d'interface, et le
 *    repli de rendu. Elle est choisie parce qu'elle couvre l'alef wasla
 *    (U+0671) et les marques de recitation, sans lesquelles un texte uthmani
 *    s'affiche faux ;
 *  - les polices `QCF` de page, telechargees a la demande. Elles seules
 *    reproduisent le trace de l'imprime, et elles sont **propres a chaque
 *    page** : voir `services/mushaf/polices.ts`.
 */

import { Platform } from 'react-native';

export const AMIRI_QURAN = 'AmiriQuran';

/**
 * Police systeme, utilisee pour le seul caractere que la police de page ne porte
 * pas : l'espace. Un `code_v2` peut en contenir un (un cas dans tout le Coran,
 * 4:135), et la police QCF n'a pas de glyphe d'espace.
 */
export const POLICE_SYSTEME = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

/** Texte de la basmala, en graphie uthmani. */
export const BASMALA = '\u0628\u0650\u0633\u0645\u0650 \u0671\u0644\u0644\u064e\u0651\u0647\u0650 \u0671\u0644\u0631\u064e\u0651\u062d\u0645\u064e\u0670\u0646\u0650 \u0671\u0644\u0631\u064e\u0651\u062d\u0650\u064a\u0645\u0650';

/**
 * La sourate 1 porte la basmala comme premier verset, et la sourate 9 n'en a
 * pas : l'afficher en tete de l'une ou de l'autre serait une faute.
 */
export function aUneBasmala(numeroSourate: number): boolean {
  return numeroSourate !== 1 && numeroSourate !== 9;
}
