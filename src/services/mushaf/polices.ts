/**
 * Telechargement et enregistrement des polices de page.
 *
 * La police du Mushaf de Medine est propre a chaque page : il en existe 604, et
 * une page ne s'affiche pas sans la sienne. Les embarquer toutes representerait
 * environ 78 Mo — impossible. Elles sont donc telechargees **a la demande**,
 * une fois, puis conservees sur l'appareil : la premiere lecture d'une page
 * demande le reseau, les suivantes non.
 *
 * L'edition vient des metriques, jamais d'un choix en dur : 599 pages sont
 * servies par `v4`, cinq par `v1` (l'editeur ne fournit pas les glyphes
 * manquants dans `v4` pour ces pages — mesure du 25 septembre 2026).
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as Font from 'expo-font';

import type { EditionPolice } from '@/types/coran';
import { metriquesPage } from '@/services/mushaf/metriques';

const BASE_POLICES = 'https://static.qurancdn.com/fonts/quran/hafs';

const DOSSIER = 'polices-moushaf';

/** Un telechargement par (page, edition) : deux demandes simultanees n'en font qu'une. */
const enVol = new Map<string, Promise<string>>();

function nomFamille(page: number, edition: EditionPolice): string {
  return `qcf-${edition}-p${page}`;
}

export function urlPolice(page: number, edition: EditionPolice): string {
  return `${BASE_POLICES}/${edition}/ttf/p${page}.ttf`;
}

function dossierPolices(): Directory {
  const dossier = new Directory(Paths.document, DOSSIER);
  if (!dossier.exists) {
    dossier.create({ intermediates: true, idempotent: true });
  }
  return dossier;
}

export function fichierPolice(page: number, edition: EditionPolice): File {
  return new File(dossierPolices(), `p${page}.${edition}.ttf`);
}

/** La police de cette page est-elle deja sur l'appareil ? */
export function policeEnCache(page: number, edition: EditionPolice): boolean {
  try {
    return fichierPolice(page, edition).exists;
  } catch {
    return false;
  }
}

/** La police est-elle deja chargee en memoire, donc utilisable tout de suite ? */
export function policeChargee(page: number, edition: EditionPolice): boolean {
  try {
    return Font.isLoaded(nomFamille(page, edition));
  } catch {
    return false;
  }
}

/**
 * Rend le nom de famille utilisable dans un style, en telechargeant la police si
 * besoin. Leve si le telechargement echoue — l'appelant affiche alors un message
 * discret et laisse la lecture du moushaf possible pour les pages en cache.
 */
export function assurerPolicePage(
  page: number,
  editionForcee?: EditionPolice,
): Promise<string> {
  const edition = editionForcee ?? metriquesPage(page)?.edition ?? 'v4';
  const famille = nomFamille(page, edition);

  if (policeChargee(page, edition)) {
    return Promise.resolve(famille);
  }

  const cle = `${page}:${edition}`;
  const deja = enVol.get(cle);
  if (deja) {
    return deja;
  }

  const travail = (async () => {
    const fichier = fichierPolice(page, edition);
    if (!fichier.exists) {
      await File.downloadFileAsync(urlPolice(page, edition), fichier, {
        idempotent: true,
      });
    }
    await Font.loadAsync({ [famille]: { uri: fichier.uri } });
    return famille;
  })();

  enVol.set(cle, travail);
  travail
    .catch(() => {
      // Rien a journaliser ici : l'appelant decide de ce qu'il montre.
    })
    .finally(() => {
      if (enVol.get(cle) === travail) {
        enVol.delete(cle);
      }
    });

  return travail;
}

/** Nombre de polices deja telechargees, et poids occupe sur l'appareil. */
export function etatPolicesTelechargees(): {
  readonly nombre: number;
  readonly octets: number;
} {
  try {
    const dossier = dossierPolices();
    const fichiers = dossier.list().filter((entree): entree is File => entree instanceof File);
    let octets = 0;
    for (const fichier of fichiers) {
      octets += fichier.size ?? 0;
    }
    return { nombre: fichiers.length, octets };
  } catch {
    return { nombre: 0, octets: 0 };
  }
}

/** Efface les polices telechargees. Les pages redeviendront lisibles en ligne. */
export function viderPolices(): number {
  try {
    const dossier = dossierPolices();
    const fichiers = dossier.list().filter((entree): entree is File => entree instanceof File);
    for (const fichier of fichiers) {
      fichier.delete();
    }
    return fichiers.length;
  } catch {
    return 0;
  }
}
