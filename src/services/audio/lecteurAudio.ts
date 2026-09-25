/**
 * Moteur de lecture audio, verset par verset.
 *
 * Pourquoi verset par verset, et non un fichier par sourate : c'est la seule
 * facon d'obtenir ce que la lecture du moushaf exige — savoir **quel** verset est
 * en train d'etre recite, pour le surligner, et pouvoir le repeter. Un fichier
 * de sourate obligerait a lire des horodatages ; ici, la fin d'un verset est un
 * evenement du lecteur.
 *
 * Le moteur vit hors de React, volontairement : la lecture doit continuer quand
 * la feuille audio se ferme, quand on change de page, quand l'ecran se demonte.
 * Un etat porte par un composant ne le permettrait pas.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { codeAudio } from '@/lib/verset';
import { gabaritAudio } from '@/services/quran/api';
import type { CleVerset } from '@/types/coran';

export interface EtatAudio {
  readonly file: readonly CleVerset[];
  readonly index: number;
  readonly enLecture: boolean;
  readonly chargement: boolean;
  readonly position: number;
  readonly duree: number;
  /** Lectures deja faites du verset courant, dans le regime « verset ». */
  readonly repetitionsFaites: number;
  /** Tours deja faits du passage, dans le regime « passage ». */
  readonly toursFaits: number;
  /** Vrai quand la file est un passage choisi, et non les versets d'une page. */
  readonly surPassage: boolean;
  readonly erreur: string | null;
}

const ETAT_INITIAL: EtatAudio = {
  file: [],
  index: 0,
  enLecture: false,
  chargement: false,
  position: 0,
  duree: 0,
  repetitionsFaites: 0,
  toursFaits: 0,
  surPassage: false,
  erreur: null,
};

export interface OptionsLecture {
  /** 1, 2, 3, 5, ou 0 pour une boucle sans fin. */
  readonly repetitions: number;
}

let joueur: AudioPlayer | null = null;
let abonnement: { remove: () => void } | null = null;
let etat: EtatAudio = ETAT_INITIAL;
let options: OptionsLecture = { repetitions: 1 };
let idRecitateur = 7;
let initialise = false;

/** Gabarits d'URL par recitateur : une requete par recitateur, pas par verset. */
const gabarits = new Map<number, string>();
const gabaritsEnVol = new Map<number, Promise<string>>();
const ecouteurs = new Set<(etat: EtatAudio) => void>();

function modifier(partiel: Partial<EtatAudio>): void {
  etat = { ...etat, ...partiel };
  for (const ecouteur of ecouteurs) {
    ecouteur(etat);
  }
}

export function etatAudio(): EtatAudio {
  return etat;
}

export function abonnerAudio(ecouteur: (etat: EtatAudio) => void): () => void {
  ecouteurs.add(ecouteur);
  ecouteur(etat);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

export function reglerOptionsLecture(nouvelles: Partial<OptionsLecture>): void {
  options = { ...options, ...nouvelles };
}

/**
 * Prepare le moteur. Idempotent.
 *
 * `playsInSilentMode` est indispensable ici : sans lui, un iPhone en mode
 * silencieux ne joue aucun son et l'utilisateur conclut que l'application est
 * cassee. `shouldPlayInBackground` permet de continuer a ecouter en lisant
 * ailleurs dans l'application.
 */
export async function initialiserAudio(): Promise<void> {
  if (initialise) {
    return;
  }
  initialise = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    });
  } catch {
    // Le mode audio est un confort : s'il echoue, la lecture reste possible.
  }
}

function obtenirJoueur(): AudioPlayer {
  if (joueur) {
    return joueur;
  }
  joueur = createAudioPlayer(null, { updateInterval: 250 });
  abonnement = joueur.addListener('playbackStatusUpdate', (statut) => {
    modifier({
      enLecture: statut.playing,
      position: statut.currentTime ?? 0,
      duree: statut.duration ?? 0,
      chargement: !statut.isLoaded,
    });
    if (statut.didJustFinish) {
      void versetTermine();
    }
  });
  return joueur;
}

export function definirRecitateur(id: number): void {
  idRecitateur = id;
}

export function recitateurCourant(): number {
  return idRecitateur;
}

/**
 * URL audio d'un verset, gabarit compris.
 *
 * Le gabarit est derive une fois par recitateur : mesure du 25 septembre 2026,
 * les recitateurs ne partagent ni le meme hote ni la meme arborescence, et
 * ecrire `verses.quran.com` en dur priverait l'utilisateur de deux d'entre eux
 * sans le moindre message.
 */
export async function urlVerset(cle: CleVerset, id?: number): Promise<string> {
  const identifiant = id ?? idRecitateur;
  let gabarit = gabarits.get(identifiant);
  if (!gabarit) {
    let enVol = gabaritsEnVol.get(identifiant);
    if (!enVol) {
      enVol = gabaritAudio(identifiant).then((valeur) => {
        gabarits.set(identifiant, valeur);
        gabaritsEnVol.delete(identifiant);
        return valeur;
      });
      gabaritsEnVol.set(identifiant, enVol);
    }
    gabarit = await enVol;
  }
  return gabarit.replace('{code}', codeAudio(cle));
}

