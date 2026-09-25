/**
 * Client de l'API Quran Foundation (v4).
 *
 * Ce fichier ne fait que traduire le protocole : il nomme les reponses et
 * construit les URL. Il ne compose rien — l'assemblage d'une page vit dans
 * `pages.ts`, et c'est une separation voulue : la forme des reponses est
 * instable, la forme d'une page ne l'est pas.
 */

import { construireUrl, obtenirJson } from '@/services/http';

export const BASE_API = 'https://api.quran.com/api/v4';

/** Champs de mot demandes a l'API. Les deux codes sont necessaires : voir `pages.ts`. */
export const CHAMPS_MOT = 'code_v2,code_v1,line_number,page_number,char_type_name';

/**
 * Code du tout premier verset du Coran. C'est l'ancre du gabarit audio : on
 * demande l'URL de 1:1, puis on remplace ce code par un motif. Il doit rester
 * egal a `codeAudio('1:1')` — un test le verifie.
 */
const ANCRE_AUDIO = '001001';

export interface ChapitreBrut {
  readonly id: number;
  readonly revelation_place: string;
  readonly name_simple: string;
  readonly name_arabic: string;
  readonly verses_count: number;
  readonly pages: readonly number[];
  readonly translated_name: { readonly name: string } | null;
}

export interface MotBrut {
  readonly id?: number;
  readonly position: number;
  readonly char_type_name: string;
  readonly code_v2?: string | null;
  readonly code_v1?: string | null;
  readonly line_number?: number | null;
  readonly page_number?: number | null;
  readonly text?: string | null;
}

export interface VersetBrut {
  readonly verse_key: string;
  readonly verse_number: number;
  readonly page_number: number;
  readonly juz_number: number;
  readonly hizb_number: number;
  readonly text_uthmani?: string | null;
  readonly words?: readonly MotBrut[];
  readonly translations?: readonly { readonly resource_id: number; readonly text: string }[];
}

export interface RecitationBrute {
  readonly id: number;
  readonly reciter_name: string;
  readonly style: string | null;
}

/** `/chapters` — la liste des 114 sourates, avec leur etendue de pages. */
export async function chapitres(langue = 'fr'): Promise<readonly ChapitreBrut[]> {
  const url = construireUrl(`${BASE_API}/chapters`, { language: langue });
  const donnees = await obtenirJson<{ chapters: ChapitreBrut[] }>(url);
  return donnees.chapters ?? [];
}

/**
 * `/verses/by_page/{n}` — les versets d'une page, mots compris.
 *
 * `per_page` est volontairement large : la page la plus dense du moushaf tient
 * dans 50 versets, et demander une deuxieme page de resultats ferait deux
 * requetes pour rien.
 */
export async function versetsParPage(
  page: number,
  options: { readonly avecMots?: boolean; readonly idTraduction?: number | null } = {},
): Promise<readonly VersetBrut[]> {
  const url = construireUrl(`${BASE_API}/verses/by_page/${page}`, {
    words: options.avecMots ? 'true' : undefined,
    word_fields: options.avecMots ? CHAMPS_MOT : undefined,
    fields: 'text_uthmani',
    translations: options.idTraduction ?? undefined,
    per_page: 50,
  });
  const donnees = await obtenirJson<{ verses: VersetBrut[] }>(url);
  return donnees.verses ?? [];
}

/** `/verses/by_key/{cle}` — un verset precis, avec sa traduction. */
export async function versetParCle(
  cle: string,
  idTraduction?: number | null,
): Promise<VersetBrut | null> {
  const url = construireUrl(`${BASE_API}/verses/by_key/${cle}`, {
    fields: 'text_uthmani',
    translations: idTraduction ?? undefined,
  });
  const donnees = await obtenirJson<{ verse: VersetBrut }>(url);
  return donnees.verse ?? null;
}

/**
 * Le gabarit d'URL audio d'un recitateur.
 *
 * On demande l'URL du tout premier verset, puis on y remplace `001001` par un
 * motif. Cette derivation n'est pas un detour : mesure du 25 septembre 2026, les
 * recitateurs ne partagent ni le meme hote ni la meme arborescence —
 * `verses.quran.com/Alafasy/mp3/…` d'un cote,
 * `mirrors.quranicaudio.com/everyayah/Husary_64kbps/…` de l'autre, servi en URL
 * relative au protocole. Ecrire un hote en dur priverait l'utilisateur de deux
 * recitateurs sur huit, sans le moindre message d'erreur.
 */
export async function gabaritAudio(idRecitation: number): Promise<string> {
  const url = construireUrl(`${BASE_API}/recitations/${idRecitation}/by_chapter/1`, {
    per_page: 1,
  });
  const donnees = await obtenirJson<{ audio_files?: readonly { url: string }[] }>(url);
  const premier = donnees.audio_files?.[0]?.url;
  if (!premier) {
    throw new Error(`Aucune recitation pour l'identifiant ${idRecitation}.`);
  }
  return normaliserGabarit(premier);
}

/** `/resources/recitations` — le catalogue complet, pour verifier nos identifiants. */
export async function recitations(): Promise<readonly RecitationBrute[]> {
  const url = construireUrl(`${BASE_API}/resources/recitations`);
  const donnees = await obtenirJson<{ recitations: RecitationBrute[] }>(url);
  return donnees.recitations ?? [];
}

/**
 * Rend un gabarit absolu et pret a recevoir un code de verset.
 * `//hote/chemin/001001.mp3` -> `https://hote/chemin/{code}.mp3`
 *
 * Deux precautions, chacune pour un defaut precis :
 *
 *  - l'ancre est le **nom du fichier**, donc la *derniere* occurrence. Un
 *    `replace` sur la premiere casserait l'URL si l'hote contenait la meme
 *    sequence ;
 *  - si l'ancre est absente, on leve. Sans cela le gabarit resterait inchange,
 *    et **chaque verset jouerait la recitation du verset 1:1** — un defaut
 *    parfaitement silencieux, puisque l'audio se lancerait quand meme.
 */
export function normaliserGabarit(urlBrute: string): string {
  const ancre = urlBrute.lastIndexOf(ANCRE_AUDIO);
  if (ancre < 0) {
    throw new Error(
      `Gabarit audio inattendu : « ${urlBrute} » ne contient pas « ${ANCRE_AUDIO} ».`,
    );
  }
  let gabarit = `${urlBrute.slice(0, ancre)}{code}${urlBrute.slice(
    ancre + ANCRE_AUDIO.length,
  )}`;
  if (gabarit.startsWith('//')) {
    gabarit = `https:${gabarit}`;
  } else if (!gabarit.startsWith('http')) {
    gabarit = `https://verses.quran.com/${gabarit.replace(/^\//, '')}`;
  }
  return gabarit;
}
