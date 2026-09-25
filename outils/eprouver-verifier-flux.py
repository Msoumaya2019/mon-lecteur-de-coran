#!/usr/bin/env python3
"""
Eprouve `outils/verifier-flux.mjs` en le falsifiant.

Un controle qui passe ne prouve rien : il peut n'avoir rien examine. Ce banc
introduit chaque defaut dans un VRAI flux, verifie que le controle echoue, et
pour la bonne raison -- le marqueur ASCII, jamais la couleur d'un message.

Trois regles apprises a la dure, et tenues ici :

  - une ancre courte trouve toujours du texte en position d'infixe. `on:` compte
    quatre occurrences dans un flux (`permissions:`, `workflow_dispatch:`,
    `runs-on:`, plus la vraie cle) : l'ancre est encadree -- `\\non:\\n` -- et son
    nombre d'occurrences est VERIFIE, pas espere. Un compte nul signifie que la
    mutation n'a pas eu lieu, et le controle resterait vert pour une raison qui
    n'a rien a voir avec sa vigilance ;
  - la restauration se prouve par EMPREINTE SHA-256, jamais par comparaison de
    contenu : `read_text()` ramene les CRLF a LF et masque exactement ce qu'on
    cherche. Les mutations travaillent donc sur des OCTETS ;
  - « motif introuvable » et « reste vert » sont deux verdicts distincts. Les
    confondre fait chercher le defaut du mauvais cote.

Deux familles de cas :

  - les mutations, qui alterent un vrai flux puis le restaurent ;
  - les cas sur dossier temporaire, pour ce qu'aucune mutation des vrais
    fichiers ne peut atteindre : la liste fermee, qui porte sur la PRESENCE d'un
    fichier, et la regle des permissions, qui demande trois flux fautifs
    distincts. Le dossier temporaire recoit une copie des quatre vrais flux,
    puis l'un d'eux est remplace -- sinon le refus viendrait de deux causes a la
    fois et le banc ne mesurerait plus rien.

Usage : python3 outils/eprouver-verifier-flux.py
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
FLUX = RACINE / ".github" / "workflows"
CONTROLE = RACINE / "outils" / "verifier-flux.mjs"

FLUX_ATTENDUS = ["android-apk.yml", "ci.yml", "eas-build.yml", "ios-unsigned.yml"]

# En-tete des flux fabriques : le minimum pour que le refus vienne du defaut
# vise, et non d'un declencheur ou d'un `runs-on` manquant.
ENTETE = "name: Flux fabrique par le banc\non: workflow_dispatch\n"

echecs: list[str] = []
reussites = 0


def empreinte(chemin: Path) -> str:
    return hashlib.sha256(chemin.read_bytes()).hexdigest()


def lancer(dossier: Path | None = None) -> tuple[int, str]:
    environnement = dict(os.environ)
    if dossier is not None:
        environnement["FLUX_DOSSIER"] = str(dossier)
    resultat = subprocess.run(
        ["node", str(CONTROLE)],
        cwd=RACINE,
        env=environnement,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return resultat.returncode, (resultat.stdout or "") + (resultat.stderr or "")


def juger(nom: str, code: int, sortie: str, code_attendu: int, marqueur: str | None) -> None:
    global reussites
    soucis = []
    if code != code_attendu:
        soucis.append(f"code de sortie {code}, attendu {code_attendu}")
    if marqueur is not None and marqueur not in sortie:
        soucis.append(f"marqueur « {marqueur} » absent du rapport")
    if marqueur is None and "aucun" not in sortie:
        soucis.append("le rapport ne dit pas « aucun defaut »")

    if soucis:
        echecs.append(f"{nom} : " + " ; ".join(soucis))
        print(f"  ECHEC  {nom}\n         " + "\n         ".join(soucis))
    else:
        reussites += 1
        print(f"  ok     {nom}")


def cas_mutation(
    nom: str,
    fichier: str,
    avant: bytes,
    apres: bytes,
    marqueur: str,
    occurrences: int = 1,
) -> None:
    chemin = FLUX / fichier
    reference = empreinte(chemin)
    original = chemin.read_bytes()

    if b"\r\n" in original:
        raise SystemExit(f"{fichier} contient des CRLF : le banc refuse de muter ce fichier.")

    compte = original.count(avant)
    if compte != occurrences:
        raise SystemExit(
            f"{fichier} : l'ancre {avant!r} compte {compte} occurrence(s), {occurrences} attendue(s).\n"
            "Un compte nul signifie que la mutation n'a pas eu lieu — le controle resterait vert,\n"
            "et l'on conclurait a tort qu'il est aveugle."
        )

    chemin.write_bytes(original.replace(avant, apres))
    try:
        code, sortie = lancer()
        juger(nom, code, sortie, 1, marqueur)
    finally:
        chemin.write_bytes(original)
        if empreinte(chemin) != reference:
            echecs.append(f"{nom} : la restauration n'est pas fidele a l'octet")
            print(f"  ECHEC  {nom} — restauration non fidele a l'octet")


def copier_les_vrais_flux(dossier: Path) -> None:
    # Un fichier par un fichier : `copy2` d'un dossier vers un dossier existant
    # ne fait pas ce qu'on croit selon la version de Python.
    for nom in FLUX_ATTENDUS:
        shutil.copy2(FLUX / nom, dossier / nom)


def cas_dossier(nom: str, marqueur: str | None, code_attendu: int, preparer) -> None:
    dossier = Path(tempfile.mkdtemp(prefix="flux-"))
    try:
        copier_les_vrais_flux(dossier)
        preparer(dossier)
        code, sortie = lancer(dossier)
        juger(nom, code, sortie, code_attendu, marqueur)
    finally:
        shutil.rmtree(dossier, ignore_errors=True)


def ecrire_flux(dossier: Path, contenu: str) -> None:
    # Le flux fautif prend le nom d'un flux ATTENDU : sinon il serait lui-meme
    # signale comme non declare, et le refus viendrait encore d'ailleurs.
    (dossier / "ci.yml").write_text(contenu, encoding="utf-8", newline="\n")


def tache(corps: str) -> str:
    return ENTETE + "permissions:\n  contents: read\njobs:\n  verifier:\n    runs-on: ubuntu-latest\n    steps:\n" + corps


# ── Mutations sur les vrais flux ─────────────────────────────────────────────

print("Mutations sur les vrais flux :")

cas_mutation(
    "ci.yml — YAML invalide",
    "ci.yml",
    b"timeout-minutes: 15",
    b"timeout-minutes: [15",
    "[yaml-invalide]",
)

cas_mutation(
    "android-apk.yml — permissions retirees",
    "android-apk.yml",
    b"permissions:\n  contents: read\n",
    b"",
    "[permissions-absentes]",
)

cas_mutation(
    "android-apk.yml — action non epinglee",
    "android-apk.yml",
    b"      - name: Publier l'APK\n        uses: actions/upload-artifact@v7\n",
    b"      - name: Publier l'APK\n        uses: actions/upload-artifact\n",
    "[action-non-epinglee]",
)

cas_mutation(
    "ios-unsigned.yml — `then` retire d'un `if`",
    "ios-unsigned.yml",
    b'if [ -n "$WORKSPACE" ]; then TYPE=workspace;',
    b'if [ -n "$WORKSPACE" ] TYPE=workspace;',
    "[script-invalide]",
)

cas_mutation(
    "ios-unsigned.yml — declencheur renomme",
    "ios-unsigned.yml",
    b"\non:\n",
    b"\ndeclencheurs:\n",
    "[declencheur-absent]",
)

cas_mutation(
    "eas-build.yml — sortie non declaree par son producteur",
    "eas-build.yml",
    b"steps.telechargement.outputs.extension",
    b"steps.telechargement.outputs.typo",
    "[sortie-non-declaree]",
    3,
)

cas_mutation(
    "eas-build.yml — producteur inexistant",
    "eas-build.yml",
    b"steps.telechargement.outputs.extension",
    b"steps.inexistant.outputs.extension",
    "[sortie-inconnue]",
    3,
)

# ── Liste fermee ─────────────────────────────────────────────────────────────

print("\nListe fermee des flux :")

cas_dossier("copie intacte — temoin", None, 0, lambda _: None)

cas_dossier(
    "un flux attendu retire",
    "[flux-absent]",
    1,
    lambda dossier: (dossier / "ci.yml").unlink(),
)

cas_dossier(
    "un flux valide ajoute mais non declare",
    "[flux-non-declare]",
    1,
    lambda dossier: (dossier / "supplementaire.yml").write_text(
        "name: Flux supplementaire\non: workflow_dispatch\npermissions:\n  contents: read\n"
        "jobs:\n  rien:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v5\n",
        encoding="utf-8",
        newline="\n",
    ),
)

# ── Permissions et verdict agrege ────────────────────────────────────────────

print("\nPermissions et verdict agrege (flux fabriques) :")


def publication(permissions: str, sur_le_travail: str = "") -> str:
    return (
        ENTETE
        + permissions
        + "jobs:\n  publier:\n    runs-on: ubuntu-latest\n"
        + sur_le_travail
        + "    steps:\n      - uses: actions/checkout@v5\n"
        + "      - run: gh release create v1 --title v1\n"
    )


cas_dossier(
    "`gh release create` sans `contents: write`",
    "[permission-insuffisante]",
    1,
    lambda dossier: ecrire_flux(dossier, publication("permissions:\n  contents: read\n")),
)

cas_dossier(
    "`gh release create` avec `contents: write` a la racine",
    None,
    0,
    lambda dossier: ecrire_flux(dossier, publication("permissions:\n  contents: write\n")),
)

cas_dossier(
    "permission a la racine mais restreinte sur le travail",
    "[permission-insuffisante]",
    1,
    lambda dossier: ecrire_flux(
        dossier,
        publication(
            "permissions:\n  contents: write\n",
            "    permissions:\n      contents: read\n",
        ),
    ),
)

cas_dossier(
    "`run:` agrege sans garde",
    "[run-agrege-sans-garde]",
    1,
    lambda dossier: ecrire_flux(
        dossier,
        tache("      - uses: actions/checkout@v5\n      - run: |\n          npm run typecheck\n          npm test\n"),
    ),
)

cas_dossier(
    "`run:` agrege garde — temoin",
    None,
    0,
    lambda dossier: ecrire_flux(
        dossier,
        tache(
            "      - uses: actions/checkout@v5\n      - run: |\n          code=0\n"
            '          npm run typecheck || code=1\n          npm test || code=1\n          exit "$code"\n'
        ),
    ),
)

# ── Verdict ──────────────────────────────────────────────────────────────────

print()
if echecs:
    print(f"{len(echecs)} cas en echec sur {reussites + len(echecs)} :")
    for echec in echecs:
        print(f"  - {echec}")
    sys.exit(1)

print(f"{reussites} cas verts — le controle detecte ce qu'il annonce, et rien d'autre.")
