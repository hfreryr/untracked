"""Lieux mis en avant sur la carte, pour chaque zone (Île-de-France, régions, villes), avec les mêmes règles partout
(porteur, 31/10/2026 : à Amsterdam, on ne voyait que des monuments au zoom 15, pas de restaurants).

Même calcul qu'en Île-de-France (build_overlays.py) : notoriété (traductions du nom, Wikidata, fiche bien remplie),
puis zoom d'apparition « z » qui garde un écart régulier à l'écran, comme Plans ou Google. Différences :
- les commerces mis en avant viennent de toute la zone, plus seulement de Paris ;
- deux lieux du même nom ne se confondent que s'ils sont voisins (deux « Église Saint-Pierre » d'une région restent deux) ;
- rangés par carré d'≈ 40 km (zoom 10), compressés : l'app ne charge que les carrés à l'écran (landmarkstore.js).

Sortie :  <dossier>/landmarks/index.json        {"v":1, "zoom":10, "tiles":["10/507/352", …], "count": n}
          <dossier>/landmarks/10/x/y.json.gz    [[lon, lat, nom, famille, sous-classe, z, rang, "node/123"], …]
Usage :   python app/scripts/build_landmarks.py extrait.osm.pbf --out out/places [--bbox ouest,sud,est,nord]
Données © contributeurs OpenStreetMap, licence ODbL.
"""
import argparse
import gzip
import json
import os
import time
from collections import defaultdict

from build_overlays import Landmarks, assign_zoom, classify, fame
from tileio import cell_of

ZOOM = 10
N_LANDMARKS = 4000   # monuments les plus connus gardés par zone (3 000 pour l'Île-de-France jusqu'ici)


class ZoneLandmarks(Landmarks):
    """Comme Landmarks, mais un nom ne fusionne deux lieux que s'ils sont à moins d'≈ 1 km."""

    def _add(self, ref, tags, geom_fn):
        if "name" not in tags:
            return
        c = classify(tags)
        if not c:
            self._add_place(ref, tags, geom_fn)
            return
        family, weight = c
        f = fame(tags)
        if family != "train" and f < 3 and "wikidata" not in tags:
            self._add_place(ref, tags, geom_fn)
            return
        try:
            pt, area = geom_fn()
        except Exception:
            return
        score = f + (8 if "wikidata" in tags else 0) + weight * 4 + min(area * 1e7, 25)
        name = tags.get("name:fr") or tags["name"]
        key = (name, round(pt.y, 2), round(pt.x, 2))
        prev = self.items.get(key)
        if prev and prev["score"] >= score:
            return
        self.items[key] = {"name": name, "family": family, "subclass": tags.get("tourism") or tags.get("historic")
                           or tags.get("amenity") or tags.get("leisure") or tags.get("railway") or "",
                           "score": round(score, 1), "osm": ref, "kind": "landmark",
                           "lon": round(pt.x, 6), "lat": round(pt.y, 6)}


def select(landmarks, places, bbox=None, n_landmarks=N_LANDMARKS):
    """Monuments les plus connus + commerces, dédoublonnés, avec leur zoom d'apparition."""
    inside = (lambda i: bbox[0] <= i["lon"] <= bbox[2] and bbox[1] <= i["lat"] <= bbox[3]) if bbox else (lambda i: True)
    lms = sorted((i for i in landmarks if inside(i)), key=lambda x: -x["score"])[:n_landmarks]
    for i in lms:
        i["score"] += 1000   # un monument passe toujours avant un commerce
    seen = {}
    for p in places:
        if not inside(p):
            continue
        key = (p["name"].lower(), round(p["lat"], 3), round(p["lon"], 3))
        if key not in seen or seen[key]["score"] < p["score"]:
            seen[key] = p
    items = lms + list(seen.values())
    if not items:
        return []
    lat0 = sorted(i["lat"] for i in items)[len(items) // 2]
    out = assign_zoom(items, lat0=lat0)
    out.sort(key=lambda i: (i["z"], -i["score"]))
    return out


def write(out_dir, items):
    d = os.path.join(out_dir, "landmarks")
    tiles = defaultdict(list)
    for rank, i in enumerate(items, 1):
        x, y = cell_of(i["lon"], i["lat"], ZOOM)
        tiles[(x, y)].append([i["lon"], i["lat"], i["name"], i["family"], i["subclass"], i["z"], rank, i["osm"]])
    for (x, y), rows in tiles.items():
        os.makedirs(os.path.join(d, str(ZOOM), str(x)), exist_ok=True)
        data = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode()
        with open(os.path.join(d, str(ZOOM), str(x), f"{y}.json.gz"), "wb") as f:
            f.write(gzip.compress(data, 9, mtime=0))
    with open(os.path.join(d, "index.json"), "w") as f:
        json.dump({"v": 1, "zoom": ZOOM, "count": len(items), "tiles": sorted(f"{ZOOM}/{x}/{y}" for x, y in tiles)}, f,
                  separators=(",", ":"))
    return len(tiles)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pbf")
    ap.add_argument("--out", required=True, help="dossier des tuiles de lieux de la zone (out/places, out/<zone>)")
    ap.add_argument("--bbox", help="ouest,sud,est,nord : comme build_places.py")
    a = ap.parse_args()
    t0 = time.time()
    h = ZoneLandmarks()
    h.apply_file(a.pbf, locations=True)
    bbox = tuple(map(float, a.bbox.split(","))) if a.bbox else None
    items = select(list(h.items.values()), h.places, bbox)
    n = write(a.out, items)
    by_z = defaultdict(int)
    for i in items:
        by_z[int(i["z"])] += 1
    print(f"{len(items)} lieux mis en avant ({sum(i['kind'] == 'place' for i in items)} commerces) dans {n} carrés ; "
          f"par zoom : {dict(sorted(by_z.items()))} ; en {time.time() - t0:.0f} s", flush=True)


if __name__ == "__main__":
    main()
