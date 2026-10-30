"""Avis Mangrove : lecture de l'API (fetch_reviews.normalize) et rangement dans les lieux (build_places.attach_reviews)."""
from build_places import attach_reviews, tile_xy
from fetch_reviews import normalize


def test_normalize():
    raw = {"reviews": [
        {"signature": "s1", "payload": {"sub": "geo:48.86,2.34?q=Maison%20Collet&u=10", "rating": 100, "opinion": " Top ",
                                         "iat": 10, "metadata": {"nickname": "Armavica", "osm_id": "node/3461586770/12"}}},
        {"signature": "s2", "payload": {"sub": "https://exemple.org", "rating": 50}},                       # pas un lieu
        {"signature": "s3", "payload": {"sub": "urn:maresi:x", "action": "report_abuse"}},                 # signalement
        {"signature": "s4", "payload": {"sub": "geo:48.8,2.3?q=Caf%C3%A9&u=10", "rating": 60, "metadata": {}}},
    ]}
    r = normalize(raw)
    assert [x["s"] for x in r] == ["s1", "s4"]
    assert r[0]["osm"] == "node/3461586770" and r[0]["name"] == "Maison Collet" and r[0]["o"] == "Top" and r[0]["n"] == "Armavica"
    assert r[1]["osm"] is None and r[1]["name"] == "Café"


def test_attach_par_identifiant_puis_par_nom_et_distance():
    z = 14
    lon, lat = 2.3470, 48.8660
    t = tuple(tile_xy(lon, lat, z))
    collet = [34615867701, lon, lat, {"name": "Maison Collet"}]
    cafe = [12, lon + 0.0002, lat, {"name": "Le Café des Arts"}]
    tiles = {t: [collet, cafe]}
    rv = lambda **k: {"osm": None, "lat": lat, "lon": lon, "name": "", "r": 80, "o": "", "n": "", "t": 1, "s": "x", **k}
    n = attach_reviews(tiles, [
        rv(osm="node/3461586770", r=100, t=5, s="a"),
        rv(osm="node/3461586770", r=60, t=9, s="b"),
        rv(name="Café des Arts", lon=lon + 0.00025, s="c"),         # même nom, à ~4 m
        rv(name="Café des Arts", lon=lon + 0.003, s="d"),           # trop loin (~220 m)
        rv(name="Unknown location", s="e"),
    ], z)
    assert n == 3
    assert collet[3]["_rev"]["n"] == 2 and collet[3]["_rev"]["a"] == 80 and collet[3]["_rev"]["l"][0][4] == "b"   # le plus récent d'abord
    assert cafe[3]["_rev"]["n"] == 1


def test_meme_auteur_meme_lieu_le_plus_recent_seulement():
    sub = "geo:48.86,2.37?q=Deux%20Fois&u=10"
    raw = {"reviews": [
        {"signature": "old", "kid": "K", "payload": {"sub": sub, "rating": 100, "iat": 1, "metadata": {"osm_id": "node/1/2"}}},
        {"signature": "new", "kid": "K", "payload": {"sub": sub, "rating": 80, "iat": 2, "metadata": {"osm_id": "node/1/3"}}},
        {"signature": "other", "kid": "L", "payload": {"sub": sub, "rating": 60, "iat": 1, "metadata": {"osm_id": "node/1/3"}}},
    ]}
    assert sorted(x["s"] for x in normalize(raw)) == ["new", "other"]
