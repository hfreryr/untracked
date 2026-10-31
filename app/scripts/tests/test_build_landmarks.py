"""Lieux mis en avant par zone (build_landmarks.py) : commerces de toute la zone, homonymes éloignés distincts,
monuments avant commerces, carrés compressés lisibles par l'app."""
import gzip, json
from build_landmarks import ZoneLandmarks, select, write


class T(dict):
    """Étiquettes OSM comme osmium les donne (itérables en objets .k)."""
    def __iter__(self):
        return iter([type("Tag", (), {"k": k, "v": v})() for k, v in self.items()])


class P:
    def __init__(self, x, y):
        self.x, self.y = x, y


def test_homonymes_eloignes_gardes():
    h = ZoneLandmarks()
    tags = T({"name": "Église Saint-Pierre", "historic": "monument", "wikidata": "Q1", "name:en": "a", "name:de": "b", "name:es": "c"})
    h._add("node/1", tags, lambda: (P(-1.68, 48.11), 0))        # Rennes
    h._add("node/2", tags, lambda: (P(-4.49, 48.39), 0))        # Brest
    h._add("node/3", tags, lambda: (P(-1.6805, 48.1102), 0))    # même lieu, cartographié deux fois
    assert len(h.items) == 2


def test_selection_et_carres(tmp_path):
    lms = [{"name": "Rijksmuseum", "family": "culture", "subclass": "museum", "score": 40, "osm": "way/1", "kind": "landmark", "lon": 4.885, "lat": 52.36}]
    places = [{"name": f"Café {i}", "family": "cafe", "subclass": "cafe", "score": 5, "osm": f"node/{i}", "kind": "place",
               "lon": 4.88 + i * 0.004, "lat": 52.37} for i in range(10)]
    items = select(lms, places, bbox=(4.73, 52.27, 5.07, 52.43))
    assert items[0]["name"] == "Rijksmuseum" and items[0]["z"] == 11.5     # le plus connu, dès la vue large
    assert any(i["kind"] == "place" for i in items)                       # des cafés aussi (toute la zone, pas que Paris)
    assert all(i["z"] >= 13.75 for i in items if i["kind"] == "place")    # pas de commerce en vue de ville
    n = write(str(tmp_path), items)
    idx = json.load(open(tmp_path / "landmarks/index.json"))
    assert n == len(idx["tiles"]) == 1 and idx["count"] == len(items)
    rows = json.loads(gzip.decompress((tmp_path / "landmarks" / f"{idx['tiles'][0]}.json.gz").read_bytes()))
    assert rows[0][2] == "Rijksmuseum" and rows[0][7] == "way/1" and rows[0][6] == 1
