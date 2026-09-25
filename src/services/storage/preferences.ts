/**
 * Preferences de l'utilisateur, et position de lecture.
 *
 * Tout est local, et tout survit a la fermeture : le recitateur choisi, la
 * traduction, la page ou l'on s'est arrete. Aucun compte, aucun serveur — ce qui
 * est aussi la raison pour laquelle rien de ce fichier n'a besoin d'etre
 * protege.
 */

import { RECITATEUR_PAR_DEFAUT, TRADUCTION_PAR_DEFAUT } from '@/constants/recitateurs';
import {
  CLE_DERNIERE_LECTURE,
  CLE_REGLAGES,
  ecrireCache,
  lireCache,
} from '@/services/storage/cache';
import type { PositionLecture } from '@/types/coran';

/** Quand la traduction s'affiche. */
export type ModeTraduction = 'demande' | 'continu';

export interface Reglages {
  /** Identifiant de recitation (voir `constants/recitateurs.ts`). */
  readonly idRecitateur: number;
  /** Identifiant de traduction. */
  readonly idTraduction: number;
  /** Interrupteur general : coupe tout affichage de traduction. */
  readonly traductionActivee: boolean;
  readonly modeTraduction: ModeTraduction;
  /** Multiplicateur applique a la taille du texte de traduction. */
  readonly tailleTraduction: number;
  /** Nombre de repetitions d'un verset : 1, 2, 3, 5, ou 0 pour une boucle sans fin. */
  readonly repetitions: number;
  /** Faut-il enchainer sur le verset suivant apres la derniere repetition ? */
  readonly enchainer: boolean;
}

export const REGLAGES_PAR_DEFAUT: Reglages = {
  idRecitateur: RECITATEUR_PAR_DEFAUT,
  idTraduction: TRADUCTION_PAR_DEFAUT,
  traductionActivee: true,
  modeTraduction: 'demande',
  tailleTraduction: 1,
  repetitions: 1,
  enchainer: true,
};

/** Valeurs admises pour la repetition, dans l'ordre d'affichage. 0 signifie « boucle ». */
export const CHOIX_REPETITIONS: readonly number[] = [1, 2, 3, 5, 0];

export function libelleRepetition(valeur: number): string {
  return valeur === 0 ? 'Boucle' : `${valeur}x`;
}

/**
 * Complete des reglages partiels.
 *
 * Une preference ajoutee apres coup manque dans l'entree deja enregistree : on
 * la remplit par sa valeur par defaut plutot que de laisser `undefined` se
 * propager dans l'interface.
 */
export function completerReglages(partiels: Partial<Reglages> | null): Reglages {
  return { ...REGLAGES_PAR_DEFAUT, ...(partiels ?? {}) };
}

export async function chargerReglages(): Promise<Reglages> {
  const brut = await lireCache<Partial<Reglages>>(CLE_REGLAGES);
  return completerReglages(brut);
}

export async function enregistrerReglages(reglages: Reglages): Promise<void> {
  await ecrireCache(CLE_REGLAGES, reglages);
}

export async function chargerDerniereLecture(): Promise<PositionLecture | null> {
  const brut = await lireCache<PositionLecture>(CLE_DERNIERE_LECTURE);
  if (!brut || typeof brut.page !== 'number' || brut.page < 1 || brut.page > 604) {
    return null;
  }
  return brut;
}

export async function enregistrerDerniereLecture(position: PositionLecture): Promise<void> {
  await ecrireCache(CLE_DERNIERE_LECTURE, position);
}
