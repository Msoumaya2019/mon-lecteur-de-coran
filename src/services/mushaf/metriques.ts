/**
 * Metriques de composition du moushaf, lues dans le fichier engendre.
 *
 * Le fichier `src/donnees/moushaf-metriques.json` est produit hors de
 * l'application par `outils/generer-metriques-moushaf.py`, qui telecharge les
 * 604 polices et mesure l'avance reelle de chaque ligne. Il porte aussi
 * l'**edition** retenue pour chaque page : 599 pages sont couvertes par
 * l'edition `v4`, cinq (121, 533, 534, 568, 570) ne le sont pas et basculent sur
 * `v1`. Ce choix est mesure, jamais suppose.
 *
 * C'est ce fichier qui rend la justification exacte possible : l'application ne
 * sait pas lire une police, mais elle sait quelle taille donner a une ligne pour
 * qu'elle tombe pile sur la largeur disponible.
 */

import brut from '@/donnees/moushaf-metriques.json';

import type { EditionPolice } from '@/types/coran';

interface EntreePage {
  readonly edition: string;
  readonly upem: number;
  readonly juz: number | null;
  readonly hizb: number | null;
  readonly lignes: Readonly<Record<string, readonly number[]>>;
}

interface FichierMetriques {
  readonly pages: Readonly<Record<string, EntreePage>>;
}

const fichier = brut as unknown as FichierMetriques;

export interface MetriquesPage {
  readonly edition: EditionPolice;
  readonly upem: number;
  readonly juz: number;
  readonly hizb: number;
  /** Avance de chaque ligne en unites de dessin, indexee par numero de ligne. */
  readonly avances: Readonly<Record<number, number>>;
}

const cache = new Map<number, MetriquesPage | null>();

/**
 * Metriques d'une page, ou `null` si le fichier ne la couvre pas.
 *
 * Un `null` n'est pas une erreur : l'appelant sait alors retomber sur un rendu
 * centre, sans justification exacte. Cela ne devrait jamais arriver — le
 * generateur couvre les 604 pages et refuse de finir sinon — mais un rendu
 * degrade vaut mieux qu'un ecran blanc.
 */
export function metriquesPage(page: number): MetriquesPage | null {
  if (cache.has(page)) {
    return cache.get(page) ?? null;
  }
  const entree = fichier.pages[String(page)];
  if (!entree) {
    cache.set(page, null);
    return null;
  }
  const avances: Record<number, number> = {};
  for (const [numero, valeurs] of Object.entries(entree.lignes)) {
    const valeur = valeurs[0];
    if (typeof valeur === 'number' && valeur > 0) {
      avances[Number(numero)] = valeur;
    }
  }
  const resultat: MetriquesPage = {
    edition: entree.edition === 'v1' ? 'v1' : 'v4',
    upem: entree.upem,
    juz: entree.juz ?? 1,
    hizb: entree.hizb ?? 1,
    avances,
  };
  cache.set(page, resultat);
  return resultat;
}

/**
 * Les 30 juz ne sont pas deduits d'ici : voir `services/mushaf/juz.ts`.
 *
 * La deduction avait ete tentee, et elle etait fausse pour quatre juz sur trente.
 * Le `juz` porte par une page est celui de son premier verset, alors qu'un juz
 * peut commencer au milieu d'une page : la page 121 ouvre le juz 7 en son verset
 * 5:82, mais son premier verset appartient encore au juz 6.
 */

/** Nombre de pages reellement decrites par le fichier de metriques. */
export function nombreDePagesCouvertes(): number {
  return Object.keys(fichier.pages).length;
}

/** Les pages qui ne sont pas servies par l'edition principale — pour l'ecran Reglages. */
export function pagesEnEditionDeSecours(): readonly number[] {
  return Object.entries(fichier.pages)
    .filter(([, entree]) => entree.edition !== 'v4')
    .map(([page]) => Number(page))
    .sort((a, b) => a - b);
}
