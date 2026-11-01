"""Rang dans le quartier (landmark_rank.py) : un lieu moins connu ne retarde jamais un lieu plus connu."""
import copy

from landmark_rank import assign_zoom_cells
from build_overlays import PLACES_FROM


def lm(name, lon, lat, score, kind="landmark"):
    return {"name": name, "lon": lon, "lat": lat, "score": score, "kind": kind}


def zs(items):
    return {i["name"]: i["z"] for i in assign_zoom_cells(copy.deepcopy(items), lat0=52.36)}


def test_un_voisin_moins_connu_ne_retarde_pas():
    # Rijksmuseum et le Van Gogh (plus connu) côte à côte ; une place moins connue tout près du Rijksmuseum
    # (sur une ligne est-ouest : Rijksmuseum à 300 m du Van Gogh, une place moins connue 200 m plus loin)
    dx = 1 / (111320 * 0.6115)                     # 1 m en degrés de longitude à 52,36° de latitude
    base = [lm("Van Gogh", 4.88, 52.36, 300), lm("Rijksmuseum", 4.88 + 300 * dx, 52.36, 250)]
    seul = zs(base)["Rijksmuseum"]
    avec = zs(base + [lm("Place", 4.88 + 500 * dx, 52.36, 40)])["Rijksmuseum"]
    assert avec == seul
    # l'ancienne méthode, elle, le retardait : la place, placée à un zoom plus large, gardait sa place
    from build_overlays import assign_zoom
    old = lambda it: {i["name"]: i["z"] for i in assign_zoom(copy.deepcopy(it), lat0=52.36)}["Rijksmuseum"]
    assert old(base + [lm("Place", 4.88 + 500 * dx, 52.36, 40)]) > old(base)


def test_deux_classements_et_commerces_apres():
    items = [lm("Musée", 2.33, 48.85, 1200), lm("Café", 2.3301, 48.8501, 15, kind="place")]
    z = {i["name"]: i["z"] for i in assign_zoom_cells(items)}
    # le café a sa propre place (classement des commerces), mais jamais avant le zoom des commerces
    assert z["Café"] >= PLACES_FROM and z["Musée"] < z["Café"]


def test_un_par_carre():
    # dix lieux au même endroit : un seul au premier zoom, les autres plus tard
    items = [lm(f"L{i}", 2.33 + i * 1e-5, 48.85, 100 - i) for i in range(10)]
    z = sorted(i["z"] for i in assign_zoom_cells(items))
    assert z[0] < z[1]
