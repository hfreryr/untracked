"""Réseau cyclable : catégorie de chaque voie OSM (build_bikes.kind)."""
from build_bikes import kind


def test_pistes():
    assert kind({'highway': 'cycleway'}) == 'track'
    assert kind({'highway': 'primary', 'cycleway:right': 'track'}) == 'track'


def test_bandes_et_voies_bus():
    assert kind({'highway': 'secondary', 'cycleway:both': 'lane'}) == 'lane'
    assert kind({'highway': 'primary', 'cycleway:left': 'share_busway'}) == 'lane'
    assert kind({'highway': 'primary', 'busway': 'lane', 'bicycle': 'yes'}) == 'lane'


def test_double_sens():
    assert kind({'highway': 'residential', 'oneway': 'yes', 'oneway:bicycle': 'no'}) == 'contra'
    assert kind({'highway': 'residential', 'oneway': 'yes'}) is None


def test_velo_autorise_et_exclusions():
    assert kind({'highway': 'pedestrian', 'bicycle': 'yes'}) == 'shared'
    assert kind({'highway': 'living_street'}) == 'shared'
    assert kind({'highway': 'footway'}) is None
    assert kind({'highway': 'residential', 'cycleway:both': 'lane', 'bicycle': 'no'}) is None
    assert kind({'building': 'yes'}) is None
