# Mon lecteur de Coran

Un **mushaf numérique** pour iPhone, iPad et Android. Pas une application qui
empile des versets : la page du mushaf telle qu'elle est imprimée, avec ses
lignes, sa calligraphie, ses médaillons de numéro de verset et ses bandeaux de
sourate — et, posées par-dessus, quelques fonctions modernes choisies pour ne
jamais gêner la lecture.

La règle qui gouverne chaque décision : *est-ce que cette fonctionnalité gêne la
lecture du mushaf ?* Si oui, elle est rendue plus discrète.

---

## Ce que fait l'application

- **604 pages** du mushaf de Médine, rendues avec les polices QCF : une police
  par page, et les codes de caractères propres à cette page.
- **Navigation par balayage horizontal**, dans le sens de lecture arabe.
- **Récitation verset par verset**, sept récitants, répétition 1×/2×/3×/5×/boucle
  et répétition d'un passage (par exemple 2:255 → 2:257).
- **Surlignage du verset en cours**, qui suit la récitation sans dénaturer la
  page.
- **Traduction française** à la demande ou en continu (Hamidullah, Montada,
  Rashid Maash), en panneau ou sous le verset.
- **Favoris, signets et reprise de lecture** — « Continuer ma lecture » ramène
  exactement à la dernière page.
- **Fonctionnement hors ligne progressif** : les pages lues sont mises en cache,
  les polices sont téléchargées à la demande puis conservées.

L'écran de lecture n'affiche **ni barre de navigation, ni en-tête, ni lecteur
audio permanent**. Un appui fait apparaître deux boutons discrets — audio et
traduction — qui s'effacent au bout de quelques secondes.

---

## Démarrer

```bash
npm install
npm start          # serveur de développement Expo
npm run ios        # ouvre sur iOS
npm run android    # ouvre sur Android
```

### Vérifier

```bash
npm run verifier       # contrôle des flux + types + 132 épreuves
npm run verifier:flux  # analyse statique de .github/workflows
npm run eprouver:flux  # falsifie ce contrôle, pour prouver qu'il détecte
npm run typecheck      # tsc --noEmit
npm test               # node --test
```

---

## Arborescence

```
src/
  app/                 écrans (expo-router : chaque fichier est une route)
  components/          composants réutilisables
    moushaf/           rendu de la page, des lignes, des médaillons
    ui/                feuille basse, boutons, commandes
  constants/           thème, récitants, traductions, polices
  donnees/             tables engendrées (métriques des 604 pages, juz)
  lib/                 fonctions pures (versets, texte)
  services/
    http.ts            couche réseau commune
    quran/             API du Coran, assemblage des pages, sourates
    mushaf/            métriques de page, juz, polices QCF
    audio/             moteur de récitation
    storage/           cache, favoris, réglages, position de lecture
  types/               types du domaine
outils/                scripts hors application (voir plus bas)
tests/                 épreuves, fixtures d'API réelles, bancs
```

---

## Comment la page du mushaf est reconstruite

Le point le plus délicat du projet, et celui qui a demandé le plus de mesures.

**Les polices QCF sont propres à chaque page.** Le point de code `U+FC41`
désigne « قُلْ » sur la page 604 et « الم » sur la page 2. Une page = une police =
un jeu de codes. Employer la mauvaise police produit de l'arabe parfaitement
lisible et parfaitement faux — silencieusement.

Deux éditions coexistent, et le choix se mesure :

| Édition | Codes | Unités par cadratin | Pages |
| --- | --- | --- | --- |
| `v4` | `code_v2` | 2500 | 599 |
| `v1` | `code_v1` | 2048 | 5 (121, 533, 534, 568, 570) |

L'API fournit, pour chaque mot, sa ligne (`line_number`), sa position et son
avance mesurée. La taille de police d'une ligne se déduit donc exactement —
`largeur × cadratin / avance` — sans aucun algorithme de justification : le
calligraphe a déjà justifié chaque ligne, et l'écart mesuré entre lignes d'une
même page reste sous 3 %.

`outils/generer-metriques-moushaf.py` engendre `src/donnees/moushaf-metriques.json`
(604 pages) en vérifiant page par page que les codes employés existent bien dans
la table de caractères de la police choisie.

**Les juz ne se déduisent pas.** Le `juz_number` d'une page est celui de son
*premier* verset : la page 121 porte 5:77–5:82, et c'est 5:82 qui ouvre le juz 7.
Déduire la page d'ouverture d'un juz de « la première page où il apparaît »
donnait **quatre juz faux sur trente** (4, 7, 11, 26). La table vient donc de
`/juzs`, engendrée par `outils/generer-juz.py`, qui refuse de continuer si les
deux copies que l'API renvoie de chaque juz divergent.

