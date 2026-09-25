/**
 * Acces reseau.
 *
 * Une seule regle ici, et elle compte pour toute l'application : **une panne de
 * reseau ne doit jamais faire planter l'ecran de lecture**. Toute erreur est
 * donc convertie en `ErreurReseau`, que les appelants savent traduire en message
 * discret — et, quand une page est deja en cache, en repli silencieux.
 */

export class ErreurReseau extends Error {
  readonly statut: number | null;

  constructor(message: string, statut: number | null = null, cause?: unknown) {
    super(message);
    this.name = 'ErreurReseau';
    this.statut = statut;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export type Parametres = Record<string, string | number | boolean | undefined | null>;

export function construireUrl(chemin: string, parametres?: Parametres): string {
  if (!parametres) {
    return chemin;
  }
  const morceaux: string[] = [];
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur === undefined || valeur === null || valeur === '') {
      continue;
    }
    morceaux.push(`${encodeURIComponent(cle)}=${encodeURIComponent(String(valeur))}`);
  }
  if (morceaux.length === 0) {
    return chemin;
  }
  return `${chemin}${chemin.includes('?') ? '&' : '?'}${morceaux.join('&')}`;
}

export interface OptionsRequete {
  /** Delai au-dela duquel la requete est abandonnee, en millisecondes. */
  readonly delai?: number;
  readonly signal?: AbortSignal;
}

const DELAI_PAR_DEFAUT = 20000;

/** Identification envoyee a l'API. Voir la note dans `obtenirJson`. */
const AGENT = 'MonLecteurDeCoran/1.0 (Expo)';

/**
 * Analyse un corps de reponse JSON, en toleranta un BOM en tete.
 *
 * La tolerance est **defensive, et son statut est dit franchement** : un BOM a
 * ete vu une fois pendant la generation des metriques, mais il ne se reproduit
 * pas — reverifie le 25 septembre 2026 sur les cinq pages servies en `code_v1`
 * (121, 533, 534, 568, 570) comme sur des pages `v4`, avec les deux formes de
 * requete : aucun BOM, `Content-Type: application/json; charset=utf-8` partout.
 * La cause de l'observation initiale reste inconnue.
 *
 * Elle est conservee pourtant : `JSON.parse` refuse un texte qui commence par
 * U+FEFF, l'echec serait invisible, et il porterait sur une page entiere. Le
 * retrait coute une comparaison.
 *
 * Extraite de `obtenirJson` pour etre eprouvable sans reseau.
 */
export function analyserJson<T>(texte: string): T {
  const sansBom = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
  return JSON.parse(sansBom) as T;
}

/**
 * Lit une ressource JSON. Leve une `ErreurReseau` pour tout echec — jamais une
 * erreur brute de `fetch`, dont le message ne dit rien a l'utilisateur.
 */
export async function obtenirJson<T>(
  url: string,
  options: OptionsRequete = {},
): Promise<T> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), options.delai ?? DELAI_PAR_DEFAUT);

  if (options.signal) {
    if (options.signal.aborted) {
      controleur.abort();
    } else {
      options.signal.addEventListener('abort', () => controleur.abort(), { once: true });
    }
  }

  try {
    const reponse = await fetch(url, {
      signal: controleur.signal,
      headers: {
        Accept: 'application/json',
        // Sans en-tete d'agent, l'API a repondu 403 — constate le
        // 25 septembre 2026 depuis un client Python. React Native en envoie un
        // de lui-meme, mais s'identifier reste plus sur, et c'est aussi la
        // moindre des corrections envers le service qui nous sert le Coran.
        'User-Agent': AGENT,
      },
    });
    if (!reponse.ok) {
      throw new ErreurReseau(
        `Le serveur a repondu ${reponse.status}.`,
        reponse.status,
      );
    }
    // Lecture en texte plutot que `reponse.json()`, pour une raison mesuree :
    // l'API place un BOM en tete de certaines reponses — constate le
    // 25 septembre 2026 sur les pages servies en `code_v1` (121, 533, 534, 568,
    // 570). `JSON.parse` refuse un texte qui commence par U+FEFF, et rien ne
    // garantit que le decodeur de React Native le retire. Cinq pages du moushaf
    // deviendraient illisibles pour un caractere invisible.
    const texte = await reponse.text();
    const sansBom = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
    try {
      return JSON.parse(sansBom) as T;
    } catch (erreur) {
      throw new ErreurReseau('La reponse du serveur est illisible.', reponse.status, erreur);
    }
  } catch (erreur) {
    if (erreur instanceof ErreurReseau) {
      throw erreur;
    }
    const message =
      erreur instanceof Error && erreur.name === 'AbortError'
        ? 'La connexion a pris trop de temps.'
        : 'La connexion est indisponible.';
    throw new ErreurReseau(message, null, erreur);
  } finally {
    clearTimeout(minuteur);
  }
}

/** Traduit une erreur quelconque en message affichable, en francais. */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurReseau) {
    return erreur.message;
  }
  if (erreur instanceof Error) {
    return erreur.message;
  }
  return 'Une erreur inattendue est survenue.';
}
