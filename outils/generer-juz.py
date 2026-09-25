#!/usr/bin/env python3
"""Genere la table des 30 juz, lue a la source.

Pourquoi une table separee plutot qu'une deduction des metriques de page : le
juz d'une page est porte par le **premier verset** de cette page, et un juz peut
commencer **au milieu d'une page**. Mesure du 25 septembre 2026 : la page 121
contient 5:77 a 5:82, et 5:82 ouvre le juz 7. Deduire le debut du juz 7 de la
premiere page ou il apparait donne donc **122 au lieu de 121** — et de meme 503
au lieu de 502 pour le juz 26. Deux juz sur trente ouvraient huit versets trop
loin.

La table officielle `/juzs` leve l'ambiguite : elle donne, pour chaque juz, la
repartition des versets par sourate. Le premier verset du juz est donc connu
exactement, et il ne reste qu'a demander sa page.

Sortie : `src/donnees/juz.json`.

Usage : python outils/generer-juz.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request

BASE = "https://api.quran.com/api/v4"
SORTIE = os.path.join("src", "donnees", "juz.json")


def appeler(chemin: str) -> dict:
    """Appel JSON a l'API.

    L'en-tete d'agent n'est pas cosmetique : sans lui, l'API repond 403
    (constate le 25 septembre 2026).
    """
    requete = urllib.request.Request(BASE + chemin)
    requete.add_header("User-Agent", "Mozilla/5.0")
    requete.add_header("Accept", "application/json")
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        brut = reponse.read()
    # Certaines reponses portent un BOM ; on le retire sans discuter.
    return json.loads(brut.decode("utf-8-sig"))


def premier_verset(repartition: dict) -> tuple[int, int]:
    """Premier verset d'un juz, a partir de sa repartition par sourate.

    `verse_mapping` ressemble a `{"1": "1-7", "2": "1-141"}` : les cles sont les
    numeros de sourate, les valeurs des plages « debut-fin ». Le premier verset
    est celui de la plus petite sourate, au debut de sa plage.
    """
    sourates = sorted(int(cle) for cle in repartition)
    if not sourates:
        raise ValueError("Repartition de juz vide.")
    premiere_sourate = sourates[0]
    plage = repartition[str(premiere_sourate)]
    debut = int(str(plage).split("-")[0])
    return premiere_sourate, debut


def main() -> int:
    brut = appeler("/juzs").get("juzs", [])

    # L'API rend chaque juz **deux fois** — identifiants 1 a 30, puis 61 a 90 —
    # avec un contenu identique. Constaté le 25 septembre 2026. On regroupe donc
    # par numero de juz, et on refuse de continuer si les deux copies divergent :
    # mieux vaut un echec bruyant qu'une table de juz choisie au hasard.
    par_numero: dict[int, list[dict]] = {}
    for entree in brut:
        par_numero.setdefault(entree["juz_number"], []).append(entree)

    if sorted(par_numero) != list(range(1, 31)):
        print(f"Numeros de juz inattendus : {sorted(par_numero)}", file=sys.stderr)
        return 1

    for numero, copies in sorted(par_numero.items()):
        reference = copies[0]
        for autre in copies[1:]:
            if autre["verse_mapping"] != reference["verse_mapping"]:
                print(
                    f"Les copies du juz {numero} divergent : "
                    f"{reference['verse_mapping']} contre {autre['verse_mapping']}",
                    file=sys.stderr,
                )
                return 1

    entrees = []
    for numero, copies in sorted(par_numero.items()):
        sourate, verset = premier_verset(copies[0]["verse_mapping"])
        cle = f"{sourate}:{verset}"
        # Une requete par juz : trente au total, jouees une fois hors de
        # l'application. Le resultat est fige dans le fichier.
        fiche = appeler(f"/verses/by_key/{cle}")
        page = fiche["verse"]["page_number"]
        entrees.append(
            {
                "numero": numero,
                "page": page,
                "premierVerset": cle,
            }
        )
        print(f"  juz {numero:>2} : {cle:<8} page {page}")

    document = {
        "source": "https://api.quran.com/api/v4/juzs",
        "note": (
            "Table engendree par outils/generer-juz.py. La page est celle du "
            "premier verset du juz, mesuree a la source : un juz peut commencer "
            "au milieu d'une page, donc la deduire de la premiere page ou il "
            "apparait est faux (juz 7 : 122 au lieu de 121)."
        ),
        "juzs": entrees,
    }

    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with open(SORTIE, "w", encoding="utf-8", newline="\n") as fichier:
        json.dump(document, fichier, ensure_ascii=False, indent=1, sort_keys=True)
        fichier.write("\n")

    print()
    print(f"{len(entrees)} juz ecrits dans {SORTIE} ({os.path.getsize(SORTIE)} octets)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
