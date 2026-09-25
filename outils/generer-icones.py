#!/usr/bin/env python3
"""Genere les icones de l'application.

Dessinees, et non tirees d'une banque d'images : le motif est un ornement
geometrique — le *khatam*, ou rub el hizb, deux carres superposes dont l'un est
tourne d'un huitieme de tour. Le choix est deliberement non figuratif : une
application de lecture du Coran n'a pas a porter d'image, et l'ornement
geometrique est la tradition de l'enluminure.

Tout est dessine a quatre fois la taille puis reduit : c'est ce qui donne des
bords nets sans dependre d'une bibliotheque de rendu vectoriel.

Usage : python outils/generer-icones.py
"""

from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw

VERT = (11, 74, 50)
OR = (184, 148, 77)
IVOIRE = (253, 251, 244)
BLANC = (255, 255, 255)

SUR = 4
"""Facteur de surechantillonnage."""

DOSSIER = os.path.join("assets", "images")


def carre(cx: float, cy: float, demi: float, angle: float) -> list[tuple[float, float]]:
    """Sommets d'un carre de demi-diagonale `demi`, tourne de `angle`."""
    return [
        (
            cx + demi * math.cos(angle + indice * math.pi / 2),
            cy + demi * math.sin(angle + indice * math.pi / 2),
        )
        for indice in range(4)
    ]


def dessiner_motif(
    dessin: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    rayon: float,
    couleur: str,
    epaisseur: float,
    couleur_centre: str | None = None,
) -> None:
    """Trace le khatam : deux carres de meme rayon circonscrit, decales de 45 degres.

    Leur union donne l'etoile a huit branches, et leurs traits qui se croisent a
    l'interieur dessinent le carre central — c'est le motif complet, sans avoir a
    le composer morceau par morceau.
    """
    demi = rayon / math.sqrt(2)
    for angle in (0.0, math.pi / 4):
        dessin.polygon(carre(cx, cy, demi, angle), outline=couleur, width=round(epaisseur))

    if couleur_centre is not None:
        petit = rayon * 0.11
        dessin.ellipse(
            [cx - petit, cy - petit, cx + petit, cy + petit],
            fill=couleur_centre,
        )


def reduire(image: Image.Image, taille: int) -> Image.Image:
    return image.resize((taille, taille), Image.LANCZOS)


def icone_principale(taille: int = 1024) -> Image.Image:
    """Icone de l'application : fond vert plein, cadre dore, khatam dore."""
    grand = taille * SUR
    image = Image.new("RGB", (grand, grand), VERT)
    dessin = ImageDraw.Draw(image)

    # Cadre interieur : un filet dore, pose a distance du bord pour ne pas etre
    # rogne par les masques d'iOS et d'Android.
    marge = grand * 0.075
    dessin.rectangle(
        [marge, marge, grand - marge, grand - marge],
        outline=OR,
        width=round(grand * 0.006),
    )

    dessiner_motif(dessin, grand / 2, grand / 2, grand * 0.29, OR, grand * 0.016, OR)
    return reduire(image, taille)


def icone_avant_plan(taille: int = 1024) -> Image.Image:
    """Calque avant d'Android : motif vert sur fond transparent.

    Le motif tient dans la zone sure — les deux tiers centraux — car Android
    rogne ce calque selon la forme de l'appareil.
    """
    grand = taille * SUR
    image = Image.new("RGBA", (grand, grand), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    dessiner_motif(dessin, grand / 2, grand / 2, grand * 0.20, VERT, grand * 0.018, OR)
    return reduire(image, taille)


def icone_monochrome(taille: int = 1024) -> Image.Image:
    """Calque monochrome d'Android : le motif en blanc, l'alpha fait le reste."""
    grand = taille * SUR
    image = Image.new("RGBA", (grand, grand), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    dessiner_motif(dessin, grand / 2, grand / 2, grand * 0.20, BLANC, grand * 0.018, BLANC)
    return reduire(image, taille)


def icone_lancement(taille: int = 1024) -> Image.Image:
    """Image de l'ecran de lancement : motif vert, sur le fond ivoire configure."""
    grand = taille * SUR
    image = Image.new("RGBA", (grand, grand), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    dessiner_motif(dessin, grand / 2, grand / 2, grand * 0.38, VERT, grand * 0.022, OR)
    return reduire(image, taille)


def favicon(taille: int = 196) -> Image.Image:
    return icone_principale(taille)


def enregistrer(image: Image.Image, nom: str) -> None:
    chemin = os.path.join(DOSSIER, nom)
    image.save(chemin, "PNG", optimize=True)
    print(f"  {nom:<34} {image.size[0]}x{image.size[1]}  {os.path.getsize(chemin)} octets")


def main() -> int:
    os.makedirs(DOSSIER, exist_ok=True)
    print("Icones engendrees :")
    enregistrer(icone_principale(), "icon.png")
    enregistrer(icone_avant_plan(), "android-icon-foreground.png")
    enregistrer(icone_monochrome(), "android-icon-monochrome.png")
    enregistrer(icone_lancement(), "splash-icon.png")
    enregistrer(favicon(), "favicon.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
