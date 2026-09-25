/**
 * Épreuves de `outils/lire-schemas-xcodebuild.mjs`.
 *
 * Ce script lit la sortie de `xcodebuild -list -json` sur un exécuteur macOS,
 * quinze minutes après le début d'une compilation. Une erreur de lecture y
 * coûterait un aller-retour complet — et `xcodebuild` entoure parfois son JSON
 * d'avertissements, ce qui fait échouer un `JSON.parse` direct.
 *
 * Les cas portent donc sur ce qui se produit réellement : du bruit autour du
 * JSON, une sortie tronquée, une racine `project` ou `workspace`, et l'absence
 * de schémas. Le script ne doit JAMAIS sortir en erreur : il confirme un nom, il
 * ne le choisit pas.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../outils/lire-schemas-xcodebuild.mjs', import.meta.url));

function lire(entree: string) {
  return spawnSync(process.execPath, [SCRIPT], { input: entree, encoding: 'utf8' });
}

const schemas = (sortie: string) => sortie.split('\n').filter((ligne) => ligne !== '');

describe('lire-schemas-xcodebuild', () => {
  it('rend les schémas d\'un projet Xcode', () => {
    const resultat = lire(
      JSON.stringify({ project: { name: 'MonApp', targets: ['MonApp'], schemes: ['MonApp'] } }),
    );
    assert.equal(resultat.status, 0);
    assert.deepEqual(schemas(resultat.stdout), ['MonApp']);
  });

  it('rend les schémas d\'un espace de travail CocoaPods', () => {
    const resultat = lire(
      JSON.stringify({ workspace: { name: 'MonApp', schemes: ['MonApp', 'EXConstants'] } }),
    );
    assert.equal(resultat.status, 0);
    assert.deepEqual(schemas(resultat.stdout), ['MonApp', 'EXConstants']);
  });

  it('ignore le bruit qui entoure le JSON', () => {
    // C'est le cas mesuré : `xcodebuild` prévient avant de rendre son JSON, et
    // un `JSON.parse` direct échouerait sous `bash -e`.
    const entree = [
      '2026-09-25 12:00:00.000 xcodebuild[1234:5678] warning: Using the first of multiple matching destinations',
      'Command line invocation:',
      '    /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -list -json',
      '',
      JSON.stringify({ project: { name: 'MonApp', schemes: ['MonApp'] } }),
      '',
      '** BUILD SUCCEEDED **',
    ].join('\n');

    const resultat = lire(entree);
    assert.equal(resultat.status, 0);
    assert.deepEqual(schemas(resultat.stdout), ['MonApp']);
  });

  it('ne rend jamais les cibles à la place des schémas', () => {
    // Confondre les deux ferait passer le contrôle sur une valeur qui ne peut
    // pas être compilée : `-scheme` n'accepte pas une cible.
    const resultat = lire(JSON.stringify({ project: { name: 'MonApp', targets: ['MonApp', 'MonAppTests'] } }));
    assert.equal(resultat.status, 0);
    assert.deepEqual(schemas(resultat.stdout), []);
  });

  it('se tait sur une sortie tronquée, sans échouer', () => {
    const resultat = lire('{ "project": { "schemes": ["MonApp"');
    assert.equal(resultat.status, 0, 'une sortie illisible doit avertir, pas casser la compilation');
    assert.deepEqual(schemas(resultat.stdout), []);
  });

  it('se tait sur une entrée vide, sans échouer', () => {
    const resultat = lire('');
    assert.equal(resultat.status, 0);
    assert.deepEqual(schemas(resultat.stdout), []);
  });

  it('se tait sur un JSON valide sans schémas, sans échouer', () => {
    const resultat = lire(JSON.stringify({ project: { name: 'MonApp' } }));
    assert.equal(resultat.status, 0);
    assert.deepEqual(schemas(resultat.stdout), []);
  });

  it('ignore les noms vides ou qui ne sont pas des chaînes', () => {
    const resultat = lire(JSON.stringify({ project: { schemes: ['MonApp', '', 42, null] } }));
    assert.equal(resultat.status, 0);
    assert.deepEqual(schemas(resultat.stdout), ['MonApp']);
  });
});
