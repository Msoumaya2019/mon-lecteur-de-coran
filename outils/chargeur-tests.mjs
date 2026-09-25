/**
 * Chargeur de modules pour les tests, hors application.
 *
 * Trois obstacles se dressent quand on veut eprouver le code source avec le seul
 * `node:test`, sans ajouter d'executeur ni de transpileur :
 *
 *  1. les imports passent par l'alias `@/`, que Node ne connait pas ;
 *  2. ils omettent l'extension (`.ts`), ce que Node ne devine pas non plus ;
 *  3. les modules JSON ne s'importent qu'avec une assertion de type, que le code
 *     de l'application n'ecrit pas — TypeScript s'en charge a la compilation.
 *
 * Ce fichier resout les trois, et remplace en plus AsyncStorage par un faux en
 * memoire : c'est un module natif, absent d'un processus Node.
 *
 * Il ne sert qu'a `npm test`. L'application ne le voit jamais.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const SRC = path.join(RACINE, 'src');

/** Modules qui n'existent que sur l'appareil, remplaces par un faux. */
const FAUX = new Map([
  [
    '@react-native-async-storage/async-storage',
    path.join(ICI, 'faux-async-storage.ts'),
  ],
]);

/** Cherche un fichier source en devinant l'extension, comme le fait Metro. */
function trouver(base) {
  const candidats = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.json`,
    path.join(base, 'index.ts'),
  ];
  for (const candidat of candidats) {
    if (existsSync(candidat) && statSync(candidat).isFile()) {
      return candidat;
    }
  }
  return null;
}

export async function resolve(specifier, contexte, suivant) {
  const faux = FAUX.get(specifier);
  if (faux) {
    return { url: pathToFileURL(faux).href, shortCircuit: true };
  }

  if (specifier.startsWith('@/')) {
    const fichier = trouver(path.join(SRC, specifier.slice(2)));
    if (!fichier) {
      throw new Error(`Alias « ${specifier} » non resolu (depuis ${contexte.parentURL}).`);
    }
    return { url: pathToFileURL(fichier).href, shortCircuit: true };
  }

  // Node n'essaie aucune extension. On le laisse resoudre d'abord — c'est lui
  // qui sait traiter les paquets — et on ne devine qu'en cas d'echec. Cela
  // permet aux tests d'ecrire `'../src/lib/verset'` sans extension, comme le
  // fait deja tout le code de l'application avec `@/`.
  try {
    return await suivant(specifier, contexte);
  } catch (erreur) {
    if (!specifier.startsWith('.')) {
      throw erreur;
    }
    const base = path.resolve(path.dirname(fileURLToPath(contexte.parentURL)), specifier);
    const fichier = trouver(base);
    if (!fichier) {
      throw new Error(`Module introuvable : « ${specifier} » (depuis ${contexte.parentURL}).`);
    }
    return { url: pathToFileURL(fichier).href, shortCircuit: true };
  }
}

export async function load(url, contexte, suivant) {
  if (url.endsWith('.json')) {
    const texte = readFileSync(new URL(url), 'utf8');
    const sansBom = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(JSON.parse(sansBom))};`,
    };
  }

  // Un ecran ne se depouille pas : Node sait retirer les types, pas le JSX. Le
  // dire clairement vaut mieux qu'une erreur de syntaxe a dix lignes de loin.
  if (url.endsWith('.tsx')) {
    throw new Error(
      `JSX non eprouvable directement : ${fileURLToPath(url)}. ` +
        "Eprouvez la logique que l'ecran appelle, pas l'ecran lui-meme.",
    );
  }

  return suivant(url, contexte);
}
