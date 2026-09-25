#!/usr/bin/env node
/**
 * Extrait la liste des schémas de la sortie de `xcodebuild -list -json`.
 *
 * `xcodebuild` entoure parfois son JSON d'avertissements, et un `JSON.parse`
 * direct échoue. Sous `bash -e`, l'échec du tuyau interromprait l'étape, et le
 * défaut serait attribué au projet plutôt qu'à la lecture.
 *
 * Ce script **confirme** un nom de schéma, il ne le choisit pas : le schéma est
 * déduit du nom du `.xcodeproj`. Il ne sort donc jamais en erreur. Une liste
 * illisible doit faire avertir l'appelant, pas casser une compilation valide —
 * un contrôle de confort qui refuse un build correct coûte plus cher que le
 * défaut qu'il surveille.
 *
 * Seuls les `schemes` sont rendus, jamais les `targets` : une cible n'est pas un
 * schéma, et confondre les deux ferait passer le contrôle sur une valeur qui ne
 * peut pas être compilée.
 *
 * Usage : xcodebuild -list -json | node outils/lire-schemas-xcodebuild.mjs
 */

import { readFileSync } from 'node:fs';

const texte = readFileSync(0, 'utf8');

// Chercher le premier `{` et le dernier `}` : c'est ce qui rend la lecture
// tolérante au bruit qui précède ou suit le JSON.
const debut = texte.indexOf('{');
const fin = texte.lastIndexOf('}');

if (debut >= 0 && fin > debut) {
  let donnees;
  try {
    donnees = JSON.parse(texte.slice(debut, fin + 1));
  } catch {
    donnees = null;
  }

  // La forme diffère selon qu'Expo a produit un espace de travail CocoaPods ou
  // un projet Xcode simple : le nom de la racine change, les schémas non.
  const racine = donnees?.project ?? donnees?.workspace ?? null;
  for (const nom of racine?.schemes ?? []) {
    if (typeof nom === 'string' && nom !== '') console.log(nom);
  }
}
