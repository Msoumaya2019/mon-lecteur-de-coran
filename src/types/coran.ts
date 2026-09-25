/**
 * Types du domaine coranique.
 *
 * Deux points de vocabulaire, tenus partout dans le projet :
 *
 *  - un **verset** est designe par sa `verse_key` (« 2:255 »), telle que l'API
 *    la rend. C'est l'identifiant stable, et il traverse toute l'application ;
 *  - un **segment** est un element de ligne du moushaf : soit un mot, soit le
 *    medaillon qui porte le numero du verset. Le medaillon compte comme un
 *    segment a part entiere, et il appartient au verset qu'il clot.
 */

/** Identifiant d'un verset, de la forme « sourate:verset » — par exemple « 2:255 ». */
export type CleVerset = string;

export type TypeSegment = 'mot' | 'medaillon';

/**
 * Un segment de ligne, tel qu'il se compose dans la police de la page.
 *
 * `runs` existe parce qu'un `code_v2` peut porter un espace (un seul cas dans
 * tout le Coran, verifie : 4:135). L'espace n'a pas de glyphe dans la police de
 * page — il separe deux codes. Le rendre comme un run distinct, sans police,
 * evite un caractere manquant.
 */
export interface Segment {
  /** Le ou les points de code du moushaf, dans l'ordre de lecture. */
  readonly code: string;
  /** `code` decoupe sur les espaces : un ou plusieurs runs a composer. */
  readonly runs: readonly string[];
  readonly verset: CleVerset;
  readonly type: TypeSegment;
  /** Position du mot dans son verset, 1 pour le premier. */
  readonly position: number;
}

/** Une des 15 lignes de la page. Les lignes absentes ne sont pas rendues. */
export interface LigneMoushaf {
  /** Numero de ligne, de 1 a 15. */
  readonly numero: number;
  readonly segments: readonly Segment[];
}

/** Un verset tel qu'il apparait sur une page, avec ses lignes et son texte uthmani. */
export interface VersetPage {
  readonly cle: CleVerset;
  readonly sourate: number;
  readonly numero: number;
  /** Numeros de ligne, croissants, ou ce verset se lit. */
  readonly lignes: readonly number[];
  /** Texte uthmani complet — sert au repli si la police ne couvre pas la page. */
  readonly texteUthmani: string;
  /** Traduction francaise, nettoyee de son balisage. `null` si non demandee. */
  readonly traduction: string | null;
}

/** Edition de police du moushaf. Le choix est mesure page par page, jamais suppose. */
export type EditionPolice = 'v4' | 'v1';

/** Une page du moushaf, prete a etre composee. */
export interface PageMoushaf {
  readonly numero: number;
  readonly juz: number;
  readonly hizb: number;
  readonly edition: EditionPolice;
  /** Unites par cadratin de la police de cette page. */
  readonly upem: number;
  /**
   * Avance de chaque ligne en unites de dessin, indexee par numero de ligne.
   * C'est ce qui permet de calculer la taille de police qui justifie la ligne
   * exactement sur la largeur disponible.
   */
  readonly avances: Readonly<Record<number, number>>;
  readonly lignes: readonly LigneMoushaf[];
  readonly versets: readonly VersetPage[];
}

/** Une sourate, telle que `/chapters` la rend. */
export interface Sourate {
  readonly numero: number;
  readonly nomArabe: string;
  readonly nomSimple: string;
  readonly nomTraduit: string;
  readonly versets: number;
  /** Premiere et derniere page du moushaf ou la sourate apparait. */
  readonly premierePage: number;
  readonly dernierePage: number;
  readonly lieuRevelation: 'makkah' | 'madinah';
}

/** Un des 30 juz. */
export interface Juz {
  readonly numero: number;
  /** Page du moushaf ou le juz commence. */
  readonly page: number;
  /** Premier verset du juz. */
  readonly premierVerset: CleVerset;
}

/** Un recitateur disponible pour la lecture verset par verset. */
export interface Recitateur {
  readonly id: number;
  readonly nom: string;
  readonly style: string | null;
  /**
   * Prefixe des fichiers audio, deduit de l'API — par exemple « Alafasy ».
   * Il permet de construire l'URL de n'importe quel verset sans nouvelle requete.
   */
  readonly dossier: string;
}

/** Une traduction disponible. */
export interface Traduction {
  readonly id: number;
  readonly nom: string;
  readonly auteur: string;
  readonly langue: string;
}

/** Un favori : une page, un verset, ou une sourate. */
export type TypeFavori = 'page' | 'verset' | 'sourate';

export interface Favori {
  readonly type: TypeFavori;
  /** Page, cle de verset, ou numero de sourate selon `type`. */
  readonly valeur: string;
  readonly libelle: string;
  readonly ajouteLe: number;
}

/** Position de lecture memorisee, pour « Continuer ma lecture ». */
export interface PositionLecture {
  readonly page: number;
  readonly verset: CleVerset | null;
  readonly majLe: number;
}
