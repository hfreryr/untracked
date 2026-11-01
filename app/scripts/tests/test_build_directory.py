"""Annuaire national : ce que l'on cherche de loin, découpé par début de mot, doublons entre régions retirés."""
import gzip
import json

from build_directory import bucket, collect, keep, words_of, write
from build_search import station_alts


def core(path, types, items):
    path.mkdir(parents=True)
    (path / "core.json.gz").write_bytes(gzip.compress(json.dumps({"v": 1, "types": types, "streets": [], "items": items}).encode()))


def test_retenus_et_doublons(tmp_path):
    types = ["place=village", "place=hamlet", "amenity=cafe", "railway=station", "place=neighbourhood"]
    core(tmp_path / "zones/paca/places/search", types, [
        ["Gordes", 5.2, 43.91, 11, 0, 30],
        ["Les Imberts", 5.2, 43.89, 21, 1],                 # lieu-dit : reste dans sa région
        ["Café du Cours", 5.3, 43.5, 31, 2],                # café peu connu : idem
        ["Café de Flore", 2.33, 48.85, 41, 2, 40],          # café connu : retenu
        ["Avignon", 4.8, 43.95, 51, 3, 0, "Gare de Avignon"],   # gare : retenue
        ["Bel Air", 5.0, 43.9, 61, 4, 5],                   # quartier peu connu : non
    ])
    # même lieu dans une région voisine (cadres qui se chevauchent) : une seule fois
    core(tmp_path / "zones/rhone-alpes/places/search", types, [["Gordes", 5.2, 43.91, 11, 0, 30]])
    names = sorted(r[0] for r, _, _ in collect(tmp_path))
    assert names == ["Avignon", "Café de Flore", "Gordes"]
    gare = next(r for r, _, _ in collect(tmp_path) if r[0] == "Avignon")
    assert gare[6] == "Gare de Avignon"


def test_gare_de():
    assert station_alts("Rennes", "railway=station", "") == "Gare de Rennes"
    assert station_alts("Gare du Nord", "railway=station", "") == ""
    assert station_alts("Rennes", "amenity=cafe", "") == ""
    assert station_alts("Rennes", "railway=station", "Gare de Rennes") == "Gare de Rennes"
    assert station_alts("Rennes", "railway=station", "", "subway") == ""      # station de métro « Rennes », à Paris


def test_mots_et_decoupage(tmp_path, monkeypatch):
    assert words_of("Musée d'Orsay") == {"musee", "orsay", "dorsay"}
    assert keep("place=village", 0) and not keep("place=hamlet", 0) and keep("amenity=cafe", 25)
    import build_directory
    monkeypatch.setattr(build_directory, "MAX_ITEMS", 2)
    t = ["place=village"]
    entries = [([n, 0, 0, i, 0], t, []) for i, n in enumerate(["Saint-Malo", "Saint-Lô", "Sainte-Anne", "Sarlat"])]
    b = bucket(entries)
    # « sa » trop plein : redécoupé ; « saint » reste un mot entier (pas de mot plus long)
    assert "sa" not in b and b["saint"] == {0, 1} and 3 in b["sar"]
    assert all(len(v) <= 2 for k, v in b.items() if k != "saint")
    d = write(str(tmp_path), entries, b)
    meta = json.load(open(f"{d}/index.json"))
    assert meta["keys"]["saint"] == 2
    f = json.loads(gzip.open(f"{d}/saint.json.gz").read())
    assert sorted(r[0] for r in f["items"]) == ["Saint-Lô", "Saint-Malo"]
