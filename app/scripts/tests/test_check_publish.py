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
