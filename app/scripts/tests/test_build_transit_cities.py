"""Lignes des grandes villes (build_transit_cities.py) : métro et tram seulement, numéro repris de la ligne mère,
navettes et tram-trains écartés."""
from build_transit_cities import CityRoutes, city_mode, colour_of


def test_modes():
    assert city_mode({"route": "subway"}) == "metro"
    assert city_mode({"route": "tram"}) == "tram"
    assert city_mode({"route": "light_rail"}) == "tram"
    assert city_mode({"route": "bus"}) is None
    assert city_mode({"route": "funicular"}) is None


def test_numero_de_la_ligne_mere_et_filtres():
    rt = CityRoutes()
    rt.routes = {1: ("tram", "", None, [10, 11]),        # tram B de Bordeaux : numéro sur la ligne mère
                 2: ("tram", "", None, [12]),
                 3: ("tram", "TN190", "#F00", [13]),     # navette d'événement
                 4: ("tram", "TER T1", "#F00", [14]),    # tram-train
                 5: ("metro", "A", "E03F89", [15])}
    rt.masters = {1: ("B", "#009EE0"), 2: ("B", None)}
    lines = rt.lines
    assert set(lines) == {("tram", "B"), ("metro", "A")}
    assert lines[("tram", "B")]["relations"] == [[10, 11], [12]] and lines[("tram", "B")]["colour"] == "#009EE0"
    assert colour_of(lines[("metro", "A")]["colour"], "metro") == "#E03F89"
    assert colour_of(None, "tram") == "#5B6573"
