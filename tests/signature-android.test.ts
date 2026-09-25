/**
 * Épreuves de `outils/configurer-signature-android.py`.
 *
 * Ce script s'exécute sur un projet `android/` qui n'existe pas encore au moment
 * où on l'écrit : il est engendré par `expo prebuild` dans l'exécuteur, puis
 * patché, puis compilé vingt minutes durant. Une substitution qui ne prend pas
 * ne se voit donc nulle part — l'APK sort signé avec la clé de débogage, tout
 * le monde le croit signé avec la clé de publication, et le défaut n'apparaît
 * qu'au refus d'une mise à jour, des mois plus tard.
 *
 * La fixture est le bloc RÉEL écrit par `expo prebuild` sur Expo SDK 57, capturé
 * dans ce dépôt. Les cas portent sur les décisions du script : ne rien toucher
 * sans secrets, refuser une configuration partielle, refuser un certificat
 * déguisé en magasin, et RELIRE le fichier après substitution.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../outils/configurer-signature-android.py', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./donnees/build-gradle-bloc-signature.txt', import.meta.url));

const SECRETS = {
  ANDROID_KEYSTORE_BASE64: Buffer.from('magasin-de-test').toString('base64'),
  ANDROID_KEYSTORE_PASSWORD: 'mot-de-passe-du-magasin',
  ANDROID_KEY_ALIAS: 'alias-de-test',
  ANDROID_KEY_PASSWORD: 'mot-de-passe-de-la-cle',
};

const NOMS = [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
];

const empreinte = (chemin: string) =>
  createHash('sha256').update(readFileSync(chemin)).digest('hex');

function lancer(secrets: Record<string, string> | null, contenuGradle?: string) {
  const dossier = mkdtempSync(join(tmpdir(), 'signature-'));
  const gradle = join(dossier, 'build.gradle');
  const magasin = join(dossier, 'release.keystore');
  const sortie = join(dossier, 'sortie.txt');
  const environnement = join(dossier, 'environnement.txt');

  writeFileSync(gradle, contenuGradle ?? readFileSync(FIXTURE));
  writeFileSync(sortie, '');
  writeFileSync(environnement, '');

  const variables: NodeJS.ProcessEnv = {
    ...process.env,
    ANDROID_BUILD_GRADLE: gradle,
    ANDROID_KEYSTORE_DEST: magasin,
    GITHUB_OUTPUT: sortie,
    GITHUB_ENV: environnement,
  };
  for (const nom of NOMS) delete variables[nom];
  Object.assign(variables, secrets ?? {});

  const resultat = spawnSync('python3', [SCRIPT], { env: variables, encoding: 'utf8' });

  return {
    dossier,
    resultat,
    gradle,
    magasin,
    sortie: readFileSync(sortie, 'utf8'),
    environnement: readFileSync(environnement, 'utf8'),
    nettoyer: () => rmSync(dossier, { recursive: true, force: true }),
  };
}

function eprouver(secrets: Record<string, string> | null, contenuGradle?: string) {
  const essai = lancer(secrets, contenuGradle);
  if (essai.resultat.error) {
    throw new Error(
      `« python3 » est introuvable : ce script ne peut pas être éprouvé (${essai.resultat.error.message}).`,
    );
  }
  return essai;
}

describe('configurer-signature-android', () => {
  it('ne touche à rien sans secrets, et annonce le mode débogage', () => {
    const essai = eprouver(null);
    try {
      assert.equal(essai.resultat.status, 0, essai.resultat.stderr);
      assert.match(essai.sortie, /^mode=debogage$/m);
      assert.equal(empreinte(essai.gradle), empreinte(FIXTURE), 'le fichier doit rester identique à l\'octet');
      assert.equal(essai.environnement, '', 'aucun chemin de magasin ne doit être exporté');
    } finally {
      essai.nettoyer();
    }
  });

  it('refuse une configuration partielle, en nommant la variable absente', () => {
    const essai = eprouver({ ANDROID_KEYSTORE_BASE64: SECRETS.ANDROID_KEYSTORE_BASE64 });
    try {
      assert.equal(essai.resultat.status, 1);
      assert.match(essai.resultat.stderr, /ANDROID_KEYSTORE_PASSWORD/);
      assert.equal(empreinte(essai.gradle), empreinte(FIXTURE));
    } finally {
      essai.nettoyer();
    }
  });

  it('refuse le base64 d\'alphabet URL', () => {
    // Le décoder produirait un magasin corrompu, et l'erreur n'apparaîtrait
    // qu'à la signature.
    const essai = eprouver({ ...SECRETS, ANDROID_KEYSTORE_BASE64: 'YWJj-ZGVm' });
    try {
      assert.equal(essai.resultat.status, 1);
      assert.match(essai.resultat.stderr, /URL/);
    } finally {
      essai.nettoyer();
    }
  });

  it('refuse un certificat déguisé en magasin', () => {
    const pem = Buffer.from('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n');
    const essai = eprouver({ ...SECRETS, ANDROID_KEYSTORE_BASE64: pem.toString('base64') });
    try {
      assert.equal(essai.resultat.status, 1);
      assert.match(essai.resultat.stderr, /CERTIFICAT/);
    } finally {
      essai.nettoyer();
    }
  });

  it('applique la signature de publication, et la relit', () => {
    const essai = eprouver(SECRETS);
    try {
      assert.equal(essai.resultat.status, 0, essai.resultat.stderr);
      assert.match(essai.sortie, /^mode=publication$/m);

      const gradle = readFileSync(essai.gradle, 'utf8');

      // Le bloc `release` a été inséré dans `signingConfigs`…
      assert.match(gradle, /signingConfigs\.release/);
      assert.match(gradle, /storeFile file\(System\.getenv\("ANDROID_KEYSTORE_PATH"\)\)/);

      // …et `buildTypes.release` pointe bien dessus.
      const blocRelease = gradle.slice(gradle.indexOf('buildTypes {'));
      assert.match(blocRelease, /signingConfig signingConfigs\.release/);

      // Le type `debug` doit rester signé avec la clé de débogage : une
      // substitution trop large casserait les compilations de développement.
      assert.equal(
        (gradle.match(/signingConfig signingConfigs\.debug/g) ?? []).length,
        1,
        'seule la signature de `debug` doit rester en débogage',
      );

      // Aucun mot de passe ne doit être écrit dans le fichier du projet : ils
      // passent par l'environnement, qui disparaît avec l'exécuteur.
      assert.doesNotMatch(gradle, /mot-de-passe/);
      assert.match(gradle, /storePassword System\.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/);

      // Le magasin est écrit avec les octets décodés.
      assert.equal(readFileSync(essai.magasin, 'utf8'), 'magasin-de-test');

      // Le chemin exporté vers Gradle est absolu : le fichier de projet vit
      // dans `android/app/`, et un chemin relatif s'y résoudrait de travers.
      const chemin = essai.environnement.match(/^ANDROID_KEYSTORE_PATH=(.+)$/m)?.[1] ?? '';
      assert.ok(chemin !== '', 'ANDROID_KEYSTORE_PATH doit être exporté');
      assert.ok(chemin.includes(essai.dossier), `chemin attendu absolu, reçu « ${chemin} »`);
    } finally {
      essai.nettoyer();
    }
  });

  it('refuse de continuer si le modèle d\'Expo a changé', () => {
    // C'est le contrôle qui donne sa valeur au script : sans lui, une
    // substitution qui ne trouve plus son ancre laisserait passer un APK signé
    // avec la clé de débogage.
    const sansAncre = readFileSync(FIXTURE, 'utf8').replace('signingConfigs {', 'autreChose {');
    const essai = eprouver(SECRETS, sansAncre);
    try {
      assert.equal(essai.resultat.status, 1);
      assert.match(essai.resultat.stderr, /signingConfigs \{/);
    } finally {
      essai.nettoyer();
    }
  });

  it('refuse de continuer si `buildTypes` a disparu', () => {
    const sansBuildTypes = readFileSync(FIXTURE, 'utf8').replace('buildTypes {', 'autreChose {');
    const essai = eprouver(SECRETS, sansBuildTypes);
    try {
      assert.equal(essai.resultat.status, 1);
      assert.match(essai.resultat.stderr, /buildTypes/);
    } finally {
      essai.nettoyer();
    }
  });
});
