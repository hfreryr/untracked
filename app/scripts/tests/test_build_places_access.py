"""Accès des grands lieux (build_places.pick_access) : entrées, chemins qui touchent le contour, bord de rue."""
import pytest

osmium = pytest.importorskip("osmium")
from build_places import pick_access, ACC_MAX  # noqa: E402

# contour réel du stade Maurice-Baquet (Gentilly), quelques sommets ; pas d'entrée ni de chemin dans OSM
RING = [(1, 2.34314, 48.81167), (2, 2.34343, 48.81151), (3, 2.34403, 48.81145), (4, 2.34468, 48.81193),
        (5, 2.34443, 48.81225), (6, 2.34435, 48.81246)]


def test_entree_dessinee_prioritaire():
    assert pick_access(RING, gates={3}, joins={1, 6}) == [[2.34403, 48.81145]]


def test_chemin_qui_touche_le_contour():
    assert pick_access(RING, gates=set(), joins={4}) == [[2.34468, 48.81193]]


def test_bord_de_rue_quand_osm_n_a_ni_entree_ni_chemin():
    rue = {(2.34314, 48.81167), (2.34435, 48.81246)}            # rue d'Arcueil
    got = pick_access(RING, set(), set(), lambda lon, lat: (lon, lat) in rue)
    assert got == [[2.34314, 48.81167], [2.34435, 48.81246]]


def test_rien_trouve_on_garde_le_centre():
    assert pick_access(RING, set(), set()) == []


def test_points_voisins_fusionnes_et_nombre_limite():
    serre = [(i, 2.3400 + i * 0.00001, 48.8100) for i in range(5)]      # 5 points en moins de 4 m
    assert len(pick_access(serre, gates={0, 1, 2, 3, 4}, joins=set())) == 1
    long = [(i, 2.3400 + i * 0.001, 48.8100) for i in range(20)]        # 20 points espacés de 73 m
    assert len(pick_access(long, gates=set(range(20)), joins=set())) == ACC_MAX
