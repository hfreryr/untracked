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
