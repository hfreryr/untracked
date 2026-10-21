#!/usr/bin/env python3
"""
Lieux d'OpenStreetMap découpés par tuile, pour la fiche lieu et les listes de catégories.

Remplace les requêtes lieu par lieu (Overpass) et le complément Photon des catégories : l'app
charge les 1 à 4 tuiles autour de la vue et y lit tout (horaires, téléphone, site, accès…).

Entrée : un extrait OSM (ex. https://download.openstreetmap.fr/extracts/europe/france/ile_de_france/paris-latest.osm.pbf,
         mis à jour chaque nuit).
Sortie : static/data/places/14/{x}/{y}.json  (zoom 14 ≈ 2,4 km de côté à Paris)
         static/data/places/index.json      (tuiles disponibles, date de l'extrait)

Format d'une tuile : {"v":1,"t":[[id, lon, lat, {tags}, devanture?], …]}  devanture = [idPhoto, hôte, azimut, cap, distance, licence, auteur, date]
  Compléments hors OSM (build_extras.py, --extras) : ajoutés aux étiquettes seulement si OSM ne les a pas, avec leur
  source dans l'étiquette "_src" ({"website": "overture"}), que la fiche affiche.
  id = identifiant OSM × 10 + (1 nœud, 2 chemin, 3 relation), le même codage que dans les tuiles de la carte.

Usage :  python app/scripts/build_places.py data/paris-latest.osm.pbf [--out app/static/data/places] [--zoom 14]
Mesuré le 13/10/2026 sur Paris : 74 863 lieux, 66 tuiles, 3,1 Mo compressés au total, 25 Ko par tuile en médiane.
"""
import argparse, json, math, os, sys, time
from collections import defaultdict
from pathlib import Path

import osmium

# Étiquettes principales qui font qu'un élément est « un lieu »
MAIN = ("amenity", "shop", "tourism", "leisure", "craft", "office", "healthcare", "historic", "railway", "public_transport", "man_made", "place")
# Ce que la fiche affiche (voir placeinfo.js / places.js côté app)
KEEP = (
    "name", "opening_hours", "phone", "contact:phone", "website", "contact:website", "wheelchair", "cuisine",
    "check_date", "check_date:opening_hours", "fee", "heritage", "heritage:operator", "ref:mhs", "wikidata", "wikipedia",
    "addr:housenumber", "addr:street", "addr:postcode", "addr:city",
    "payment:contactless", "payment:credit_cards", "payment:cards", "payment:debit_cards", "payment:cash", "payment:meal_voucher",
    "outdoor_seating", "diet:vegetarian", "diet:vegan", "diet:gluten_free", "takeaway", "delivery", "reservation",
    "internet_access", "internet_access:fee", "air_conditioning", "toilets", "toilets:wheelchair", "changing_table", "dog",
    "self_service", "second_hand", "organic", "religion", "building", "church:type", "artwork_type", "memorial", "station", "subway",
    "network", "operator", "brand", "level", "entrance", "ref", "website:menu",
)
# Lieux sans nom qu'on garde quand même (toilettes, distributeurs, bornes, parkings, points d'eau)
UNNAMED_OK = {("amenity", "toilets"), ("amenity", "atm"), ("amenity", "charging_station"), ("amenity", "drinking_water"),
              ("amenity", "parking"), ("amenity", "bicycle_rental"), ("amenity", "fuel"), ("railway", "subway_entrance")}


