/**
 * Chargement asynchrone avec etat derive.
 *
 * La regle tenue ici : **on ne pousse pas un etat de chargement depuis un effet**.
 * Le resultat memorise porte l'empreinte de la demande a laquelle il repond ;
 * l'etat affiche s'en deduit. C'est ce qui evite la roue qui clignote au premier
 * rendu, et ce qui distingue « pas encore charge » de « charge et vide ».
 *
 * Un compteur de generation fait ignorer une reponse devenue obsolete si deux
 * chargements se chevauchent — le cas se produit des qu'on feuillette vite.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type EtatRequete<T> =
  | { readonly statut: 'chargement' }
  | { readonly statut: 'pret'; readonly donnees: T }
  | { readonly statut: 'erreur'; readonly message: string };

interface ResultatMemorise<T> {
  readonly cle: string;
  readonly etat: EtatRequete<T>;
}

export interface Requete<T> {
  readonly etat: EtatRequete<T>;
  readonly recharger: () => void;
}

/**
 * @param cle      Empreinte de la demande. Changer cette valeur relance le chargement.
 * @param charger  Le travail a faire. Recoit un signal d'annulation.
 */
export function useRequete<T>(
  cle: string,
  charger: (signal: AbortSignal) => Promise<T>,
): Requete<T> {
  const [memorise, setMemorise] = useState<ResultatMemorise<T> | null>(null);
  const [generationForcee, setGenerationForcee] = useState(0);
  const generation = useRef(0);
  const chargerRef = useRef(charger);
  chargerRef.current = charger;

  useEffect(() => {
    const numero = generation.current + 1;
    generation.current = numero;
    const controleur = new AbortController();

    void (async () => {
      try {
        const donnees = await chargerRef.current(controleur.signal);
        if (generation.current === numero) {
          setMemorise({ cle, etat: { statut: 'pret', donnees } });
        }
      } catch (erreur) {
        if (generation.current !== numero) {
          return;
        }
        const message =
          erreur instanceof Error ? erreur.message : 'Le chargement a echoue.';
        setMemorise({ cle, etat: { statut: 'erreur', message } });
      }
    })();

    return () => {
      controleur.abort();
    };
  }, [cle, generationForcee]);

  const recharger = useCallback(() => {
    setGenerationForcee((n) => n + 1);
  }, []);

  const aJour = memorise && memorise.cle === cle ? memorise.etat : null;
  return {
    etat: aJour ?? { statut: 'chargement' },
    recharger,
  };
}
