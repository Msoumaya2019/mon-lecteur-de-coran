/**
 * Nettoyage des textes venus de l'API.
 *
 * La traduction de Hamidullah arrive avec un balisage leger : des appels de note
 * `<sup foot_note=195250>1</sup>`. Les afficher tels quels dans une feuille
 * basse donne un texte illisible ; les retirer sans rien mettre a la place fait
 * disparaitre une information. On les remplace donc par une marque discrete.
 */

const BALISE = /<[^>]*>/g;
const APPEL_DE_NOTE = /<sup[^>]*>(.*?)<\/sup>/g;

/**
 * Retire le balisage et marque les appels de note par un point mediole.
 * `« ...l'Un.<sup>1</sup> »` devient `« ...l'Un.¹ »` puis, apres nettoyage,
 * `« ...l'Un. »` suivi d'un point mediole — voir le test associe.
 */
export function nettoyerTraduction(brut: string): string {
  if (!brut) {
    return '';
  }
  const avecMarques = brut.replace(APPEL_DE_NOTE, ' \u00b7');
  return avecMarques
    .replace(BALISE, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decoupe le texte uthmani d'un verset en mots, pour le repli de rendu.
 * L'espace des deux cotes est retire : l'API prefixe souvent le premier mot.
 */
export function motsUthmani(texte: string): readonly string[] {
  return texte.split(/\s+/).filter((mot) => mot.length > 0);
}

/** Tronque un libelle pour une pastille d'interface, sans couper un mot en deux. */
export function abreger(texte: string, longueur = 42): string {
  if (texte.length <= longueur) {
    return texte;
  }
  const coupe = texte.slice(0, longueur);
  const dernierEspace = coupe.lastIndexOf(' ');
  return `${(dernierEspace > longueur * 0.6 ? coupe.slice(0, dernierEspace) : coupe).trimEnd()}…`;
}

/** Formate une duree en secondes sous la forme « 1:12 ». */
export function duree(secondes: number): string {
  if (!Number.isFinite(secondes) || secondes < 0) {
    return '0:00';
  }
  const total = Math.floor(secondes);
  const minutes = Math.floor(total / 60);
  const reste = total % 60;
  return `${minutes}:${String(reste).padStart(2, '0')}`;
}
