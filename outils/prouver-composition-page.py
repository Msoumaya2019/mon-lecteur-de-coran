#!/usr/bin/env python3
"""Confronte la composition de l'application a la page IMPRIMEE.

Ce que ce fichier etablit
-------------------------
L'application donne a chaque ligne d'une page une largeur occupee qui vaut
`avance / reference` de la mesure. C'est une prevision verifiable : la page
imprimee, elle, se mesure. Ce script mesure les deux et les compare.

Il ne se contente pas de rejouer la regle — il la confronte a l'autorite, la
seule qui compte. Une regle qui se valide elle-meme ne prouve rien : c'est
exactement l'erreur qui avait ete commise sur la lecture du bloc de signature
d'APK, ou le banc et le controle partageaient la meme meprise.

Les tailles viennent de l'application elle-meme, par `outils/tailles-pages.mjs`,
et non d'une transcription : deux sources pour une meme verite finiraient par
diverger, et la preuve validerait alors une regle qui n'est plus celle du code.

Usage
-----
    python3 outils/prouver-composition-page.py 3 604 599

Les pages imprimees sont telechargees une fois dans le dossier temporaire.

Pour eprouver la preuve elle-meme — s'assurer qu'elle sait echouer — on lui donne
la composition fautive, celle d'avant la correction :

    REGLE=par-ligne python3 outils/prouver-composition-page.py 604

Le banc doit alors refuser la page. Une preuve qui ne sait pas dire non ne prouve
rien.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get("TEMP", "/tmp")) / "moushaf-pages-cache"
IMPRIME = "https://raw.githubusercontent.com/taulujas-png/quran-mushaf/main/%03d.png"
ENTETES = {"User-Agent": "mon-lecteur-de-coran/1.0 (preuve de composition)"}

# La zone de texte des pages courantes, mesuree sur les pages 3 et 599 : la
# premiere encre tombe en y=63, la derniere en y=1003. Les pages d'ouverture
# (1 et 2) ne suivent pas cette grille — leur texte est centre dans un ornement —
# et sont donc declarees non mesurables plutot que mesurees de travers.
HAUT, BAS = 63, 1003
LIGNES = 15
PAS = (BAS - HAUT) / LIGNES

# La fenetre de mesure est resserree autour du centre de l'emplacement : deux
# lignes voisines se touchent souvent, et une fenetre pleine capterait leur encre.
# Deux largeurs sont essayees ; si elles ne s'accordent pas, la ligne est declaree
# non mesurable au lieu d'etre mesuree faux.
FENETRES = (0.40, 0.45)
DESACCORD = 0.04

# Ecart tolere entre la largeur prevue et la largeur imprimee, sur CHAQUE ligne.
#
# C'est la pire ligne qui decide, et non une moyenne : une mediane ne voit pas
# qu'une minorite de lignes est fausse, et c'est exactement le defaut que ce banc
# doit attraper. Il l'a montre — avec la composition d'avant, la mediane restait a
# 2,1 % pendant que trois emplacements de la page 604 accusaient 47 %, 34 % et
# 52 % d'ecart. Un controle qui ne sait pas dire non ne prouve rien.
ECART_PAR_LIGNE = 0.10


def lire(url: str, essais: int = 3) -> bytes:
    derniere: Exception | None = None
    for _ in range(essais):
        try:
            requete = urllib.request.Request(url, headers=ENTETES)
            with urllib.request.urlopen(requete, timeout=90) as reponse:
                return reponse.read()
        except Exception as erreur:  # noqa: BLE001 — on veut nommer l'echec
            derniere = erreur
    raise RuntimeError("echec de lecture : %s" % url) from derniere


def page_imprimee(page: int) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    cible = CACHE / ("%03d.png" % page)
    if not cible.exists() or cible.stat().st_size < 1024:
        cible.write_bytes(lire(IMPRIME % page))
    return cible


def composer_sur_blanc(chemin: Path):
    """L'image a une transparence de palette : sans composition, le fond est noir."""
    from PIL import Image

    image = Image.open(chemin).convert("RGBA")
    fond = Image.new("RGBA", image.size, (255, 255, 255, 255))
    return Image.alpha_composite(fond, image).convert("L")


def mesurer_largeur(px, largeur: int, centre: float, demi: float):
    """Largeur d'encre dans une fenetre verticale, ou None si la fenetre est vide."""
    a, b = int(centre - demi), int(centre + demi)
    colonnes = [x for x in range(largeur) if any(px[x, y] < 140 for y in range(a, b))]
    if not colonnes:
        return None
    return max(colonnes) - min(colonnes) + 1


def tailles_de_application(pages: list[int]) -> dict:
    """Demande a l'application elle-meme les tailles qu'elle calcule."""
    commande = [
        "node",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--import",
        "./outils/enregistrer-tests.mjs",
        "outils/tailles-pages.mjs",
        *[str(p) for p in pages],
    ]
    resultat = subprocess.run(
        commande, cwd=RACINE, capture_output=True, text=True, encoding="utf-8", check=False
    )
    if resultat.returncode != 0:
        raise RuntimeError(
            "l'application n'a pas repondu :\n%s\n%s" % (resultat.stdout, resultat.stderr)
        )
    return json.loads(resultat.stdout)


