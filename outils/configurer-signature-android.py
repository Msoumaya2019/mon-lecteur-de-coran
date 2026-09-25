#!/usr/bin/env python3
"""
Applique la signature de publication au projet Android engendre par `expo prebuild`.

Pourquoi un script, et pas un `sed` dans le YAML
------------------------------------------------

`android/` n'est pas versionne : il est regenere a chaque compilation, et la
correction de signature doit donc etre refaite a chaque fois, sur un fichier qui
n'existe pas encore. Un `sed` ecrit a meme le flux serait inverifiable : le jour
ou le modele d'Expo change, il ne ferait plus rien -- silencieusement -- et l'APK
sortirait signe avec la cle de debogage alors que tout le monde le croit signe
avec la cle de publication.

Ce que fait le script
---------------------

  1. ecrit le fichier de cle decode depuis le base64 ;
  2. insere un bloc `release` dans `signingConfigs` ;
  3. fait pointer `buildTypes.release` vers `signingConfigs.release` ;
  4. RELIT le fichier et refuse de continuer si l'une des deux substitutions
     n'a pas eu lieu.

Les mots de passe passent par `System.getenv`, jamais par un
`gradle.properties` : ce fichier serait ecrit sur le disque de l'executeur et
pourrait se retrouver dans une archive d'artefacts. L'environnement, lui,
disparait avec la machine.

Variables d'environnement
-------------------------

  ANDROID_KEYSTORE_BASE64      le magasin, encode en base64          (secret)
  ANDROID_KEYSTORE_PASSWORD    le mot de passe du magasin            (secret)
  ANDROID_KEY_ALIAS            l'alias de la cle                      (secret)
  ANDROID_KEY_PASSWORD         le mot de passe de la cle             (secret)
  ANDROID_BUILD_GRADLE         chemin de `build.gradle`   (defaut : android/app/build.gradle)
  ANDROID_KEYSTORE_DEST        ou ecrire le magasin       (defaut : android/app/release.keystore)

Sorties
-------

  GITHUB_OUTPUT  mode=publication  ou  mode=debogage
  GITHUB_ENV     ANDROID_KEYSTORE_PATH  (chemin absolu, lu par Gradle)

Sans aucune variable de signature, le script ne touche a RIEN et annonce le mode
« debogage » : c'est le cas normal d'un premier essai, et le gabarit d'Expo
signe alors le release avec sa cle de debogage, stable et publique.
"""

from __future__ import annotations

import base64
import binascii
import os
import sys
from pathlib import Path

SECRETS = (
    "ANDROID_KEYSTORE_BASE64",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
)

BLOC_RELEASE = """        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
"""


def erreur(message: str) -> None:
    print(f"::error::{message}", file=sys.stderr)
    sys.exit(1)


def declarer(nom: str, valeur: str) -> None:
    """Ecrit dans le fichier que GitHub designe, s'il est defini."""
    chemin = os.environ.get(nom)
    if not chemin:
        return
    with open(chemin, "a", encoding="utf-8", newline="\n") as fichier:
        fichier.write(valeur + "\n")


def decoder_magasin(valeur: str) -> bytes:
    """Decode le base64 du magasin, en refusant les formes qui produiraient un fichier corrompu."""
    # `base64` coupe sa sortie en lignes de 76 caracteres : retirer les blancs
    # est le traitement normal, pas une tolerance.
    brut = valeur.replace("\n", "").replace("\r", "").replace(" ", "").replace("\t", "")

    if "-" in brut or "_" in brut:
        erreur(
            "ANDROID_KEYSTORE_BASE64 emploie l'alphabet base64 « URL » (- et _). "
            "Le decoder produirait un fichier de cle corrompu, et l'erreur n'apparaitrait "
            "qu'a la signature. Reencoder avec : base64 -w0 release.keystore"
        )

    try:
        octets = base64.b64decode(brut, validate=True)
    except (binascii.Error, ValueError) as exception:
        erreur(f"ANDROID_KEYSTORE_BASE64 n'est pas du base64 valide : {exception}")

    if octets.startswith(b"-----BEGIN"):
        erreur(
            "Le contenu decode commence par « -----BEGIN » : c'est un CERTIFICAT, pas un "
            "fichier de cle. `keytool -exportcert` produit un PEM, et la confusion est facile. "
            "Encoder le magasin lui-meme (release.keystore), pas un certificat exporte."
        )

    return octets


