"""Contrôle avant publication (check_publish.py) : une baisse de plus de 10 % bloque, le reste passe."""
from check_publish import verdict

idx = lambda tiles, count=None: {"tiles": [str(i) for i in range(tiles)], **({"count": count} if count is not None else {})}


def test_stable_ou_en_hausse():
    assert verdict(idx(2000, 300000), idx(2000, 300000))[0]
    assert verdict(idx(2100, 320000), idx(2000, 300000))[0]
    assert verdict(idx(1950, 280000), idx(2000, 300000))[0]       # -2,5 % et -6,7 % : variations normales


def test_baisse_des_lieux_ou_des_tuiles():
    ok, why = verdict(idx(2000, 200000), idx(2000, 300000))
    assert not ok and "lieux" in why
    assert not verdict(idx(1500, 300000), idx(2000, 300000))[0]


def test_ancien_index_sans_nombre_de_lieux():
    assert verdict(idx(2000, 100), idx(2000))[0]                  # on ne compare que les tuiles
    assert not verdict(idx(1000, 100), idx(2000))[0]


def test_index_vide_ou_pas_de_version_en_ligne():
    assert not verdict(idx(0, 0), idx(2000, 300000))[0]
    assert verdict(idx(2000, 300000), None)[0]


def test_passage_aux_fichiers_adaptatifs():
    # 31/10/2026 : 4 333 fichiers d'un carré → ≈ 300 fichiers adaptatifs couvrant les mêmes 4 333 carrés : pas une baisse
    old = {"v": 1, "zoom": 14, "tiles": [f"{i}/1" for i in range(4333)], "count": 100}
    new = {"v": 2, "zooms": [10, 14], "cells": 4330, "tiles": [f"12/{i}/1" for i in range(300)], "count": 100}
    ok, why = verdict(new, old)
    assert ok, why
    assert not verdict({**new, "cells": 3000}, old)[0]


def test_garde_fou_de_nuit_compte_les_carres():
    # 31/10/2026 : le garde-fou de places.yml comptait les fichiers (490 avec les tuiles adaptatives, seuil 2 000) et a
    # bloqué la publication ; il doit compter les carrés de 2,4 km couverts, comme check_publish.py
    from pathlib import Path
    yml = (Path(__file__).resolve().parents[3] / ".github/workflows/places.yml").read_text()
    line = next(l for l in yml.splitlines() if "n >= 2000" in l)
    assert "cells" in line
