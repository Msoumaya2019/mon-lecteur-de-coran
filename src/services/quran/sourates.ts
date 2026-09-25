/**
 * Liste des sourates.
 *
 * Elles viennent de l'API et sont mises en cache : la liste ne change jamais, et
 * l'ecran doit s'ouvrir instantanement, meme sans reseau.
 *
 * Les juz ne sont pas ici : ils vivent dans `services/mushaf/juz.ts`, adosses a
 * une table engendree hors de l'application. Les tenir a part evite de melanger
 * ce qui vient du reseau et ce qui est fige avec le code.
 */

import { chapitres } from '@/services/quran/api';
import { CLE_CACHE_SOURATES, ecrireCache, lireCache } from '@/services/storage/cache';
import type { Sourate } from '@/types/coran';

let souratesEnMemoire: readonly Sourate[] | null = null;

function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export async function chargerSourates(): Promise<readonly Sourate[]> {
  if (souratesEnMemoire) {
    return souratesEnMemoire;
  }
  const enCache = await lireCache<Sourate[]>(CLE_CACHE_SOURATES);
  if (enCache && enCache.length === 114) {
    souratesEnMemoire = enCache;
    return enCache;
  }
  const brutes = await chapitres('fr');
  const sourates: Sourate[] = brutes.map((chapitre) => ({
    numero: chapitre.id,
    nomArabe: chapitre.name_arabic,
    nomSimple: chapitre.name_simple,
    nomTraduit: chapitre.translated_name?.name ?? chapitre.name_simple,
    versets: chapitre.verses_count,
    premierePage: chapitre.pages?.[0] ?? 1,
    dernierePage: chapitre.pages?.[1] ?? chapitre.pages?.[0] ?? 1,
    lieuRevelation: chapitre.revelation_place === 'madinah' ? 'madinah' : 'makkah',
  }));
  souratesEnMemoire = sourates;
  await ecrireCache(CLE_CACHE_SOURATES, sourates);
  return sourates;
}

/** Filtre la liste sur le numero, le nom arabe, le nom translittere ou la traduction. */
export function filtrerSourates(
  sourates: readonly Sourate[],
  recherche: string,
): readonly Sourate[] {
  const terme = normaliserNom(recherche);
  if (!terme) {
    return sourates;
  }
  return sourates.filter((sourate) => {
    if (String(sourate.numero) === terme) {
      return true;
    }
    return (
      normaliserNom(sourate.nomSimple).includes(terme) ||
      normaliserNom(sourate.nomTraduit).includes(terme) ||
      sourate.nomArabe.includes(recherche.trim())
    );
  });
}

/** Sourate a laquelle appartient un verset. */
export function sourateDuVerset(
  sourates: readonly Sourate[],
  sourate: number,
): Sourate | undefined {
  return sourates.find((s) => s.numero === sourate);
}
