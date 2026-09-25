#!/usr/bin/env python3
"""
Eprouve `outils/verifier-signature-apk.py` en le falsifiant.

Ce controle est la seule barriere avant de remettre un APK a quelqu'un : s'il se
trompe dans le sens du refus, le flux s'arrete apres vingt-trois minutes de
compilation et il n'y a **aucun** APK ; s'il se trompe dans l'autre sens, il
laisse passer un fichier qu'Android refusera a l'installation. Il ne doit donc
pas etre cru sur parole.

Le banc fabrique de vraies archives ZIP et y insere un vrai bloc de signature v2,
par chirurgie d'octets — c'est la seule facon d'eprouver la lecture sans SDK
Android ni APK sous la main.

Le cas qui compte est le dernier : il reproduit exactement la regression mesuree
le 25 septembre 2026, ou un APK signe a ete declare sans signature parce que la
magie etait cherchee dans une fenetre de 4096 octets, alors que le repertoire
central d'un APK universel la repousse bien plus loin.

Usage : python3 outils/eprouver-verifier-signature-apk.py
"""

from __future__ import annotations

import hashlib
import io
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CONTROLE = RACINE / "outils" / "verifier-signature-apk.py"

MAGIE = b"APK Sig Block 42"
IDENTIFIANT_V2 = 0x7109871A
SIGNATURE_FIN = b"PK\x05\x06"

CERTIFICAT = bytes(range(256)) * 4  # 1024 octets, contenu arbitraire

echecs: list[str] = []
reussites = 0


def fabriquer_zip(entrees: list[tuple[str, bytes]]) -> bytes:
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_STORED) as archive:
        for nom, contenu in entrees:
            archive.writestr(nom, contenu)
    return tampon.getvalue()


def bloc_signature(certificat: bytes, avec_v2: bool = True) -> bytes:
    """Fabrique un bloc de signature conforme a la specification.

    La taille annoncee couvre les paires, le SECOND champ de taille et la magie :
    elle ne couvre pas le premier champ. C'est cette convention qui a ete lue de
    travers — par le controle ET par ce constructeur, qui portaient donc la meme
    erreur et se validaient l'un l'autre. Un APK reel a tranche, en annoncant un
    bloc de 16 376 octets ou le lecteur ne trouvait aucune paire.
    """
    if not avec_v2:
        # Un bloc valide, mais sans la paire v2 : le controle doit le dire, pas
        # inventer une identification.
        paire = struct.pack("<QI", 4 + 3, 0x42726577) + b"abc"
    else:
        certificats = struct.pack("<I", len(certificat)) + certificat
        signe = (
            struct.pack("<I", 0)  # digests : aucun
            + struct.pack("<I", len(certificats))
            + certificats
            + struct.pack("<I", 0)  # attributs : aucun
        )
        signataire = (
            struct.pack("<I", len(signe))
            + signe
            + struct.pack("<I", 0)  # signatures : aucune
            + struct.pack("<I", 0)  # cle publique : aucune
        )
        valeur_v2 = struct.pack("<I", len(signataire)) + signataire
        paire = struct.pack("<QI", len(valeur_v2) + 4, IDENTIFIANT_V2) + valeur_v2

    taille = len(paire) + 8 + 16
    return struct.pack("<Q", taille) + paire + struct.pack("<Q", taille) + MAGIE


def conformite_du_bloc(apk: bytes) -> list[str]:
    """Relit le bloc selon la specification, SANS passer par le controle.

    C'est l'oracle du banc. Sans lui, le constructeur et le controle peuvent
    partager une meme erreur et se donner raison : c'est exactement ce qui s'est
    produit, et seul un APK reel l'a montre.
    """
    fin = apk.rfind(SIGNATURE_FIN)
    if fin < 0:
        return ["aucun enregistrement de fin de ZIP"]
    (offset_central,) = struct.unpack_from("<I", apk, fin + 16)

    if apk[offset_central - 16 : offset_central] != MAGIE:
        return ["magie absente juste avant le repertoire central"]

    soucis = []
    (taille_haute,) = struct.unpack_from("<Q", apk, offset_central - 24)
    debut = offset_central - taille_haute - 8
    (taille_basse,) = struct.unpack_from("<Q", apk, debut)

    if taille_basse != taille_haute:
        soucis.append(f"les deux champs de taille divergent : {taille_basse} != {taille_haute}")
    if debut + 8 + taille_haute != offset_central:
        soucis.append("la taille annoncee ne mene pas au repertoire central")
    return soucis


def signer(archive: bytes, certificat: bytes, avec_v2: bool = True) -> bytes:
    """Insere le bloc de signature entre la derniere entree et le repertoire central."""
    donnees = bytearray(archive)
    fin = donnees.rfind(SIGNATURE_FIN)
    (offset_central,) = struct.unpack_from("<I", donnees, fin + 16)

    bloc = bloc_signature(certificat, avec_v2)
    donnees[offset_central:offset_central] = bloc

    # L'enregistrement de fin s'est deplace avec le bloc, et son offset du
    # repertoire central doit suivre — sinon l'archive est incoherente.
    fin += len(bloc)
    struct.pack_into("<I", donnees, fin + 16, offset_central + len(bloc))
    return bytes(donnees)


