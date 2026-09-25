/**
 * Reglages de l'application, tenus a un seul endroit.
 *
 * Le chargement initial laisse l'interface sur ses valeurs par defaut : c'est
 * volontaire. Aucun ecran n'a besoin d'attendre une lecture de disque pour
 * s'afficher, et les reglages arrivent une fraction de seconde plus tard sans
 * que rien ne bouge visiblement.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  REGLAGES_PAR_DEFAUT,
  chargerReglages,
  enregistrerReglages,
  type Reglages,
} from '@/services/storage/preferences';

interface ContexteReglages {
  readonly reglages: Reglages;
  readonly charges: boolean;
  readonly modifier: (partiel: Partial<Reglages>) => void;
}

const Contexte = createContext<ContexteReglages | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_PAR_DEFAUT);
  const [charges, setCharges] = useState(false);
  const montage = useRef(true);

  useEffect(() => {
    montage.current = true;
    void (async () => {
      const lus = await chargerReglages();
      if (montage.current) {
        setReglages(lus);
        setCharges(true);
      }
    })();
    return () => {
      montage.current = false;
    };
  }, []);

  const modifier = useCallback((partiel: Partial<Reglages>) => {
    setReglages((actuels) => {
      const suivants = { ...actuels, ...partiel };
      void enregistrerReglages(suivants);
      return suivants;
    });
  }, []);

  const valeur = useMemo<ContexteReglages>(
    () => ({ reglages, charges, modifier }),
    [reglages, charges, modifier],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useReglages(): ContexteReglages {
  const contexte = useContext(Contexte);
  if (!contexte) {
    throw new Error("useReglages doit etre utilise dans un PreferencesProvider.");
  }
  return contexte;
}
