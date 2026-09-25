/**
 * Cache local, adosse a AsyncStorage.
 *
 * Le moushaf est fait pour etre lu hors connexion : une page deja ouverte doit
 * se rouvrir sans reseau, et sans delai visible. Deux regles portent tout ce
 * fichier :
 *
 *  - une entree de cache n'expire pas toute seule. Une page du Coran ne change
 *    pas ; la reecrire a chaque ouverture ne servirait a rien ;
 *  - une lecture de cache ne doit jamais lever. Un cache corrompu ou tronque
 *    doit se comporter comme un cache vide, jamais comme une panne.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Prefixe commun : permet de purger le cache sans toucher aux preferences. */
const PREFIXE = 'mlc:';

export const CLE_DERNIERE_LECTURE = `${PREFIXE}lecture:derniere`;
export const CLE_FAVORIS = `${PREFIXE}favoris`;
export const CLE_REGLAGES = `${PREFIXE}reglages`;
export const CLE_CACHE_SOURATES = `${PREFIXE}cache:sourates`;
export const CLE_CACHE_RECITATEUR = `${PREFIXE}cache:recitateur`;

export function clePage(page: number): string {
  return `${PREFIXE}cache:page:${page}`;
}

export function cleTraductionsPage(page: number, idTraduction: number): string {
  return `${PREFIXE}cache:traductions:${idTraduction}:${page}`;
}

export async function lireCache<T>(cle: string): Promise<T | null> {
  try {
    const brut = await AsyncStorage.getItem(cle);
    if (brut === null) {
      return null;
    }
    return JSON.parse(brut) as T;
  } catch {
    // Entree illisible ou JSON tronque : on la traite comme absente.
    return null;
  }
}

export async function ecrireCache(cle: string, valeur: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Un cache qu'on n'a pas pu ecrire n'est pas une erreur pour l'utilisateur :
    // la donnee reste affichee, elle sera simplement redemandee au reseau.
  }
}

export async function supprimerCache(cle: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cle);
  } catch {
    // Sans effet : l'entree sera simplement reecrite plus tard.
  }
}

/** Nombre d'entrees de cache du moushaf — sert a l'ecran Reglages. */
export async function compterPagesEnCache(): Promise<number> {
  try {
    const cles = await AsyncStorage.getAllKeys();
    return cles.filter((c) => c.startsWith(`${PREFIXE}cache:page:`)).length;
  } catch {
    return 0;
  }
}

/** Vide tout le cache du moushaf, sans toucher aux favoris ni aux reglages. */
export async function viderCacheMoushaf(): Promise<void> {
  try {
    const cles = await AsyncStorage.getAllKeys();
    const aVider = cles.filter((c) => c.startsWith(`${PREFIXE}cache:`));
    if (aVider.length > 0) {
      await AsyncStorage.multiRemove(aVider);
    }
  } catch {
    // Sans effet.
  }
}
