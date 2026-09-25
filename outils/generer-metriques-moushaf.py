#!/usr/bin/env python3
"""Extrait les metriques de composition des 604 pages du moushaf.

Ce que ce fichier resout
------------------------
La police du Mushaf de Medine est propre a CHAQUE page : ses points de code sont
locaux a la page (U+FC41 vaut « قُلْ » page 604, mais « الم » page 2). Une ligne
ne se justifie donc exactement qu'en connaissant l'avance reelle de ses glyphes —
et l'application, elle, ne sait pas lire une police.

Ce script mesure une fois pour toutes, hors de l'application :

  - `edition` : quelle edition de police couvre la page (voir ci-dessous) ;
  - `upem`    : unites par cadratin ;
  - `lignes`  : l'avance totale de chacune des 15 lignes, en unites de dessin.

L'application en deduit, ligne par ligne, la taille de police qui la fait tomber
exactement sur la largeur disponible. C'est la justification du moushaf imprime,
ou le calligraphe a lui-meme amene toutes les lignes a la meme mesure.

Deux editions, et pourquoi il en faut deux
------------------------------------------
Mesure du 25 septembre 2026 : sur 604 pages, CINQ (121, 533, 534, 568, 570) sont
servies par une police `v2`/`v4` incomplete — les derniers mots de la page n'ont
pas de glyphe (page 121 : 24 mots, lignes 13 a 15). L'API, elle, les demande
bel et bien. Verifie sur les deux editions : le defaut est identique.

L'edition `v1`, interrogee avec `code_v1`, couvre ces cinq pages sans une seule
lacune. La regle retenue est donc :

    v4 + code_v2 par defaut, v1 + code_v1 quand la page est incomplete.

Le script VERIFIE la couverture page par page au lieu de la supposer, et echoue
bruyamment si aucune edition ne convient.

Sortie : assets/moushaf-metriques.json, triee et sans horodatage, donc
reproductible d'une machine a l'autre (un controle de fraicheur peut l'exiger).
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fontTools.ttLib import TTFont

API = "https://api.quran.com/api/v4/verses/by_page/%d"
PARAMS = "?words=true&word_fields=code_v2,code_v1,line_number&per_page=50"
POLICE = "https://static.qurancdn.com/fonts/quran/hafs/%s/ttf/p%d.ttf"

# (edition, champ de code) essayes dans cet ordre. v4 est cinq fois plus legere
# que v2 pour un trait equivalent : c'est ce qui la met en tete.
EDITIONS = (("v4", "code_v2"), ("v1", "code_v1"))

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "src" / "donnees" / "moushaf-metriques.json"
CACHE = Path(os.environ.get("TEMP", "/tmp")) / "moushaf-fonts-cache"

ENTETES = {"User-Agent": "mon-lecteur-de-coran/1.0 (generateur de metriques)"}
NB_PAGES = 604


def lire(url: str, essais: int = 4) -> bytes:
    derniere: Exception | None = None
    for _ in range(essais):
        try:
            requete = urllib.request.Request(url, headers=ENTETES)
            with urllib.request.urlopen(requete, timeout=90) as reponse:
                return reponse.read()
        except (urllib.error.URLError, TimeoutError) as erreur:
            derniere = erreur
    raise RuntimeError("echec de lecture apres %d essais : %s" % (essais, url)) from derniere


def police(edition: str, page: int) -> TTFont:
    CACHE.mkdir(parents=True, exist_ok=True)
    chemin = CACHE / ("p%d.%s.ttf" % (page, edition))
    if not chemin.exists() or chemin.stat().st_size < 1024:
        chemin.write_bytes(lire(POLICE % (edition, page)))
    return TTFont(str(chemin), lazy=True)


def codes_de_page(page: int) -> tuple[dict[int, list[tuple[str, str]]], dict[str, int]]:
    """Rend, par ligne, la liste des (code_v2, code_v1) dans l'ordre de lecture."""
    donnees = json.loads(lire(API % page + PARAMS).decode("utf-8"))
    lignes: dict[int, list[tuple[str, str]]] = {}
    reperes: dict[str, int] = {}
    for verset in donnees["verses"]:
        reperes.setdefault("juz", verset["juz_number"])
        reperes.setdefault("hizb", verset["hizb_number"])
        for mot in verset["words"]:
            numero = mot.get("line_number")
            if not numero:
                continue
            lignes.setdefault(numero, []).append(
                (mot.get("code_v2") or "", mot.get("code_v1") or "")
            )
    return lignes, reperes


def metriques(page: int) -> dict:
    lignes, reperes = codes_de_page(page)
    if not lignes:
        raise RuntimeError("page %d : aucun mot avec line_number" % page)

    for edition, champ in EDITIONS:
        police_page = police(edition, page)
        cmap = police_page.getBestCmap()
        upem = police_page["head"].unitsPerEm
        hmtx = police_page["hmtx"]
        indice = 0 if champ == "code_v2" else 1

        largeurs: dict[str, list[int]] = {}
        complet = True
        for numero in sorted(lignes):
            total = 0
            for paire in lignes[numero]:
                segment = paire[indice]
                for caractere in segment:
                    # Un segment peut porter un espace, absent du cmap : il
                    # separe deux codes et ne compte pas dans l'avance.
                    if caractere == " ":
                        continue
                    point = ord(caractere)
                    if point not in cmap:
                        complet = False
                        break
                    total += hmtx[cmap[point]][0]
                if not complet:
                    break
            if not complet:
                break
            largeurs[str(numero)] = [total]

        if complet:
            return {
                "edition": edition,
                "upem": upem,
                "juz": reperes.get("juz"),
                "hizb": reperes.get("hizb"),
                "lignes": largeurs,
            }

    raise RuntimeError(
        "page %d : aucune edition ne couvre la page (%s)"
        % (page, " ; ".join("%s/%s" % e for e in EDITIONS))
    )


def main() -> int:
    debut = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    fin = int(sys.argv[2]) if len(sys.argv) > 2 else NB_PAGES
    resultats: dict[int, dict] = {}
    echecs: list[tuple[int, str]] = []

    def traiter(page: int):
        try:
            return page, metriques(page), None
        except Exception as erreur:  # noqa: BLE001 — on veut nommer la page fautive
            return page, None, str(erreur)

    with ThreadPoolExecutor(max_workers=8) as executant:
        for page, valeur, erreur in executant.map(traiter, range(debut, fin + 1)):
            if erreur is not None:
                echecs.append((page, erreur))
                print("  page %3d ECHEC : %s" % (page, erreur), flush=True)
            else:
                resultats[page] = valeur
                if page % 100 == 0:
                    print("  ... page %d" % page, flush=True)

    if echecs:
        print("!! %d page(s) en echec" % len(echecs), flush=True)
        return 1

    par_edition: dict[str, int] = {}
    for valeur in resultats.values():
        par_edition[valeur["edition"]] = par_edition.get(valeur["edition"], 0) + 1
    print("editions retenues :", par_edition)

    contenu = {
        "source": "Quran Foundation Content API v4 + polices QCF du Mushaf de Medine",
        "avertissement": (
            "Les points de code de la police sont locaux a chaque page. "
            "Ne jamais reutiliser les codes d'une page avec la police d'une autre."
        ),
        "editions": {
            "v4": "police allégée, couvre la page ; a interroger avec code_v2",
            "v1": "police de secours ; a interroger avec code_v1",
        },
        "pages": {str(p): resultats[p] for p in sorted(resultats)},
    }
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(
        json.dumps(contenu, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
        newline="\n",
    )
    print("ecrit : %s (%d octets)" % (SORTIE, SORTIE.stat().st_size))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
