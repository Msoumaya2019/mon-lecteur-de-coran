/**
 * Jetons de design de « Mon lecteur de Coran ».
 *
 * La regle qui gouverne cette palette : le moushaf doit rester visuellement
 * prioritaire. Les surfaces d'interface sont donc des ivoires et des beiges tres
 * clairs, et le seul accent soutenu — le vert profond — n'apparait que sur de
 * petites surfaces (icones, libelles, medaillons d'interface).
 *
 * Le theme est volontairement unique : une page de moushaf est une page de
 * papier, elle ne s'inverse pas en mode sombre.
 */

export const couleurs = {
  /** Fond de l'ecran de lecture : le papier du moushaf. */
  papier: '#FDFBF4',
  /** Fond des ecrans d'interface. */
  fond: '#F7F4EC',
  /** Surfaces surelevees : cartes, feuilles basses. */
  surface: '#FFFFFF',
  /** Surfaces discretes : lignes de liste, puces. */
  surfaceDouce: '#EFEBE0',

  /** Vert profond de la maison — accents, icones actives. */
  vert: '#0B4A32',
  /** Vert adouci pour les etats secondaires. */
  vertDoux: '#2E6B51',
  /** Vert tres clair, reserve au surlignage du verset recite. */
  surlignage: 'rgba(11, 74, 50, 0.10)',

  /** Touches dorees : filets, ornements, bordures de cadre. */
  or: '#B8944D',
  orClair: '#D9C48C',

  /** Encres de texte. */
  texte: '#1A1A17',
  texteSecondaire: '#6B6558',
  texteTerni: '#9A9384',

  /** Filets et separateurs. */
  filet: '#E3DDCE',
  /** Ombre portee des feuilles basses. */
  ombre: 'rgba(26, 26, 23, 0.18)',
} as const;

export const espaces = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

export const rayons = {
  s: 6,
  m: 12,
  l: 20,
  rond: 999,
} as const;

/**
 * Duree d'affichage des commandes avant effacement automatique.
 * C'est le coeur de l'exigence « le moushaf redevient totalement epure » :
 * l'utilisateur touche, les commandes apparaissent, puis s'effacent seules.
 */
export const DELAI_EFFACEMENT_COMMANDES = 3500;

/** Nombre de lignes du moushaf de Medine, identique sur les 604 pages. */
export const LIGNES_PAR_PAGE = 15;

/** Nombre de pages du moushaf de Medine. */
export const PAGES_DU_MOUSHAF = 604;
