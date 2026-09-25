/**
 * Favoris et marque-pages.
 *
 * Trois sortes d'entrees, dans une seule liste : une page, un verset, une
 * sourate. Les reunir evite trois ecrans et trois formats de stockage pour une
 * seule intention — « garder ceci pour y revenir ».
 *
 * Le marque-page de lecture, lui, n'est pas ici : c'est la derniere position,
 * tenue par `preferences.ts`, et elle s'ecrit toute seule.
 */

import { CLE_FAVORIS, ecrireCache, lireCache } from '@/services/storage/cache';
import type { Favori, TypeFavori } from '@/types/coran';

function cleDUneEntree(type: TypeFavori, valeur: string): string {
  return `${type}:${valeur}`;
}

export async function chargerFavoris(): Promise<readonly Favori[]> {
  const brut = await lireCache<Favori[]>(CLE_FAVORIS);
  if (!Array.isArray(brut)) {
    return [];
  }
  return brut
    .filter((f) => f && typeof f.valeur === 'string' && typeof f.type === 'string')
    .sort((a, b) => b.ajouteLe - a.ajouteLe);
}

export function estFavori(favoris: readonly Favori[], type: TypeFavori, valeur: string): boolean {
  const cible = cleDUneEntree(type, valeur);
  return favoris.some((f) => cleDUneEntree(f.type, f.valeur) === cible);
}

/**
 * Bascule un favori. Rend la liste a jour, pour que l'appelant n'ait pas a
 * recharger — et pour que l'icone change sans delai perceptible.
 */
export async function basculerFavori(
  type: TypeFavori,
  valeur: string,
  libelle: string,
): Promise<readonly Favori[]> {
  const actuels = await chargerFavoris();
  const cible = cleDUneEntree(type, valeur);
  const sans = actuels.filter((f) => cleDUneEntree(f.type, f.valeur) !== cible);
  const resultat: Favori[] =
    sans.length === actuels.length
      ? [{ type, valeur, libelle, ajouteLe: Date.now() }, ...actuels]
      : sans;
  await ecrireCache(CLE_FAVORIS, resultat);
  return resultat;
}

export async function retirerFavori(type: TypeFavori, valeur: string): Promise<readonly Favori[]> {
  const actuels = await chargerFavoris();
  const cible = cleDUneEntree(type, valeur);
  const resultat = actuels.filter((f) => cleDUneEntree(f.type, f.valeur) !== cible);
  await ecrireCache(CLE_FAVORIS, resultat);
  return resultat;
}

export const LIBELLE_TYPE: Readonly<Record<TypeFavori, string>> = {
  page: 'Page',
  verset: 'Verset',
  sourate: 'Sourate',
};