---

## Compilations

Toutes les compilations sont **manuelles** (`workflow_dispatch`) : vingt minutes
par compilation native, à ne pas dépenser à chaque poussée. Seule l'intégration
continue tourne sans geste.

| Flux | Produit | Compte requis |
| --- | --- | --- |
| `ci.yml` | types, épreuves, analyse des flux, empaquetage | aucun |
| `android-apk.yml` | `mon-lecteur-de-coran.apk` et `.aab` | aucun |
| `ios-unsigned.yml` | `mon-lecteur-de-coran.ipa` (appareil, non signé) | aucun |
| `eas-build.yml` | artefact EAS signé | compte Expo + `EXPO_TOKEN` |

### Android

L'APK est signé avec la **clé de débogage du gabarit Expo**, faute de secrets
`ANDROID_KEYSTORE_*`. Cette clé est **stable** d'une compilation à l'autre —
mesuré : `221e0a31…` aux deux générations — donc l'APK se réinstalle par-dessus
le précédent, sans perte de données.

Mais elle est **publique et identique pour tous les projets Expo** : elle
convient pour valider, jamais pour distribuer, et l'AAB ne sera pas accepté par
Google Play. Pour signer pour de bon, créer un magasin de clés et poser quatre
secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) ; `outils/configurer-signature-android.py`
applique alors la substitution, la relit, et **refuse de continuer** si elle n'a
pas pris.

### iOS

L'IPA est compilé **pour l'appareil**, sans signature. Un IPA non signé ne
s'installe pas : iOS vérifie la signature et refuse ce qui en est dépourvu. Le
fichier est un produit intermédiaire, à re-signer ensuite.

Trois obstacles, dont aucun message d'erreur ne nomme la cause :

1. **Mode développeur obligatoire** depuis iOS 16 — Réglages → Confidentialité et
   sécurité → Mode développeur, puis redémarrer.
2. **Le mot de passe d'application est refusé** avec un compte Apple gratuit : il
   faut le mot de passe principal, puis le code à six chiffres.
3. **Sous Windows, iTunes doit venir du site d'Apple** — la version du Microsoft
   Store n'installe pas les pilotes de l'appareil.

Le flux `eas-build.yml` compile pour le **simulateur** quand aucun identifiant
Apple n'est fourni, et livre alors une archive `.tar.gz` — jamais un IPA. Renommer
le fichier n'en ferait pas un IPA, et un binaire de simulateur ne s'installera sur
aucun iPhone, même re-signé.

### Version

`expo.version` vit dans `app.json` et **ne bouge pas tout seul**. Le flux le lit
pour nommer son fichier et le rappeler dans son résumé. Avant de publier, monter
`expo.version`, `android.versionCode` et `ios.buildNumber` ensemble.

---

## Outils

| Script | Rôle |
| --- | --- |
| `verifier-flux.mjs` | analyse statique de `.github/workflows` — YAML, `bash -n` sur chaque `run:`, épinglage des actions, permissions effectives, sorties d'étape, liste fermée des flux |
| `eprouver-verifier-flux.py` | falsifie le précédent : 15 cas, chacun devant produire le marqueur attendu, restauration prouvée par empreinte SHA-256 |
| `configurer-signature-android.py` | applique la signature de publication au projet natif engendré, et relit sa substitution |
| `lire-schemas-xcodebuild.mjs` | extrait les schémas de la sortie de `xcodebuild -list -json`, tolérant au bruit |
| `generer-metriques-moushaf.py` | engendre les métriques des 604 pages depuis l'API |
| `generer-juz.py` | engendre la table des 30 juz depuis `/juzs` |
| `generer-icones.py` | dessine les icônes (motif géométrique, non figuratif) |
| `chargeur-tests.mjs`, `enregistrer-tests.mjs` | permettent à `node --test` de charger du TypeScript, l'alias `@/`, le JSON et un faux stockage |

---

## Sources et droits

Le texte coranique, les traductions et les polices proviennent de l'API de
Quran.com / Quran Foundation. La police **Amiri Quran** est sous SIL Open Font
License (voir `assets/polices/OFL.txt`). Le code de cette application est sous
licence MIT (voir `LICENSE`) ; cette licence ne couvre ni le texte coranique, ni
les traductions, ni les polices.
