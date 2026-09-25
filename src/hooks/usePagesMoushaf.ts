/**
 * Pages du moushaf, avec prechargement des voisines.
 *
 * Une page se tourne vite. Sans prechargement, chaque glissement afficherait un
 * cadre vide le temps du reseau — et c'est precisement ce qui donne l'impression
 * d'une application lente. On charge donc la page courante **et ses deux
 * voisines**, en serie pour ne pas saturer une connexion mobile.
 *
 * Le cache est un `Map` d'etat, jamais mute : la page deja chargee n'est pas
 * remplacee, ce qui evite de re-rendre le texte pendant la lecture.
 */

import { useEffect, useMemo, useState } from 'react';

import { PAGES_DU_MOUSHAF } from '@/constants/theme';
import { chargerPage } from '@/services/quran/pages';
import type { PageMoushaf } from '@/types/coran';

export interface PagesMoushaf {
  readonly page: PageMoushaf | null;
  readonly erreur: string | null;
  readonly chargement: boolean;
}

export function usePagesMoushaf(numeroPage: number): PagesMoushaf {
  const [pages, setPages] = useState<ReadonlyMap<number, PageMoushaf>>(() => new Map());
  const [erreurs, setErreurs] = useState<ReadonlyMap<number, string>>(() => new Map());

  useEffect(() => {
    let vivant = true;
    const voisines = [numeroPage, numeroPage + 1, numeroPage - 1].filter(
      (page) => page >= 1 && page <= PAGES_DU_MOUSHAF,
    );

    void (async () => {
      for (const page of voisines) {
        try {
          const donnees = await chargerPage(page);
          if (!vivant) {
            return;
          }
          setPages((actuelles) => {
            if (actuelles.has(page)) {
              return actuelles;
            }
            const suivantes = new Map(actuelles);
            suivantes.set(page, donnees);
            return suivantes;
          });
        } catch (probleme) {
          if (!vivant) {
            return;
          }
          const message =
            probleme instanceof Error
              ? probleme.message
              : 'Cette page n’a pas pu être chargée.';
          setErreurs((actuelles) => {
            if (actuelles.get(page) === message) {
              return actuelles;
            }
            const suivantes = new Map(actuelles);
            suivantes.set(page, message);
            return suivantes;
          });
        }
      }
    })();

    return () => {
      vivant = false;
    };
  }, [numeroPage]);

  const page = pages.get(numeroPage) ?? null;
  const erreur = erreurs.get(numeroPage) ?? null;

  return useMemo<PagesMoushaf>(
    () => ({ page, erreur, chargement: page === null && erreur === null }),
    [page, erreur],
  );
}
