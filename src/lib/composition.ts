/**
 * La composition d'une page : quelle taille de police, et pour quelle ligne.
 *
 * Une seule decision se prend ici, et elle vient de mesures faites sur la page
 * **imprimee**, pas d'une intuition.
 *
 * ## Ce que fait le papier
 *
 * Sur une page ordinaire, le calligraphe a amene toutes les lignes a la meme
 * mesure. Mesure du 25 septembre 2026 sur la page 3 : quinze lignes dont
 * l'avance va de 16,148 a 16,509 cadratins, soit 2,2 % d'ecart, et l'encre
 * imprimee de chacune tombe entre 572 et 577 pixels pour une mesure de 575.
 * **Une seule taille de police pour toute la page.**
 *
 * Une ligne courte existe pourtant, et le papier ne la rallonge pas : c'est la
 * derniere ligne d'une sourate. Sur la page 604, l'emplacement 4 porte une
 * avance de 8,822 cadratins la ou les lignes pleines en portent 15,7 — et
 * l'imprime le rend **court** (299 pixels, 53 % de la mesure), a la meme taille
 * que les autres lignes. L'emplacement 15 en occupe 48 %.
 *
 * ## Ce que faisait l'application
 *
 * Elle calculait la taille **ligne par ligne**, en amenant l'avance de chaque
 * ligne sur la largeur disponible. Sur les pages ou toutes les lignes sont
 * pleines, c'est juste — c'est meme exactement la justification du papier. Mais
 * des qu'une ligne est courte, la formule la **grossit** pour lui faire tenir la
 * meme largeur :
 *
 *   - page 604, emplacement 4 : 42,8 pt la ou la page est a 24 pt ;
 *   - page 2, derniere ligne : 63,1 pt pour une hauteur de ligne de 47 pt, donc
 *     un debordement sur les lignes voisines ;
 *   - page 599, emplacement 3 (avance 2,713 cadratins) : une ligne six fois trop
 *     grande.
 *
 * ## La regle retenue
 *
 * Une **taille unique par page**, deduite de la **mediane** des avances de la
 * page — la valeur que partage la majorite des lignes, donc la mesure du
 * calligraphe. Une ligne plus longue que cette mediane est reduite juste assez
 * pour tenir : c'est le seul cas ou une ligne s'ecarte de la taille de sa page,
 * et il ne peut pas faire deborder le cadre.
 *
 * La mediane plutot que le maximum, et c'est mesure : sur la page 599, deux
 * emplacements portent une avance aberrante de 49 718 et 50 893 unites quand la
 * mediane vaut 40 416. Ancrer la page sur le maximum la rapetissait de 10 % tout
 * entiere ; ancree sur la mediane, elle tombe sur l'imprime a 0,3 % pres. Sur la
 * page 3, l'ecart median passe de 1,1 % a 0,2 %. La preuve est
 * `outils/prouver-composition-page.py`, qui confronte la prevision a la page
 * imprimee emplacement par emplacement.
 */

/** En dessous, la page ne serait plus lisible ; au-dessus, elle ne tiendrait plus. */
export const TAILLE_MINIMALE = 8;
export const TAILLE_MAXIMALE = 96;

function mediane(valeurs: readonly number[]): number {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  if (triees.length % 2 === 1) {
    return triees[milieu] ?? 0;
  }
  return ((triees[milieu - 1] ?? 0) + (triees[milieu] ?? 0)) / 2;
}

/**
 * L'avance qui sert de mesure a la page, en unites de dessin.
 *
 * C'est la mediane des avances de ses lignes. Rendre 0 (ou une valeur non
 * finie) signifie « page sans avance exploitable » : l'appelant retombe alors
 * sur une taille deduite de la hauteur de ligne.
 */
export function avanceDeReference(avances: readonly number[]): number {
  const valides = avances.filter((v) => Number.isFinite(v) && v > 0);
  if (valides.length === 0) {
    return 0;
  }
  return mediane(valides);
}

/**
 * La taille de police de la page, en points.
 *
 * `largeur` est la largeur de texte disponible. Une ligne d'avance mediane tombe
 * donc exactement sur cette largeur, et les autres lignes occupent la fraction
 * de largeur que le calligraphe leur a donnee.
 */
export function taillePolicePage(
  avances: readonly number[],
  upem: number,
  largeur: number,
): number {
  if (!Number.isFinite(upem) || upem <= 0 || largeur <= 0) {
    return 0;
  }
  const reference = avanceDeReference(avances);
  if (reference <= 0) {
    return 0;
  }
  return borner((largeur * upem) / reference);
}

/**
 * La taille d'une ligne donnee.
 *
 * Elle vaut celle de sa page, sauf si la ligne est plus longue que la reference
 * — auquel cas elle est reduite juste assez pour tenir dans le cadre. Ce cas ne
 * se produit que sur les pages ou une avance aberrante cotoie des avances
 * normales.
 */
export function tailleLigne(
  tailleDeLaPage: number,
  avance: number,
  upem: number,
  largeur: number,
): number {
  if (tailleDeLaPage <= 0) {
    return 0;
  }
  if (!Number.isFinite(avance) || avance <= 0 || upem <= 0 || largeur <= 0) {
    return tailleDeLaPage;
  }
  return borner(Math.min(tailleDeLaPage, (largeur * upem) / avance));
}

/** La fraction de la largeur qu'occupe une ligne : 1 pour une ligne pleine. */
export function partDeLaLargeur(
  avance: number,
  reference: number,
  tailleDeLaPage: number,
  tailleDeLaLigne: number,
): number {
  if (!Number.isFinite(avance) || avance <= 0 || reference <= 0 || tailleDeLaPage <= 0) {
    return 0;
  }
  return (avance * tailleDeLaLigne) / (reference * tailleDeLaPage);
}

function borner(taille: number): number {
  if (!Number.isFinite(taille) || taille <= 0) {
    return 0;
  }
  return Math.min(TAILLE_MAXIMALE, Math.max(TAILLE_MINIMALE, taille));
}
