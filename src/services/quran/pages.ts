/**
 * Assemblage d'une page du moushaf.
 *
 * C'est le coeur du rendu fidele. Une page se compose ainsi :
 *
 *  1. on demande a l'API les versets de la page **avec leurs mots**, en
 *     demandant les deux codes (`code_v2` et `code_v1`) et le `line_number` ;
 *  2. on lit les metriques pour connaitre l'edition de police de cette page ;
 *  3. on retient le code de l'edition — `code_v2` pour `v4`, `code_v1` pour `v1` ;
 *  4. on regroupe les mots par `line_number`, ce qui redonne exactement les
 *     15 lignes du moushaf imprime.
 *
 * Le point qui ne se devine pas : **les points de code sont locaux a la page**.
 * U+FC41 vaut « قُلْ » page 604 mais « الم » page 2. Melanger les codes d'une page
 * avec la police d'une autre produit un texte arabe parfaitement lisible... et
 * entierement faux. D'ou la regle : une page, sa police, ses codes.
 */

import type { PageMoushaf, Segment, VersetPage } from '@/types/coran';
import { decomposerVerset } from '@/lib/verset';
import { nettoyerTraduction } from '@/lib/texte';
import { versetParCle, versetsParPage, type VersetBrut } from '@/services/quran/api';
import { metriquesPage } from '@/services/mushaf/metriques';
import {
  clePage,
  cleTraductionsPage,
  ecrireCache,
  lireCache,
} from '@/services/storage/cache';

/**
 * Forme serialisee d'une page dans le cache.
 *
 * C'est exactement une `PageMoushaf`, telle que `assemblerPage` la produit.
 * L'alias est conserve pour nommer l'intention — ce qu'on relit du cache est une
 * page deja assemblee — mais il ne redecrit pas la forme : une interface
 * recopiee ici avait deja derive (elle portait `page` la ou le domaine porte
 * `numero`), et une divergence de ce genre ne se voit qu'a l'execution.
 */
export type PageEnCache = PageMoushaf;

/** Les requetes en vol, indexees par page : deux appels simultanes n'en font qu'un. */
const enVol = new Map<number, Promise<PageMoushaf>>();

/**
 * Charge une page, du cache si possible.
 *
 * `rafraichir` force la lecture reseau — utile quand une page a echoue et que
 * l'utilisateur la redemande.
 */
export function chargerPage(page: number, rafraichir = false): Promise<PageMoushaf> {
  const deja = enVol.get(page);
  if (deja && !rafraichir) {
    return deja;
  }
  const travail = (async () => {
    if (!rafraichir) {
      const enCache = await lireCache<PageEnCache>(clePage(page));
      // Le controle porte sur `numero`, pas seulement sur `lignes` : c'est le
      // champ qui distingue une page assemblee d'une entree d'un ancien format,
      // et une entree de ce genre produirait une page muette au lieu d'etre
      // simplement rechargee.
      if (
        enCache &&
        typeof enCache.numero === 'number' &&
        Array.isArray(enCache.lignes) &&
        enCache.lignes.length > 0
      ) {
        return enCache;
      }
    }
    const fraiche = await chargerPageDuReseau(page);
    await ecrireCache(clePage(page), fraiche);
    return fraiche;
  })();
  enVol.set(page, travail);
  travail.finally(() => {
    if (enVol.get(page) === travail) {
      enVol.delete(page);
    }
  });
  return travail;
}

export async function chargerPageDuReseau(page: number): Promise<PageMoushaf> {
  const versets = await versetsParPage(page, { avecMots: true });
  return assemblerPage(page, versets);
}

/**
 * Compose une page a partir des versets bruts.
 *
 * Fonction pure : elle ne touche ni au reseau ni au cache, et se verifie donc
 * sur un jeu d'essai fixe.
 */
