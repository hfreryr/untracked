"""Une zone de bout en bout (build_zone.sh), comme la nuit, sur toutes les sortes de zones (06/11/2026) : à l'ouest de
Greenwich (longitudes négatives : Bretagne, Aquitaine…), en Corse, à une frontière (Genève). Hors ligne : extrait OSM
fabriqué ici, sans avis, compléments ni états en ligne."""
import json
import os
import subprocess
from pathlib import Path

import pytest

osmium = pytest.importorskip("osmium")
SCRIPTS = Path(__file__).resolve().parent.parent

ZONES = {   # id : (cadre, lieux (lon, lat, nom, sorte))
    "ouest": ([-4.8, 47.3, -1.0, 48.9], [(-1.6800, 48.1110, "Crêperie Test", "restaurant"), (-1.6790, 48.1115, "Café Test", "cafe"),
                                         (-1.6810, 48.1100, "Musée Test", "museum"), (-4.4860, 48.3900, "Brest Bar", "bar")]),
    "corse": ([8.52, 41.31, 9.58, 43.05], [(8.7380, 41.9190, "Ajaccio Resto", "restaurant"), (9.4500, 42.7000, "Bastia Café", "cafe")]),
    "frontiere": ([3.67, 44.09, 7.21, 46.54], [(6.2360, 46.1930, "Annemasse Resto", "restaurant"), (6.2370, 46.1935, "Annemasse Café", "cafe")]),
}


def make_pbf(path, places):
    w = osmium.SimpleWriter(str(path))
    for i, (lon, lat, name, kind) in enumerate(places, start=1):
        tags = {"name": name, ("tourism" if kind == "museum" else "amenity"): kind}
        w.add_node(osmium.osm.mutable.Node(id=i, location=(lon, lat), tags=tags, version=1))
    w.close()


@pytest.mark.parametrize("zone", list(ZONES))
def test_zone_de_bout_en_bout(tmp_path, zone):
    bbox, places = ZONES[zone]
    make_pbf(tmp_path / "zone.osm.pbf", places)
    env = {**os.environ, "ZONE_PBF": str(tmp_path / "zone.osm.pbf"), "OFFLINE": "1", "ONLINE": "http://127.0.0.1:9", "SITES": "10"}
    r = subprocess.run(["bash", str(SCRIPTS / "build_zone.sh"), zone, "x/" + zone, ",".join(map(str, bbox)), "FR"],
                       cwd=tmp_path, env=env, capture_output=True, text=True, timeout=600)
    out = r.stdout + r.stderr
    assert (tmp_path / f"{zone}-status").read_text().strip() == "ok", out[-3000:]
    assert "::error::" not in out, out[-3000:]
    idx = json.loads((tmp_path / "out" / zone / "index.json").read_text())
    assert idx["count"] == len(places)
    assert idx["metrics"]["places"] == len(places) and idx["cover"]["rows"]
    assert (tmp_path / "out" / zone / "landmarks" / "index.json").exists()
    assert (tmp_path / "out" / zone / "search" / "index.json").exists()
