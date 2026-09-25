#!/usr/bin/env python3
"""
Verifie qu'un APK porte un bloc de signature, et dit quelle cle l'a signe.

Pourquoi un script, et pas un `grep` dans les derniers kilo-octets
------------------------------------------------------------------

La signature v2 d'un APK vit dans un bloc place **entre la derniere entree du
ZIP et le repertoire central**. La magie « APK Sig Block 42 » ferme ce bloc :
elle est donc suivie du repertoire central entier, puis de l'enregistrement de
fin.

Un APK universel d'Expo embarque quatre architectures — plusieurs centaines
d'entrees, et un repertoire central de plusieurs dizaines de kilo-octets.
Chercher la magie dans les 4096 derniers octets **ne la trouve pas** sur un APK
signe. Mesure le 25 septembre 2026 : le flux a accuse un APK parfaitement signe
d'etre sans signature, et s'est arrete avant de publier quoi que ce soit, apres
vingt-trois minutes de compilation. Le diagnostic etait faux, et il venait du
controle, pas du fichier.

La lecture juste passe par la structure : l'enregistrement de fin du ZIP donne
l'offset du repertoire central, et la magie se lit exactement seize octets avant
lui. C'est exact, et cela ne depend d'aucune taille de fenetre.

Ce que le script rend
---------------------

  - code de sortie 1, avec un message qui nomme la cause, si le bloc est absent ;
  - sur la sortie standard, de quoi dire avec QUELLE cle l'APK a ete signe :

        signature=presente
        signataires=1
        certificat_sha256=<empreinte>
        certificat_octets=<taille>

Usage : python3 outils/verifier-signature-apk.py chemin/vers/app-release.apk
"""

from __future__ import annotations

import hashlib
import struct
import sys
from pathlib import Path

MAGIE = b"APK Sig Block 42"
IDENTIFIANT_V2 = 0x7109871A
SIGNATURE_FIN = b"PK\x05\x06"
# L'enregistrement de fin fait 22 octets, plus un commentaire de 65535 au plus.
FENETRE_FIN = 22 + 65535


def erreur(message: str) -> None:
    print(f"::error::{message}", file=sys.stderr)
    sys.exit(1)


def offset_repertoire_central(donnees: bytes) -> int:
    """Lit l'offset du repertoire central dans l'enregistrement de fin du ZIP."""
    fenetre = donnees[-FENETRE_FIN:]
    base = len(donnees) - len(fenetre)
    for position in range(len(fenetre) - 22, -1, -1):
        if fenetre[position : position + 4] == SIGNATURE_FIN:
            (offset,) = struct.unpack_from("<I", fenetre, position + 16)
            if offset == 0xFFFFFFFF:
                erreur(
                    "L'archive emploie le format ZIP64 : l'offset du repertoire central n'est pas "
                    "dans l'enregistrement de fin. Ce controle ne sait pas encore le lire — le dire "
                    "plutot que de conclure a tort."
                )
            return base + position, offset
    erreur("Aucun enregistrement de fin de ZIP trouve : le fichier n'est pas une archive ZIP.")
    return 0, 0  # inaccessible : `erreur` termine le processus


def extraire_certificat(valeur_v2: bytes) -> bytes:
    """Rend le premier certificat de signataire du bloc v2, ou des octets vides."""
    try:
        (taille_signataire,) = struct.unpack_from("<I", valeur_v2, 0)
        signataire = valeur_v2[4 : 4 + taille_signataire]

        (taille_signee,) = struct.unpack_from("<I", signataire, 0)
        signe = signataire[4 : 4 + taille_signee]

        (taille_digests,) = struct.unpack_from("<I", signe, 0)
        position = 4 + taille_digests

        (taille_certificats,) = struct.unpack_from("<I", signe, position)
        position += 4
        certificats = signe[position : position + taille_certificats]

        (taille_certificat,) = struct.unpack_from("<I", certificats, 0)
        return certificats[4 : 4 + taille_certificat]
    except struct.error:
        return b""


