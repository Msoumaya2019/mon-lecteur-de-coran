/**
 * Manipulation des cles de verset (« 2:255 ») et des nombres arabes.
 *
 * Ces fonctions sont pures : elles se testent sans appareil, et c'est
 * volontaire — c'est le socle sur lequel reposent l'audio, le surlignage et les
 * favoris.
 */

import type { CleVerset } from '@/types/coran';

export interface VersetDecompose {
  readonly sourate: number;
  readonly verset: number;
}

/** « 2:255 » -> { sourate: 2, verset: 255 }. Leve sur une cle mal formee. */
export function decomposerVerset(cle: CleVerset): VersetDecompose {
  const morceaux = cle.split(':');
  if (morceaux.length !== 2) {
    throw new Error(`Cle de verset invalide : « ${cle} »`);
  }
  const sourate = Number(morceaux[0]);
  const verset = Number(morceaux[1]);
  if (!Number.isInteger(sourate) || !Number.isInteger(verset) || sourate < 1 || verset < 1) {
    throw new Error(`Cle de verset invalide : « ${cle} »`);
  }
  return { sourate, verset };
}

/** { sourate: 2, verset: 255 } -> « 2:255 ». */
export function composerVerset(sourate: number, verset: number): CleVerset {
  return `${sourate}:${verset}`;
}

/**
 * Code a six chiffres utilise par les fichiers audio de l'API :
 * « 2:255 » -> « 002255 ».
 */
export function codeAudio(cle: CleVerset): string {
  const { sourate, verset } = decomposerVerset(cle);
  return String(sourate).padStart(3, '0') + String(verset).padStart(3, '0');
}

/**
 * Rend un nombre en chiffres arabes orientaux, comme sur la page imprimee.
 * Sert aux libelles d'interface qui doivent s'accorder au moushaf.
 */
export function enChiffresArabes(nombre: number): string {
  const chiffres = '٠١٢٣٤٥٦٧٨٩';
  return String(nombre)
    .split('')
    .map((c) => chiffres[Number(c)] ?? c)
    .join('');
}

/** Libelle francais d'un verset : « Al-Baqara 2:255 » -> « 2:255 ». */
export function libelleVerset(cle: CleVerset): string {
  return cle;
}