function auBout(): boolean {
  return etat.index >= etat.file.length - 1;
}

/**
 * Charge et joue le verset a cet index.
 *
 * `remettreAZero` distingue les deux raisons de rejouer : repeter (on garde le
 * compteur, qui vient d'etre incremente) et avancer (on repart de zero).
 */
async function lireIndex(index: number, remettreAZero = true): Promise<void> {
  const cle = etat.file[index];
  if (!cle) {
    modifier({ enLecture: false, chargement: false });
    return;
  }
  modifier({
    index,
    chargement: true,
    erreur: null,
    ...(remettreAZero ? { repetitionsFaites: 0 } : {}),
  });
  try {
    const url = await urlVerset(cle);
    const lecteur = obtenirJoueur();
    lecteur.replace({ uri: url });
    lecteur.play();
    modifier({ chargement: false, enLecture: true });
  } catch (erreur) {
    modifier({
      chargement: false,
      enLecture: false,
      erreur:
        erreur instanceof Error
          ? `Recitation indisponible : ${erreur.message}`
          : 'Recitation indisponible.',
    });
  }
}

/**
 * Fin d'un verset : applique la repetition, puis enchaine ou s'arrete.
 *
 * Deux regimes, et c'est ce qui distingue « repeter un verset » de « repeter un
 * passage » :
 *
 *  - lecture d'une page — la repetition porte sur **le verset** : 3x sur 2:255
 *    donne 2:255, 2:255, 2:255, puis 2:256 ;
 *  - lecture d'un passage choisi — elle porte sur **le passage** : 3x sur
 *    2:255-2:257 donne le passage entier trois fois.
 */
async function versetTermine(): Promise<void> {
  const { repetitions } = options;
  const dernier = auBout();

  if (etat.surPassage) {
    if (!dernier) {
      await lireIndex(etat.index + 1, false);
      return;
    }
    if (repetitions === 0) {
      await lireIndex(0, false);
      return;
    }
    const tours = etat.toursFaits + 1;
    if (tours < repetitions) {
      modifier({ toursFaits: tours });
      await lireIndex(0, false);
      return;
    }
    modifier({ toursFaits: 0, enLecture: false });
    return;
  }

  if (repetitions === 0) {
    await lireIndex(etat.index, false);
    return;
  }
  const faites = etat.repetitionsFaites + 1;
  if (faites < repetitions) {
    modifier({ repetitionsFaites: faites });
    await lireIndex(etat.index, false);
    return;
  }
  if (!dernier) {
    await lireIndex(etat.index + 1);
    return;
  }
  modifier({ repetitionsFaites: 0, enLecture: false });
}

/** Installe une file de versets et commence au verset demande. */
export async function lireFile(
  file: readonly CleVerset[],
  depart: CleVerset,
  surPassage = false,
): Promise<void> {
  if (file.length === 0) {
    return;
  }
  const index = Math.max(0, file.indexOf(depart));
  modifier({
    file,
    index,
    surPassage,
    toursFaits: 0,
    repetitionsFaites: 0,
    erreur: null,
  });
  await lireIndex(index);
}

export async function basculerLecture(): Promise<void> {
  if (etat.file.length === 0) {
    return;
  }
  const lecteur = obtenirJoueur();
  if (etat.enLecture) {
    lecteur.pause();
    modifier({ enLecture: false });
    return;
  }
  if (etat.duree > 0 && etat.position > 0) {
    lecteur.play();
    modifier({ enLecture: true });
    return;
  }
  await lireIndex(etat.index, false);
}

export async function versetSuivant(): Promise<void> {
  await lireIndex(auBout() ? 0 : etat.index + 1);
}

export async function versetPrecedent(): Promise<void> {
  await lireIndex(etat.index <= 0 ? 0 : etat.index - 1);
}

/** Lit un verset isole, en dehors de toute file. */
export async function lireVerset(cle: CleVerset): Promise<void> {
  modifier({ file: [cle], index: 0, surPassage: false });
  await lireIndex(0);
}

export async function arreter(): Promise<void> {
  joueur?.pause();
  modifier({ enLecture: false, position: 0 });
}

export function versetCourant(): CleVerset | null {
  return etat.file[etat.index] ?? null;
}

/** Reserve aux tests : remet le moteur a zero. */
export function reinitialiserAudioPourTest(): void {
  abonnement?.remove();
  abonnement = null;
  joueur?.remove();
  joueur = null;
  etat = ETAT_INITIAL;
  options = { repetitions: 1 };
  gabarits.clear();
  gabaritsEnVol.clear();
  ecouteurs.clear();
  initialise = false;
}