def lancer(contenu: bytes, nom: str = "app-release.apk"):
    dossier = Path(tempfile.mkdtemp(prefix="apk-"))
    chemin = dossier / nom
    chemin.write_bytes(contenu)
    resultat = subprocess.run(
        ["python3", str(CONTROLE), str(chemin)],
        cwd=RACINE,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return resultat, dossier


def juger(nom: str, resultat, code_attendu: int, attendus: list[str], absents: list[str]) -> None:
    global reussites
    sortie = (resultat.stdout or "") + (resultat.stderr or "")
    soucis = []
    if resultat.returncode != code_attendu:
        soucis.append(f"code de sortie {resultat.returncode}, attendu {code_attendu}")
    for attendu in attendus:
        if attendu not in sortie:
            soucis.append(f"« {attendu} » absent du rapport")
    for absent in absents:
        if absent in sortie:
            soucis.append(f"« {absent} » ne devrait pas figurer au rapport")

    if soucis:
        echecs.append(f"{nom} : " + " ; ".join(soucis))
        print(f"  ECHEC  {nom}\n         " + "\n         ".join(soucis))
    else:
        reussites += 1
        print(f"  ok     {nom}")


# ── Les cas ──────────────────────────────────────────────────────────────────

print("Verification de signature d'APK :")

petit = fabriquer_zip(
    [
        ("AndroidManifest.xml", b"\x03\x00\x08\x00manifeste"),
        ("classes.dex", b"dex\n035\x00"),
        ("assets/index.android.bundle", b"...api.quran.com..."),
    ]
)

essai, dossier = lancer(signer(petit, CERTIFICAT))
juger(
    "APK signe — la signature est trouvee",
    essai,
    0,
    [
        "signature=presente",
        f"certificat_sha256={hashlib.sha256(CERTIFICAT).hexdigest()}",
        f"certificat_octets={len(CERTIFICAT)}",
        f"0x{IDENTIFIANT_V2:08x}",
    ],
    [],
)
shutil.rmtree(dossier, ignore_errors=True)

# L'oracle, et c'est lui qui donne sa valeur au cas precedent : le bloc fabrique
# doit etre conforme a la specification, relu independamment du controle. Sans ce
# cas, le constructeur et le controle peuvent partager une meme erreur et se
# donner raison — ce qui est arrive, et seul un APK reel l'a montre.
soucis_bloc = conformite_du_bloc(signer(petit, CERTIFICAT))
if soucis_bloc:
    echecs.append("le bloc fabrique n'est pas conforme : " + " ; ".join(soucis_bloc))
    print("  ECHEC  le bloc fabrique n'est pas conforme a la specification")
else:
    reussites += 1
    print("  ok     le bloc fabrique est conforme (oracle independant du controle)")

essai, dossier = lancer(petit)
juger(
    "APK non signe — refuse, en nommant la magie",
    essai,
    1,
    ["APK Sig Block 42", "refusera a l'installation"],
    [],
)
shutil.rmtree(dossier, ignore_errors=True)

essai, dossier = lancer(b"ceci n'est pas une archive", nom="fichier.bin")
juger(
    "fichier qui n'est pas un ZIP — refuse, en le disant",
    essai,
    1,
    ["pas une archive ZIP"],
    [],
)
shutil.rmtree(dossier, ignore_errors=True)

essai, dossier = lancer(signer(petit, CERTIFICAT, avec_v2=False))
juger(
    "bloc present mais sans paire v2 — le certificat est dit illisible",
    essai,
    0,
    ["signature=presente", "certificat_sha256=illisible"],
    [],
)
shutil.rmtree(dossier, ignore_errors=True)

# ── La regression mesuree ────────────────────────────────────────────────────

# Un APK universel : quatre architectures, des centaines d'entrees. C'est ce
# volume qui repousse la magie loin de la fin du fichier.
gros = fabriquer_zip(
    [("AndroidManifest.xml", b"\x03\x00\x08\x00manifeste"), ("classes.dex", b"dex\n035\x00")]
    + [(f"lib/arm64-v8a/libreact_native_{i:04d}_jsi.so", b"\x7fELF" + bytes(64)) for i in range(200)]
    + [(f"lib/armeabi-v7a/libreact_native_{i:04d}_jsi.so", b"\x7fELF" + bytes(64)) for i in range(200)]
    + [(f"res/drawable/ressource_{i:04d}.png", b"\x89PNG" + bytes(32)) for i in range(200)]
)
signe_gros = signer(gros, CERTIFICAT)

print()
print("Regression mesuree le 25 septembre 2026 :")

# Ce que faisait le controle fautif : chercher la magie dans les 4096 derniers
# octets. Si elle y est, le cas ne mesure rien et le banc doit le dire.
if MAGIE in signe_gros[-4096:]:
    echecs.append(
        "le banc ne reproduit pas la regression : la magie tombe dans les 4096 derniers octets "
        f"de l'archive fabriquee ({len(signe_gros)} octets) — la fenetre du controle fautif "
        "aurait suffi, et ce cas ne prouve rien"
    )
    print("  ECHEC  la regression n'est pas reproduite")
else:
    reussites += 1
    distance = len(signe_gros) - (signe_gros.rfind(MAGIE) + len(MAGIE))
    print(
        f"  ok     la magie est a {distance} octets de la fin "
        f"({len(signe_gros)} octets au total) — hors de la fenetre de 4096"
    )

essai, dossier = lancer(signe_gros)
juger(
    "APK universel signe — la signature est trouvee malgre la distance",
    essai,
    0,
    ["signature=presente", f"certificat_sha256={hashlib.sha256(CERTIFICAT).hexdigest()}"],
    ["APK Sig Block 42"],
)
shutil.rmtree(dossier, ignore_errors=True)

# ── Verdict ──────────────────────────────────────────────────────────────────

print()
if echecs:
    print(f"{len(echecs)} cas en echec sur {reussites + len(echecs)} :")
    for echec in echecs:
        print(f"  - {echec}")
    sys.exit(1)

print(f"{reussites} cas verts — le controle lit la structure, et dit ce qu'il y trouve.")
