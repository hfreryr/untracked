"""Lit un extrait OSM (.pbf) en entier : sort en erreur s'il est tronqué ou abîmé.

Sert quand la somme de contrôle publiée à côté de l'extrait n'est pas à jour (OSM France, 30/10/2026 : extraits
refaits le 30, sommes restées au 29), pour ne pas rejeter un fichier sain. Chaque bloc d'un .pbf est compressé
avec son propre contrôle : une lecture complète sans erreur vaut vérification.
Usage : python app/scripts/verify_pbf.py extrait.osm.pbf
"""
import os
import sys

import osmium


class Count(osmium.SimpleHandler):
    """Ne compte que les relations (peu nombreuses, en fin de fichier) : tous les blocs sont tout de même
    décompressés pour les trouver, mais sans le coût d'un appel Python par point."""
    def __init__(self):
        super().__init__()
        self.n = 0

    def relation(self, r):
        self.n += 1


def check(path):
    c = Count()
    c.apply_file(path)
    return c.n


if __name__ == "__main__":
    if os.path.getsize(sys.argv[1]) == 0:
        print("extrait vide", file=sys.stderr)
        sys.exit(1)
    try:
        size = check(sys.argv[1])
    except Exception as e:  # noqa: BLE001 — toute erreur de lecture = fichier à rejeter
        print(f"extrait illisible : {e}", file=sys.stderr)
        sys.exit(1)
    print(f"extrait lu en entier ({size} relations)")
