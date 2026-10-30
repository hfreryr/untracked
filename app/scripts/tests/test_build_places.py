"""Rue la plus proche d'un lieu sans adresse (build_places.Streets)."""
import pytest

osmium = pytest.importorskip("osmium")
from build_places import Streets  # noqa: E402


def test_rue_la_plus_proche_et_limite():
    s = Streets()
    s.add("Rue de Rennes", [(2.3290, 48.8480), (2.3330, 48.8530)])
    s.add("Rue du Four", [(2.3300, 48.8530), (2.3360, 48.8525)])
    assert s.nearest(2.3312, 48.8506) == "Rue de Rennes"      # à quelques mètres de la rue de Rennes
    assert s.nearest(2.3340, 48.8528) == "Rue du Four"
    assert s.nearest(2.3500, 48.8600) is None                 # trop loin : on ne devine pas


def test_cadre_d_une_agglomeration():
    """--bbox : seuls les lieux du cadre restent ; une tuile vidée disparaît (Lyon dans l'extrait du Rhône)."""
    from build_places import keep_in_bbox
    tiles = {(1, 1): [[11, 4.85, 45.76, {}], [21, 4.40, 45.76, {}]], (2, 2): [[31, 4.40, 46.0, {}]]}
    kept = keep_in_bbox(tiles, (4.68, 45.62, 5.08, 45.88))
    assert list(kept) == [(1, 1)] and [it[0] for it in kept[(1, 1)]] == [11]