def main() -> int:
    if len(sys.argv) != 2:
        erreur("Usage : verifier-signature-apk.py <chemin.apk>")

    chemin = Path(sys.argv[1])
    if not chemin.is_file():
        erreur(f"{chemin} est introuvable.")

    donnees = chemin.read_bytes()
    position_fin, offset_central = offset_repertoire_central(donnees)

    if offset_central < 32 or offset_central > len(donnees):
        erreur(
            f"L'offset du repertoire central ({offset_central}) sort des limites du fichier "
            f"({len(donnees)} octets)."
        )

    if donnees[offset_central - 16 : offset_central] != MAGIE:
        # Le dire sans detour : c'est le defaut qui rend l'APK ininstallable, et
        # il ne se voit ni dans le journal de compilation, ni a la taille du
        # fichier. Android le refusera.
        erreur(
            "L'APK ne porte aucun bloc de signature (magie « APK Sig Block 42 » absente juste "
            "avant le repertoire central) : Android le refusera a l'installation. "
            "Verifier que `buildTypes.release` pointe bien vers une `signingConfig`."
        )

    # La taille annoncée par le bloc couvre les paires, le SECOND champ de taille
    # et la magie — elle ne couvre pas le premier champ. Le bloc occupe donc
    # [offset_central - (taille + 8), offset_central), et les paires commencent
    # juste après le premier champ de taille.
    #
    # S'être trompé d'un facteur sur cette convention ne se voit pas sur une
    # archive fabriquée par le même esprit : le banc construisait son bloc avec
    # la même erreur, et validait donc un lecteur faux. C'est un APK réel qui l'a
    # montré — le bloc y annonçait 16 376 octets, et le lecteur n'y trouvait
    # aucune paire.
    (taille_bloc,) = struct.unpack_from("<Q", donnees, offset_central - 24)
    debut_bloc = offset_central - taille_bloc - 8
    if debut_bloc < 0:
        erreur(f"Le bloc de signature annonce {taille_bloc} octets, ce qui depasse le fichier.")

    # Les deux champs de taille doivent s'accorder : c'est la marque d'un bloc
    # bien formé, et le seul contrôle indépendant qu'on puisse faire sur lui.
    (taille_basse,) = struct.unpack_from("<Q", donnees, debut_bloc)
    if taille_basse != taille_bloc:
        erreur(
            "Les deux champs de taille du bloc de signature divergent "
            f"({taille_basse} et {taille_bloc}) : le bloc est mal forme."
        )

    # Parcourir les paires (identifiant, valeur).
    position = debut_bloc + 8
    limite = offset_central - 24
    certificat = b""
    identifiants: list[str] = []

    while position + 12 <= limite:
        (longueur,) = struct.unpack_from("<Q", donnees, position)
        if longueur < 4 or position + 8 + longueur > limite:
            break
        (identifiant,) = struct.unpack_from("<I", donnees, position + 8)
        identifiants.append(f"0x{identifiant:08x}")
        if identifiant == IDENTIFIANT_V2:
            valeur = donnees[position + 12 : position + 8 + longueur]
            certificat = extraire_certificat(valeur)
        position += 8 + longueur

    print("signature=presente")
    print(f"bloc_octets={taille_bloc}")
    print(f"paires={','.join(identifiants) if identifiants else 'aucune'}")

    if certificat:
        print(f"certificat_sha256={hashlib.sha256(certificat).hexdigest()}")
        print(f"certificat_octets={len(certificat)}")
    else:
        # Le bloc existe mais le certificat n'a pas pu etre lu : le dire, plutot
        # que de laisser croire a une identification.
        print("certificat_sha256=illisible")
        print("certificat_octets=0")
        print("::warning::Le bloc de signature est present, mais le certificat v2 n'a pas pu etre lu.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