def mesurer_page(page: int) -> dict[int, float] | None:
    """Largeur imprimee de chaque emplacement qui porte du texte, en fraction de la mesure."""
    image = composer_sur_blanc(page_imprimee(page))
    largeur, hauteur = image.size
    px = image.load()

    rangees = [y for y in range(hauteur) if any(px[x, y] < 140 for x in range(0, largeur, 2))]
    if not rangees:
        return None
    haut, bas = min(rangees), max(rangees)
    # Une page dont l'encre ne suit pas la grille courante n'est pas mesurable ici.
    if abs(haut - HAUT) > 12 or abs(bas - BAS) > 12:
        return None

    mesures: dict[int, float] = {}
    for emplacement in range(1, LIGNES + 1):
        centre = HAUT + (emplacement - 0.5) * PAS
        valeurs = [mesurer_largeur(px, largeur, centre, f * PAS) for f in FENETRES]
        if any(v is None for v in valeurs):
            continue
        etroite, large = valeurs
        assert etroite is not None and large is not None
        if abs(large - etroite) / max(large, 1) > DESACCORD:
            # Les deux fenetres ne racontent pas la meme chose : la ligne touche
            # ses voisines. On ne la mesure pas.
            continue
        mesures[emplacement] = float(large)
    return mesures or None


def main() -> int:
    pages = [int(a) for a in sys.argv[1:]] or [3, 604]
    try:
        tailles = tailles_de_application(pages)
    except RuntimeError as erreur:
        print(erreur)
        return 2

    echecs: list[str] = []
    for page in pages:
        composition = tailles.get(str(page))
        if not composition:
            print("page %d : absente du fichier de metriques" % page)
            echecs.append("page %d non decrite" % page)
            continue

        imprime = mesurer_page(page)
        if imprime is None:
            print(
                "page %d : non mesurable (page d'ouverture, ou lignes qui se touchent)"
                % page
            )
            continue

        reference = composition["reference"]
        lignes = composition["lignes"]
        # La mesure imprimee est celle de la ligne la plus longue : c'est ainsi que
        # la regle choisit sa reference, et la comparaison reste coherente.
        mesure = max(imprime.values())

        ecarts = []
        anomalies = []
        fautes = []
        print("page %d — reference %.0f unites, taille %.1f pt" % (page, reference, composition["taille"]))
        print("  %-4s %-9s %-9s %-8s" % ("empl.", "imprime", "prevu", "ecart"))
        for emplacement in sorted(imprime):
            ligne = lignes.get(str(emplacement))
            if not ligne:
                continue
            imprimee = imprime[emplacement] / mesure
            # Ce que l'application rend : la largeur de la ligne a la taille
            # qu'elle lui a donnee, rapportee a la largeur disponible. Une ligne
            # plus longue que la reference est reduite, donc bornee a 100 %.
            prevue = (ligne["avance"] * ligne["taille"]) / (
                composition["upem"] * composition["largeur"]
            )
            ecart = prevue - imprimee
            ecarts.append(abs(ecart))
            print(
                "  %-4d %-9s %-9s %+8.1f %%"
                % (emplacement, "%.1f %%" % (100 * imprimee), "%.1f %%" % (100 * prevue), 100 * ecart)
            )
            if abs(ecart) <= ECART_PAR_LIGNE:
                continue
            # Deux causes opposees produisent un grand ecart, et il ne faut pas
            # les confondre :
            #
            #   - l'imprime est PLEIN et la prevision courte : l'avance de cette
            #     ligne est incomplete dans les donnees. Aucune regle ne peut
            #     rendre pleine une ligne dont on ne connait pas les mots ;
            #   - l'imprime est COURT et la prevision pleine : la regle grossit
            #     une ligne courte. C'est la faute que ce banc doit refuser.
            if imprimee >= 0.90 and prevue <= 0.60:
                anomalies.append((emplacement, imprimee, prevue))
            else:
                fautes.append((emplacement, imprimee, prevue))

        if not ecarts:
            print("  aucun emplacement comparable")
            continue

        ecarts.sort()
        median = ecarts[len(ecarts) // 2]
        print(
            "  -> %d emplacements, ecart median %.1f %%, pire %.1f %%"
            % (len(ecarts), 100 * median, 100 * ecarts[-1])
        )
        for emplacement, imprimee, prevue in anomalies:
            print(
                "     avance incomplete, emplacement %d : l'imprime occupe %.1f %% de la mesure, "
                "la prevision %.1f %% — c'est la donnee qui est en cause, pas la regle"
                % (emplacement, 100 * imprimee, 100 * prevue)
            )
        for emplacement, imprimee, prevue in fautes:
            print(
                "     FAUTE, emplacement %d : l'imprime occupe %.1f %% de la mesure et la "
                "composition en occupe %.1f %% — une ligne courte est grossie"
                % (emplacement, 100 * imprimee, 100 * prevue)
            )
            echecs.append(
                "page %d emplacement %d : l'imprime occupe %.0f %%, la composition %.0f %%"
                % (page, emplacement, 100 * imprimee, 100 * prevue)
            )
        print()

    if echecs:
        print("ECHEC — %d ligne(s) ou la composition grossit une ligne courte :" % len(echecs))
        for echec in echecs:
            print("  %s" % echec)
        return 1
    print(
        "Sur chaque ligne mesurable, la composition de l'application tombe sur la page "
        "imprimee a moins de %.0f %%." % (100 * ECART_PAR_LIGNE)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