def inserer_bloc_release(lignes: list[str]) -> list[str]:
    """Insere le bloc `release` juste apres l'ouverture de `signingConfigs`."""
    for rang, ligne in enumerate(lignes):
        if ligne.strip().startswith("signingConfigs {"):
            return lignes[: rang + 1] + BLOC_RELEASE.split("\n")[:-1] + lignes[rang + 1 :]
    erreur(
        "Le bloc « signingConfigs { » est introuvable dans build.gradle. Le modele d'Expo a "
        "change : la substitution ne peut pas etre appliquee, et continuer produirait un APK "
        "signe avec la cle de debogage en le faisant passer pour signe."
    )
    return lignes  # inaccessible : `erreur` termine le processus


def rediriger_release(lignes: list[str]) -> list[str]:
    """Fait pointer `buildTypes.release` vers `signingConfigs.release`, et lui seul."""
    depart = next(
        (rang for rang, ligne in enumerate(lignes) if ligne.strip().startswith("buildTypes {")),
        None,
    )
    if depart is None:
        erreur("Le bloc « buildTypes { » est introuvable dans build.gradle.")

    ouverture = next(
        (
            rang
            for rang in range(depart, len(lignes))
            if lignes[rang].strip().startswith("release {")
        ),
        None,
    )
    if ouverture is None:
        erreur("Le bloc « release { » est introuvable dans « buildTypes { ».")

    for rang in range(ouverture, len(lignes)):
        if "signingConfig signingConfigs.debug" in lignes[rang]:
            # L'indentation est conservee : la ligne d'origine est reecrite a
            # l'identique, seul le nom de la configuration change.
            lignes[rang] = lignes[rang].replace(
                "signingConfig signingConfigs.debug", "signingConfig signingConfigs.release"
            )
            return lignes

    erreur(
        "Aucune ligne « signingConfig signingConfigs.debug » dans « buildTypes.release » : "
        "la substitution n'a pas de cible."
    )
    return lignes  # inaccessible


def main() -> int:
    presents = [nom for nom in SECRETS if os.environ.get(nom)]
    absents = [nom for nom in SECRETS if not os.environ.get(nom)]

    # Aucune variable : premier essai, ou compilation de validation. On ne touche
    # a rien, et on le dit.
    if not presents:
        print(
            "Aucun secret ANDROID_KEYSTORE_* fourni : le release sera signe avec la cle de "
            "debogage du gabarit Expo. Elle est stable d'une compilation a l'autre, l'APK se "
            "reinstalle donc par-dessus le precedent — mais elle est publique, et l'AAB ne "
            "sera pas accepte par Google Play."
        )
        declarer("GITHUB_OUTPUT", "mode=debogage")
        return 0

    # Une configuration partielle doit echouer : continuer produirait un APK
    # signe avec la cle de debogage alors que l'utilisateur croit l'avoir signe.
    if absents:
        erreur(
            "Configuration de signature incomplete : "
            + ", ".join(absents)
            + " "
            + ("est absente" if len(absents) == 1 else "sont absentes")
            + ". Les quatre variables sont necessaires ensemble."
        )

    chemin_gradle = Path(os.environ.get("ANDROID_BUILD_GRADLE", "android/app/build.gradle"))
    if not chemin_gradle.is_file():
        erreur(f"{chemin_gradle} est introuvable : lancer `expo prebuild` avant ce script.")

    destination = Path(
        os.environ.get("ANDROID_KEYSTORE_DEST", str(chemin_gradle.parent / "release.keystore"))
    ).resolve()

    octets = decoder_magasin(os.environ["ANDROID_KEYSTORE_BASE64"])
    destination.write_bytes(octets)
    print(f"Magasin ecrit : {destination} ({len(octets)} octets)")

    original = chemin_gradle.read_text(encoding="utf-8")
    lignes = inserer_bloc_release(original.split("\n"))
    lignes = rediriger_release(lignes)
    chemin_gradle.write_text("\n".join(lignes), encoding="utf-8", newline="\n")

    # La relecture est le seul controle qui prouve quelque chose : ni le succes
    # de l'ecriture, ni celui de Gradle ne disent QUELLE cle a signe.
    relu = chemin_gradle.read_text(encoding="utf-8")
    if "signingConfigs.release" not in relu:
        erreur("La relecture ne trouve pas « signingConfigs.release » : la substitution n'a pas pris.")
    if "signingConfig signingConfigs.debug" not in relu:
        erreur(
            "La relecture ne trouve plus la signature de debogage : la substitution a deborde "
            "sur le type `debug`, qui doit rester signe avec la cle de debogage."
        )

    # Le chemin doit etre ABSOLU : le fichier de projet Gradle vit dans
    # `android/app/`, et un chemin relatif s'y resoudrait de travers.
    declarer("GITHUB_ENV", f"ANDROID_KEYSTORE_PATH={destination}")
    declarer("GITHUB_OUTPUT", "mode=publication")
    print("Signature de publication appliquee, et relue.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