export function assemblerPage(page: number, versets: readonly VersetBrut[]): PageMoushaf {
  const metriques = metriquesPage(page);
  const edition = metriques?.edition ?? 'v4';
  const champ = edition === 'v1' ? 'code_v1' : 'code_v2';

  const parLigne = new Map<number, Segment[]>();
  const listeVersets: VersetPage[] = [];

  for (const verset of versets) {
    const lignesDuVerset = new Set<number>();
    const traductionBrute = verset.translations?.[0]?.text ?? null;

    for (const mot of verset.words ?? []) {
      const numeroLigne = mot.line_number ?? null;
      const code = (champ === 'code_v1' ? mot.code_v1 : mot.code_v2) ?? null;
      if (numeroLigne === null || !code) {
        continue;
      }
      lignesDuVerset.add(numeroLigne);
      const segments = parLigne.get(numeroLigne) ?? [];
      segments.push({
        code,
        // Un `code_v2` peut porter un espace (un seul cas dans le Coran, 4:135).
        // La police de page n'a pas de glyphe d'espace : le run separe se rend
        // avec la police systeme, ce qui donne une vraie respiration au lieu
        // d'un caractere manquant.
        runs: code.split(' ').filter((run) => run.length > 0),
        verset: verset.verse_key,
        type: mot.char_type_name === 'end' ? 'medaillon' : 'mot',
        position: mot.position,
      });
      parLigne.set(numeroLigne, segments);
    }

    const { sourate, verset: numeroVerset } = decomposerVerset(verset.verse_key);
    listeVersets.push({
      cle: verset.verse_key,
      sourate,
      numero: numeroVerset,
      lignes: [...lignesDuVerset].sort((a, b) => a - b),
      texteUthmani: (verset.text_uthmani ?? '').trim(),
      traduction: traductionBrute ? nettoyerTraduction(traductionBrute) : null,
    });
  }

  const lignes = [...parLigne.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, segments]) => ({ numero, segments }));

  const premier = versets[0];
  return {
    numero: page,
    juz: premier?.juz_number ?? metriques?.juz ?? 1,
    hizb: premier?.hizb_number ?? metriques?.hizb ?? 1,
    edition,
    upem: metriques?.upem ?? 2500,
    avances: metriques?.avances ?? {},
    lignes,
    versets: listeVersets,
  };
}

/**
 * Traductions d'une page entiere, indexees par cle de verset.
 *
 * Demandees separement du texte du moushaf : changer de traduction ne doit pas
 * invalider la page, et la page doit rester lisible meme si la traduction
 * echoue.
 */
export async function chargerTraductionsPage(
  page: number,
  idTraduction: number,
): Promise<Readonly<Record<string, string>>> {
  const cle = cleTraductionsPage(page, idTraduction);
  const enCache = await lireCache<Record<string, string>>(cle);
  if (enCache) {
    return enCache;
  }
  const versets = await versetsParPage(page, { idTraduction });
  const table: Record<string, string> = {};
  for (const verset of versets) {
    const brut = verset.translations?.[0]?.text;
    if (brut) {
      table[verset.verse_key] = nettoyerTraduction(brut);
    }
  }
  await ecrireCache(cle, table);
  return table;
}

/**
 * Traduction d'un seul verset — pour l'affichage a la demande.
 *
 * On regarde d'abord la table de la page si elle est deja en cache : c'est le
 * cas courant, puisque le mode continu la charge. Sinon seulement, on demande le
 * verset a l'API.
 */
export async function chargerTraductionVerset(
  cle: string,
  idTraduction: number,
  pageConnue?: number,
): Promise<string | null> {
  if (pageConnue !== undefined) {
    const table = await lireCache<Record<string, string>>(
      cleTraductionsPage(pageConnue, idTraduction),
    );
    const dejaLa = table?.[cle];
    if (dejaLa) {
      return dejaLa;
    }
  }
  const verset = await versetParCle(cle, idTraduction);
  const brut = verset?.translations?.[0]?.text;
  return brut ? nettoyerTraduction(brut) : null;
}
