/**
 * Catalogue des recitateurs proposes dans l'application.
 *
 * Ce fichier ne porte QUE l'identite editoriale : identifiant, nom, style. Le
 * gabarit d'URL audio n'est pas ecrit ici, et c'est deliberé — mesure du
 * 25 septembre 2026 sur l'API Quran Foundation, les recitateurs ne partagent pas
 * le meme hote :
 *
 *   - la plupart servent depuis `verses.quran.com/Alafasy/mp3/002255.mp3` ;
 *   - Al-Husary sert depuis `mirrors.quranicaudio.com/everyayah/...`, et l'API
 *     rend une URL **relative au protocole** (`//mirrors...`).
 *
 * Ecrire `verses.quran.com` en dur aurait donc prive l'utilisateur de deux
 * recitateurs sur huit, avec un echec silencieux a la lecture. Le gabarit est
 * derive a l'execution, une fois par recitateur, et memorise — voir
 * `services/audio/lecteurAudio.ts`.
 */

export interface IdentiteRecitateur {
  /** Identifiant de recitation de l'API Quran Foundation. */
  readonly id: number;
  readonly nom: string;
  readonly style: string | null;
}

/**
 * Les quatre recitateurs demandes, plus trois ajoutes parce qu'ils sont
 * couramment ecoutes. L'ordre est celui de l'affichage.
 */
export const RECITATEURS: readonly IdentiteRecitateur[] = [
  { id: 7, nom: 'Mishary Rashid Alafasy', style: null },
  { id: 2, nom: 'Abdul Basit Abdus Samad', style: 'Murattal' },
  { id: 6, nom: 'Mahmoud Khalil Al-Husary', style: null },
  { id: 3, nom: 'Abdur-Rahman as-Sudais', style: null },
  { id: 4, nom: 'Abu Bakr al-Shatri', style: null },
  { id: 9, nom: 'Mohamed Siddiq al-Minshawi', style: 'Murattal' },
  { id: 1, nom: 'Abdul Basit Abdus Samad', style: 'Mujawwad' },
] as const;

export const RECITATEUR_PAR_DEFAUT = 7;

export function trouverRecitateur(id: number): IdentiteRecitateur {
  return RECITATEURS.find((r) => r.id === id) ?? RECITATEURS[0];
}

/** Nom affichable, style compris quand il distingue deux entrees du meme recitateur. */
export function nomComplet(recitateur: IdentiteRecitateur): string {
  return recitateur.style ? `${recitateur.nom} (${recitateur.style})` : recitateur.nom;
}

/**
 * Traductions proposees. L'identifiant 31 est la traduction de Muhammad
 * Hamidullah, la reference francophone ; les deux autres sont offertes en plus.
 */
export interface IdentiteTraduction {
  readonly id: number;
  readonly nom: string;
  readonly auteur: string;
}

export const TRADUCTIONS: readonly IdentiteTraduction[] = [
  { id: 31, nom: 'Francais — Muhammad Hamidullah', auteur: 'Muhammad Hamidullah' },
  { id: 136, nom: 'Francais — Montada Islamic Foundation', auteur: 'Montada' },
  { id: 779, nom: 'Francais — Rashid Maash', auteur: 'Rashid Maash' },
] as const;

export const TRADUCTION_PAR_DEFAUT = 31;
