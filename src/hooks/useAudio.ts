/**
 * Acces React au moteur audio.
 *
 * Le moteur vit hors de React (voir `services/audio/lecteurAudio.ts`) ; ce hook
 * ne fait que s'y abonner et lui transmettre les reglages. C'est ce qui permet a
 * la recitation de continuer quand la feuille audio se ferme ou quand on change
 * de page : aucun composant ne la porte.
 */

import { useEffect, useMemo, useState } from 'react';

import {
  abonnerAudio,
  basculerLecture,
  etatAudio,
  initialiserAudio,
  definirRecitateur,
  lireFile,
  lireVerset,
  reglerOptionsLecture,
  versetCourant,
  versetPrecedent,
  versetSuivant,
  arreter,
  type EtatAudio,
} from '@/services/audio/lecteurAudio';
import { useReglages } from '@/store/PreferencesProvider';
import type { CleVerset } from '@/types/coran';

export interface LecteurAudio {
  readonly etat: EtatAudio;
  readonly versetCourant: CleVerset | null;
  readonly basculer: () => void;
  readonly suivant: () => void;
  readonly precedent: () => void;
  readonly lireVerset: (cle: CleVerset) => void;
  readonly lireFile: (
    file: readonly CleVerset[],
    depart: CleVerset,
    surPassage?: boolean,
  ) => void;
  readonly arreter: () => void;
}

export function useAudio(): LecteurAudio {
  const [etat, setEtat] = useState<EtatAudio>(() => etatAudio());
  const { reglages } = useReglages();

  useEffect(() => abonnerAudio(setEtat), []);

  useEffect(() => {
    void initialiserAudio();
  }, []);

  useEffect(() => {
    definirRecitateur(reglages.idRecitateur);
  }, [reglages.idRecitateur]);

  useEffect(() => {
    reglerOptionsLecture({ repetitions: reglages.repetitions });
  }, [reglages.repetitions]);

  return useMemo<LecteurAudio>(
    () => ({
      etat,
      versetCourant: versetCourant(),
      basculer: () => {
        void basculerLecture();
      },
      suivant: () => {
        void versetSuivant();
      },
      precedent: () => {
        void versetPrecedent();
      },
      lireVerset: (cle) => {
        void lireVerset(cle);
      },
      lireFile: (file, depart, surPassage = false) => {
        void lireFile(file, depart, surPassage);
      },
      arreter: () => {
        void arreter();
      },
    }),
    [etat],
  );
}
