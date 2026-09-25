/**
 * Traductions d'une page, indexees par cle de verset.
 *
 * Elles sont chargees separement du texte du moushaf, et seulement quand elles
 * servent : en mode continu, ou quand la traduction est activee. Un utilisateur
 * qui lit le moushaf sans traduction ne paie donc aucune requete pour elle.
 *
 * L'echec est silencieux a dessein : une traduction indisponible ne doit pas
 * empecher la lecture du Coran.
 */

import { useEffect, useState } from 'react';

import { chargerTraductionsPage } from '@/services/quran/pages';

export type TableTraductions = Readonly<Record<string, string>>;

export function useTraductionsPage(
  numeroPage: number,
  idTraduction: number,
  actif: boolean,
): TableTraductions {
  const [tables, setTables] = useState<ReadonlyMap<string, TableTraductions>>(
    () => new Map(),
  );

  const cle = `${numeroPage}:${idTraduction}`;

  useEffect(() => {
    if (!actif || tables.has(cle)) {
      return;
    }
    let vivant = true;
    void (async () => {
      try {
        const table = await chargerTraductionsPage(numeroPage, idTraduction);
        if (!vivant) {
          return;
        }
        setTables((actuelles) => {
          if (actuelles.has(cle)) {
            return actuelles;
          }
          const suivantes = new Map(actuelles);
          suivantes.set(cle, table);
          return suivantes;
        });
      } catch {
        // Traduction indisponible : le moushaf reste lisible, c'est l'essentiel.
      }
    })();
    return () => {
      vivant = false;
    };
  }, [actif, cle, numeroPage, idTraduction, tables]);

  return tables.get(cle) ?? {};
}
