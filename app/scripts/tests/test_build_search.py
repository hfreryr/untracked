"""Index de recherche : doublons fusionnés, notoriété, lieux sans intérêt écartés."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from build_search import build, notoriety  # noqa: E402


def test_doublons_et_notoriete():
    items = [
        (11, 2.3570, 48.8820, {"name": "Paris Gare du Nord", "public_transport": "station", "wikidata": "Q745942"}),
        (21, 2.3550, 48.8804, {"name": "Paris Gare du Nord", "railway": "station", "wikidata": "Q745942"}),
        (31, 2.3569, 48.8810, {"name": "Paris Gare du Nord", "railway": "station"}),          # même nom à 100 m
        (41, 2.3560, 48.8815, {"name": "Gare du Nord", "railway": "subway_entrance"}),        # entrée : écartée
        (51, 2.3000, 48.8000, {"name": "Paris Gare du Nord", "railway": "station"}),          # même nom, ailleurs : gardé
        (61, 2.3100, 48.8600, {"amenity": "bench"}),                                           # sans nom : écarté
    ]
    types, streets, rows = build(items, {"Q745942": 2_000_000})
    assert len(rows) == 2
    best = rows[0]
    assert best[0] == "Paris Gare du Nord" and types[best[4]] == "railway=station" and best[5] == 63


def test_adresse_autres_noms_et_regime():
    items = [(11, 2.33, 48.85, {"name": "Le Potager", "amenity": "restaurant", "alt_name": "Potager du Marais",
                                "diet:vegan": "yes", "cuisine": "french", "addr:housenumber": "12",
                                "addr:street": "Rue Rambuteau", "addr:postcode": "75003"})]
    types, streets, rows = build(items, {})
    name, lon, lat, oid, ti, rank, alts, extra, addr = rows[0]
    assert alts == "Potager du Marais" and extra == "french|V"
    num, si, pc = addr.split("|")
    assert (num, streets[int(si)], pc) == ("12", "Rue Rambuteau", "75003")


def test_notoriete_bornee():
    assert notoriety({}, {}) == 0
    assert notoriety({"wikidata": "Q1"}, {"Q1": 10 ** 12}) == 99


def test_rue_proche_si_pas_d_adresse():
    """Sans adresse, la rue la plus proche (« _rue ») s'affiche sans numéro ; une vraie adresse passe avant."""
    items = [(11, 2.33, 48.85, {"name": "Monoprix", "shop": "supermarket", "_rue": "Rue du Départ"}),
             (21, 2.34, 48.86, {"name": "Franprix", "shop": "supermarket", "addr:housenumber": "3", "addr:street": "Rue X",
                                "addr:postcode": "75001", "_rue": "Rue Y"})]
    types, streets, rows = build(items, {})
    addr = {r[0]: r[8] for r in rows}
    assert streets[int(addr["Monoprix"].split("|")[1])] == "Rue du Départ" and addr["Monoprix"].split("|")[0] == "~"
    assert streets[int(addr["Franprix"].split("|")[1])] == "Rue X"


def test_decoupage_coeur_et_zones(tmp_path):
    """Gares, communes et lieux connus dans le cœur ; le reste dans sa zone ; chaque fichier a ses propres tables."""
    import json
    from build_search import write_split, tile_of
    items = [
        (11, 2.3550, 48.8800, {"name": "Gare du Nord", "railway": "station"}),
        (21, 2.4400, 48.8600, {"name": "Montreuil", "place": "town"}),   # (dans le cadre de « Paris » approché)
        (31, 2.3400, 48.8500, {"name": "Café de Flore", "amenity": "cafe", "addr:street": "Boulevard Saint-Germain", "addr:housenumber": "172"}),
        (41, 2.2000, 48.8350, {"name": "Boulangerie Dupont", "shop": "bakery", "addr:street": "Rue de Paris", "addr:housenumber": "3"}),
    ]
    types, streets, rows = build(items, {})
    n_core, zones = write_split(str(tmp_path), types, streets, rows)
    assert n_core == 2
    core = json.load(open(tmp_path / "search" / "core.json"))
    assert {r[0] for r in core["items"]} == {"Gare du Nord", "Montreuil"}
    idx = json.load(open(tmp_path / "search" / "index.json"))
    assert idx["v"] == 2 and len(idx["zones"]) == len(zones)
    x, y = tile_of(2.2000, 48.8350)
    z = json.load(open(tmp_path / "search" / "12" / str(x) / f"{y}.json"))
    row = next(r for r in z["items"] if r[0] == "Boulangerie Dupont")
    assert z["types"][row[4]] == "shop=bakery"
    assert z["streets"][int(row[8].split("|")[1])] == "Rue de Paris"
    # l'ancien fichier unique reste servi (Paris seulement), pour les versions de l'app pas encore à jour
    assert {r[0] for r in json.load(open(tmp_path / "search.json"))["items"]} == {"Gare du Nord", "Montreuil", "Café de Flore"}