def tile_xy(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    lat_r = math.radians(lat)
    y = int((1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n)
    return x, y


# Rue la plus proche, pour les lieux sans adresse : affichée dans la liste des résultats de recherche
# (« Monoprix · Rue du Départ », comme Google Maps ; demande du porteur, 21/10). Seulement le nom de la rue,
# sans numéro, et seulement dans l'index de recherche : la fiche du lieu n'affiche que de vraies adresses.
STREET_KINDS = {"primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "pedestrian", "trunk"}
CELL = 0.002          # grille de ≈ 150 × 220 m
NEAR_M = 40           # au-delà, on ne devine pas


def _seg_dist_m(px, py, ax, ay, bx, by):
    """Distance en mètres d'un point à un segment (coordonnées en degrés, approximation locale)."""
    k = math.cos(math.radians(py))
    ax, bx, px = ax * k, bx * k, px * k
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy) * 111320


class Streets:
    """Tronçons de rues nommées, rangés dans une grille pour trouver vite la plus proche d'un point."""
    def __init__(self):
        self.grid = defaultdict(list)

    def add(self, name, pts):
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            for cx in range(int(min(ax, bx) / CELL), int(max(ax, bx) / CELL) + 1):
                for cy in range(int(min(ay, by) / CELL), int(max(ay, by) / CELL) + 1):
                    self.grid[(cx, cy)].append((name, ax, ay, bx, by))

    def nearest(self, lon, lat, limit=NEAR_M):
        best, bd = None, limit
        cx, cy = int(lon / CELL), int(lat / CELL)
        for x in (cx - 1, cx, cx + 1):
            for y in (cy - 1, cy, cy + 1):
                for name, ax, ay, bx, by in self.grid.get((x, y), ()):
                    d = _seg_dist_m(lon, lat, ax, ay, bx, by)
                    if d < bd:
                        best, bd = name, d
        return best


class Places(osmium.SimpleHandler):
    def __init__(self, zoom):
        super().__init__()
        self.zoom = zoom
        self.tiles = defaultdict(list)
        self.count = 0
        self.streets = Streets()

    def _keep(self, tags):
        t = dict(tags)
        mains = [(k, t[k]) for k in MAIN if k in t]
        if not mains:
            return None
        if "name" not in t and not any(m in UNNAMED_OK for m in mains):
            return None
        out = {k: t[k] for k in KEEP if k in t}
        for k, v in mains:
            out[k] = v
        return out

    def _add(self, oid, kind, tags, lon, lat):
        d = self._keep(tags)
        if d is None:
            return
        x, y = tile_xy(lon, lat, self.zoom)
        self.tiles[(x, y)].append([oid * 10 + kind, round(lon, 6), round(lat, 6), d])
        self.count += 1

    def node(self, n):
        if n.location.valid():
            self._add(n.id, 1, n.tags, n.location.lon, n.location.lat)

    def way(self, w):
        t = w.tags
        if t.get("highway") in STREET_KINDS and t.get("name"):
            pts = [(n.lon, n.lat) for n in w.nodes if n.location.valid()]
            if len(pts) > 1:
                self.streets.add(t.get("name"), pts)

    def area(self, a):
        # un bâtiment ou un parc : son centre (moyenne des sommets du contour extérieur)
        for ring in a.outer_rings():
            pts = [(p.lon, p.lat) for p in ring if p.location.valid()]
            if not pts:
                return
            lon = sum(p[0] for p in pts) / len(pts)
            lat = sum(p[1] for p in pts) / len(pts)
            self._add(a.orig_id(), 2 if a.from_way() else 3, a.tags, lon, lat)
            return


def add_extras(tags, extra, today=None):
    """Comble les manques d'OSM (jamais de remplacement) et note la source de chaque complément.
    Un complément daté (horaires d'une saison) n'est plus utilisé après sa date de fin."""
    if not extra:
        return False
    today = today or time.strftime("%Y-%m-%d")
    alt = {"website": "contact:website", "phone": "contact:phone"}
    added = False
    for k, (value, source, *until) in extra.items():
        if k == "addr":  # adresse (numéro, rue, code postal) : seulement si OSM n'en a aucune
            if tags.get("addr:street") or not value or not value[1]:
                continue
            num, street, pc = (list(value) + [None, None, None])[:3]
            tags.update({k2: v for k2, v in (("addr:housenumber", num), ("addr:street", street), ("addr:postcode", pc)) if v})
            tags.setdefault("_src", {})["addr:street"] = source
            added = True
            continue
        if k in tags or alt.get(k) in tags or (until and until[0] < today):
            continue
        tags[k] = value
        tags.setdefault("_src", {})[k] = source
        added = True
    return added


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pbf")
    ap.add_argument("--out", default="app/static/data/places")
    ap.add_argument("--zoom", type=int, default=14)
    ap.add_argument("--facades", help="facades.json (build_facades.py) : photo de devanture ajoutée en 5e position de chaque lieu")
    ap.add_argument("--extras", help="extras.json (build_extras.py) : compléments hors OSM, avec leur source")
    args = ap.parse_args()
    extras = {}
    if args.extras:
        try:
            extras = json.load(open(args.extras)).get("places", {})
        except Exception as e:
            print("compléments ignorés :", e, file=sys.stderr)
    facades = {}
    if args.facades:
        try:
            facades = json.load(open(args.facades))
        except Exception as e:
            print("devantures ignorées :", e, file=sys.stderr)
    t0 = time.time()
    h = Places(args.zoom)
    h.apply_file(args.pbf, locations=True)
    out = Path(args.out)
    # on repart de zéro : une tuile disparue ne doit pas rester
    if out.exists():
        for p in sorted(out.rglob("*"), reverse=True):
            p.unlink() if p.is_file() else p.rmdir()
    sizes = []
    nf = ne = nr = 0
    for (x, y), items in h.tiles.items():
        items.sort(key=lambda it: it[0])
        for it in items:
            if add_extras(it[3], extras.get(str(it[0]))):
                ne += 1
            # ni adresse OSM ni adresse Overture : la rue la plus proche, pour la liste des résultats (« _rue »)
            if it[3].get("name") and not it[3].get("addr:street"):
                rue = h.streets.nearest(it[1], it[2])
                if rue:
                    it[3]["_rue"] = rue
                    nr += 1
            f = facades.get(str(it[0]))
            if f:
                it.append(f)
                nf += 1
        d = out / str(args.zoom) / str(x)
        d.mkdir(parents=True, exist_ok=True)
        s = json.dumps({"v": 1, "t": items}, ensure_ascii=False, separators=(",", ":"))
        (d / f"{y}.json").write_text(s)
        sizes.append(len(s))
    index = {
        "v": 1, "zoom": args.zoom, "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": os.path.basename(args.pbf), "tiles": sorted(f"{x}/{y}" for x, y in h.tiles),
    }
    (out / "index.json").write_text(json.dumps(index, separators=(",", ":")))
    print(f"{nf} devantures ; {ne} lieux complétés hors OSM ; {nr} rues proches ; " + f"{h.count} lieux dans {len(h.tiles)} tuiles (zoom {args.zoom}), {sum(sizes)/1e6:.1f} Mo bruts, "
          f"tuile médiane {sorted(sizes)[len(sizes)//2]/1e3:.0f} Ko, en {time.time()-t0:.0f} s")


if __name__ == "__main__":
    main()
