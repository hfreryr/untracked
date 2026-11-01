"""Construit, depuis l'extrait OpenStreetMap de Paris, deux couches légères servies avec l'app :

  static/data/landmarks.geojson      lieux affichés jusqu'au zoom 17 : lieux remarquables (monuments,
                                     musées, parcs, gares) et adresses (restaurants, cafés, boutiques…),
                                     chacun avec un zoom d'apparition (« z ») qui garde la carte lisible ;
  static/data/transit-lines.geojson  lignes de métro, RER, Transilien et tram, à leurs couleurs officielles ;
  static/data/exits.json             sorties de métro et de RER (numéro, nom, accès), pour la fiche station
                                     et la « sortie conseillée » des trajets.

La notoriété est estimée par le nombre de traductions du nom (name:xx) dans OSM
(le Louvre en a plus de cent, un square de quartier aucune), la présence d'une fiche Wikidata
et, pour les commerces, la richesse de la fiche OSM (site, téléphone, horaires…).
Le zoom d'apparition est calculé comme le font les cartes grand public : en partant de la vue
large, on ajoute les lieux du plus connu au moins connu tant qu'ils restent espacés à l'écran.

Usage :  python app/scripts/build_overlays.py data/ile_de_france.osm.pbf
         (Île-de-France depuis le 23/10/2026 : lignes, sorties et monuments de toute la région ; les commerces mis en avant
          restent ceux de Paris (--places-bbox), pour garder un fichier léger au démarrage de l'app)
Données © contributeurs OpenStreetMap, licence ODbL.
"""
import json
import sys
from pathlib import Path

import osmium
from shapely import wkb
from shapely.geometry import LineString, MultiLineString, mapping
from shapely.ops import linemerge

OUT = Path(__file__).resolve().parent.parent / "static" / "data"

# Catégories retenues → (famille d'icône de l'app, poids)
def classify(t):
    tourism, historic, amenity, leisure = t.get("tourism"), t.get("historic"), t.get("amenity"), t.get("leisure")
    if t.get("railway") == "station" and t.get("train") == "yes" and t.get("station") != "subway":
        return "train", 3
    if tourism in ("museum", "gallery"):
        return "culture", 2
    if tourism in ("attraction", "viewpoint") or historic in ("monument", "castle", "memorial", "palace", "building"):
        return "sight", 2
    if amenity == "place_of_worship":
        return "sight", 1
    if amenity in ("theatre", "cinema", "arts_centre", "library"):
        return "culture", 1
    if leisure in ("park", "garden") or t.get("landuse") == "recreation_ground":
        return "nature", 1
    if amenity == "hospital":
        return "health", 1
    if t.get("shop") in ("department_store", "mall"):
        return "shop", 1
    if t.get("place") == "square":
        return "nature", 1
    return None


# Commerces et adresses du quotidien → (sous-classe affichée, famille d'icône, bonus de catégorie)
FOOD = {"restaurant": "food", "fast_food": "food", "ice_cream": "food", "food_court": "food",
        "cafe": "cafe", "bar": "bar", "pub": "bar", "biergarten": "bar", "nightclub": "bar"}
SHOP_FAMILY = {"bakery": "bakery", "pastry": "bakery", "confectionery": "bakery", "chocolate": "bakery",
               "wine": "bar", "alcohol": "bar"}
CAT_BONUS = {"food": 2, "cafe": 2, "bar": 1, "bakery": 1, "culture": 2, "stay": 1, "health": 1, "shop": 0}


def commercial(t):
    amenity, shop, tourism = t.get("amenity"), t.get("shop"), t.get("tourism")
    if amenity in FOOD:
        return amenity, FOOD[amenity]
    if amenity == "pharmacy":
        return "pharmacy", "health"
    if amenity in ("theatre", "cinema", "arts_centre", "library"):
        return amenity, "culture"
    if tourism in ("museum", "gallery"):
        return tourism, "culture"
    if tourism in ("hotel", "hostel", "guest_house"):
        return tourism, "stay"
    if shop and shop not in ("vacant", "no", "yes"):
        return shop, SHOP_FAMILY.get(shop, "shop")
    return None


# Enseignes connues (porteur, 01/11/2026, option « comme Plans ») : un magasin d'enseigne (Monoprix, Kruidvat, une
# pharmacie de réseau…) est un repère que tout le monde reconnaît, il passe devant ; un restaurant ou un café de chaîne
# reste derrière les adresses uniques, qu'on cherche pour manger. Mesuré sur l'étalon (docs/mesures/
# etalon-classement.json) : 7 à 40 fois plus d'enseignes au zoom 15, un restaurant de l'étalon en moins au zoom 16.
CHAIN_FAMILIES = {"shop", "bakery", "health"}
CHAIN_BONUS = {True: 2, False: -2}


def richness(t, family=None):
    """Une fiche OSM bien remplie signale un lieu connu et vivant."""
    keys = {tag.k for tag in t}
    # Les enseignes de chaîne reçoivent des traductions automatiques du nom : elles ne disent rien de la notoriété du
    # lieu lui-même. On ne les compte pas ; l'enseigne elle-même compte selon le genre de lieu (CHAIN_BONUS).
    chain = bool(keys & {"brand", "brand:wikidata"})
    return ((8 if "wikidata" in keys else 0) + (0 if chain else min(fame(t), 10))
            + (CHAIN_BONUS[family in CHAIN_FAMILIES] if chain else 0)
            + (1.5 if keys & {"website", "contact:website"} else 0)
            + (1 if keys & {"phone", "contact:phone"} else 0)
            + (1 if "opening_hours" in keys else 0)
            + (0.5 if keys & {"cuisine", "diet:vegetarian", "outdoor_seating"} else 0)
            + min(len(keys) / 10, 2))


def fame(t):
    return sum(1 for tag in t if tag.k.startswith("name:") and len(tag.k) <= 10)


class Landmarks(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.items = {}
        self.places = []
        self.fab = osmium.geom.WKBFactory()

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
            self._add_place(ref, tags, geom_fn)   # musée de quartier, etc. : traité comme une adresse
            return
        try:
            pt, area = geom_fn()
        except Exception:
            return
        # Notoriété : traductions, présence Wikidata, catégorie, taille (parcs)
        score = f + (8 if "wikidata" in tags else 0) + weight * 4 + min(area * 1e7, 25)
        name = tags.get("name:fr") or tags["name"]
        prev = self.items.get(name)
        if prev and prev["score"] >= score:
            return
        self.items[name] = {"name": name, "family": family, "subclass": tags.get("tourism") or tags.get("historic")
                            or tags.get("amenity") or tags.get("leisure") or tags.get("railway") or "",
                            "score": round(score, 1), "osm": ref, "kind": "landmark",
                            "lon": round(pt.x, 6), "lat": round(pt.y, 6)}

    def _add_place(self, ref, tags, geom_fn):
        c = commercial(tags)
        if not c or tags.get("disused") or tags.get("abandoned"):
            return
        sub, family = c
        try:
            pt, _ = geom_fn()
        except Exception:
            return
        score = richness(tags, family) + CAT_BONUS.get(family, 0)
        self.places.append({"name": tags.get("name:fr") or tags["name"], "family": family, "subclass": sub,
                            "score": round(score, 1), "osm": ref, "kind": "place",
                            "lon": round(pt.x, 6), "lat": round(pt.y, 6)})

    def node(self, n):
        if n.location.valid():
            from shapely.geometry import Point
            self._add(f"node/{n.id}", n.tags, lambda: (Point(n.location.lon, n.location.lat), 0))

    def area(self, a):
        def g():
            geom = wkb.loads(self.fab.create_multipolygon(a), hex=True)
            return geom.representative_point(), geom.area
        self._add(f"{'way' if a.from_way() else 'relation'}/{a.orig_id()}", a.tags, g)


# ——— Lignes de transport ———
def line_mode(t):
    r = t.get("route")
    ref = (t.get("ref") or "").strip()
    net = (t.get("network") or "") + " " + (t.get("name") or "")
    if r == "subway":
        return "metro"
    if r == "tram":
        return "tram"
    if r == "train" and ("RER" in net or ref in ("A", "B", "C", "D", "E")) and len(ref) == 1:
        return "rer"
    if r == "light_rail" and "RER" in net:
        return "rer"
    # Transilien (H, J, K, L, N, P, R, U, V), ajouté le 23/10/2026
    if r == "train" and "Transilien" in net and len(ref) == 1:
        return "train"
    return None


class Routes(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.lines = {}   # (mode, ref) -> {colour, name, ways:set}

    def relation(self, r):
        t = r.tags
        if t.get("type") != "route":
            return
        mode = line_mode(t)
        ref = (t.get("ref") or "").strip()
        if not mode or not ref:
            return
        key = (mode, ref)
        entry = self.lines.setdefault(key, {"colour": None, "ways": set(), "relations": []})
        entry["colour"] = entry["colour"] or t.get("colour")
        ways = [m.ref for m in r.members if m.type == "w" and m.role in ("", "forward", "backward")]
        entry["relations"].append(ways)
        entry["ways"].update(ways)


class Ways(osmium.SimpleHandler):
    def __init__(self, wanted):
        super().__init__()
        self.wanted = wanted
        self.geoms = {}

    def way(self, w):
        if w.id in self.wanted:
            try:
                self.geoms[w.id] = [(n.lon, n.lat) for n in w.nodes]
            except osmium.InvalidLocationError:
                pass


def chaikin(coords, iterations=3):
    """Arrondit une ligne brisée (découpe des angles de Chaikin), extrémités conservées."""
    for _ in range(iterations):
        if len(coords) < 3:
            return coords
        out = [coords[0]]
        for (x0, y0), (x1, y1) in zip(coords, coords[1:]):
            out.append((0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1))
            out.append((0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1))
        out.append(coords[-1])
        coords = out
    return coords


def line_geometry(relations, geoms):
    """Une seule voie par tronçon : chaque sens de circulation (relation) n'ajoute que ce qui
    n'est pas déjà dessiné à moins de ~25 m. Puis simplification et arrondi des courbes."""
    drawn = None
    parts = []
    rels = []
    for ways in relations:
        segs = [LineString(geoms[w]) for w in ways if w in geoms and len(geoms[w]) > 1]
        if segs:
            rels.append(linemerge(MultiLineString(segs)))
    for g in sorted(rels, key=lambda g: -g.length):
        new = g if drawn is None else g.difference(drawn.buffer(0.00032))
        if new.is_empty or new.length < 0.0008:
            continue
        parts.append(new)
        drawn = new.buffer(0.00001) if drawn is None else drawn.union(new.buffer(0.00001))
    if not parts:
        return None
    lines = []
    for p in parts:
        for l in getattr(p, "geoms", [p]):
            if l.geom_type == "LineString":
                lines.append(l)
    # Simplification forte puis 4 passes d'arrondi : des courbes amples, façon plan de métro.
    merged = linemerge(MultiLineString(lines)).simplify(0.00016, preserve_topology=False)
    smooth = [LineString(chaikin(list(l.coords), 4)) for l in getattr(merged, "geoms", [merged]) if l.length > 0.0004]
    return MultiLineString(smooth) if len(smooth) > 1 else (smooth[0] if smooth else None)


DEFAULT_COLOURS = {"metro": "#5B6573", "rer": "#5B6573", "tram": "#5B6573"}


# ——— Zoom d'apparition ———
# Espacement minimal entre deux lieux, en pixels écran, selon le zoom : large en vue de quartier,
# plus serré de près. Au-delà de MAX_Z, la carte affiche tous les lieux du fond de carte.
SPACING = [(11.5, 150), (13, 140), (14, 125), (15, 105), (16, 85), (16.5, 75)]
STEPS = [11.5 + 0.25 * i for i in range(int((16.75 - 11.5) / 0.25) + 1)]
PLACES_FROM = 13.75   # les commerces n'apparaissent pas avant ce zoom (vue de ville : monuments seulement)
MAX_Z = 17


def spacing_px(z):
    px = SPACING[0][1]
    for zz, v in SPACING:
        if z >= zz:
            px = v
    return px


def assign_zoom(items, lat0=48.86):
    """Pour chaque zoom (du plus large au plus serré), ajoute les lieux par notoriété décroissante
    s'ils sont assez loin de tous ceux déjà affichés. Chaque lieu garde le premier zoom où il entre."""
    import math
    m_per_px0 = 156543.03 * math.cos(math.radians(lat0))
    kx = 111320 * math.cos(math.radians(lat0))
    xy = [(i["lon"] * kx, i["lat"] * 111320) for i in items]
    order = sorted(range(len(items)), key=lambda k: -items[k]["score"])
    # monuments : noms courts et repères essentiels, on les laisse plus serrés (0,45).
    # Commerces : 1 pour un lieu ordinaire, jusqu'à 0,3 pour un lieu très connu (score des commerces ~0 à 20)
    tight = [0.45 if i["kind"] == "landmark" else min(1.0, max(0.3, 1.2 - i["score"] / 20)) for i in items]
    placed = []          # indices déjà affichés
    for z in STEPS:
        d = spacing_px(z) * m_per_px0 / 2 ** z
        grid = {}
        for k in placed:
            x, y = xy[k]
            grid.setdefault((int(x // d), int(y // d)), []).append(k)
        for k in order:
            it = items[k]
            if "z" in it or (it["kind"] == "place" and z < PLACES_FROM):
                continue
            x, y = xy[k]
            cx, cy = int(x // d), int(y // d)
            # un commerce reste à bonne distance des autres commerces, mais peut côtoyer un monument
            # (à demi-distance) : la vue mêle ainsi monuments et bonnes adresses, comme les cartes de référence.
            # Et deux adresses très connues peuvent être voisines (Flore, Deux Magots, Lipp) : l'écart
            # exigé diminue avec la notoriété des deux lieux.
            near = any(math.hypot(xy[j][0] - x, xy[j][1] - y)
                       < (d if items[j]["kind"] == it["kind"] else d / 2) * max(tight[k], tight[j])
                       for gx in (cx - 1, cx, cx + 1) for gy in (cy - 1, cy, cy + 1) for j in grid.get((gx, gy), ()))
            if not near:
                it["z"] = z
                placed.append(k)
                grid.setdefault((cx, cy), []).append(k)
    return [i for i in items if "z" in i]


# ——— Horaires des lieux des raccourcis de catégorie ———
# Les tuiles du fond de carte ne contiennent pas les horaires : on en fait un petit index
# (identifiant de tuile → horaires OSM) pour afficher « Ouvert / Fermé » dans les listes,
# sans interroger OpenStreetMap lieu par lieu.
HOURS_CLASSES = {
    # tous les commerces (filtre « ouvert ce soir » sur toutes les catégories)
    "shop": None,
    "amenity": {"restaurant", "fast_food", "cafe", "bar", "pub", "ice_cream", "pharmacy", "bank", "post_office", "library",
                "cinema", "theatre", "nightclub", "doctors", "dentist", "clinic", "veterinary", "townhall", "marketplace",
                "arts_centre", "community_centre", "coworking_space", "toilets", "fuel", "car_wash", "car_rental", "police"},
    "tourism": {"museum", "gallery", "attraction", "zoo", "aquarium"},
    "leisure": {"sports_centre", "fitness_centre", "swimming_pool", "escape_game", "park", "garden", "playground"},
    "craft": None,
}


class Hours(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.values, self.index, self.keys = [], {}, {}

    def _add(self, oid, kind, tags):
        oh = tags.get("opening_hours")
        if not oh or not any(tags.get(k) and (v is None or tags.get(k) in v) for k, v in HOURS_CLASSES.items()):
            return
        if oh not in self.index:
            self.index[oh] = len(self.values)
            self.values.append(oh)
        self.keys[str(oid * 10 + kind)] = self.index[oh]   # même codage que les identifiants des tuiles

    def node(self, n):
        self._add(n.id, 1, n.tags)

    def way(self, w):
        self._add(w.id, 2, w.tags)


class Exits(osmium.SimpleHandler):
    """Sorties de métro et de RER : [lat, lon, numéro, nom, 1 si accessible en fauteuil, 1 si escalier mécanique]."""
    def __init__(self):
        super().__init__()
        self.items = []

    def node(self, n):
        t = n.tags
        if t.get("railway") not in ("subway_entrance", "train_station_entrance"):
            return
        name = t.get("name") or t.get("addr:street") or ""
        ref = t.get("ref") or ""
        if not (name or ref):
            return
        esc = 1 if t.get("conveying") in ("yes", "forward", "backward", "reversible") or t.get("entrance") == "escalator" else 0
        self.items.append([round(n.location.lat, 5), round(n.location.lon, 5), ref, name,
                           1 if t.get("wheelchair") == "yes" else 0, esc])


def build_exits(pbf):
    ex = Exits()
    ex.apply_file(str(pbf))
    ex.items.sort()
    (OUT / "exits.json").write_text(json.dumps(ex.items, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(ex.items)} sorties de métro et de RER ({sum(1 for i in ex.items if i[2])} numérotées)")


PARIS = (2.224, 48.815, 2.47, 48.902)   # ouest, sud, est, nord


def main(pbf, n_landmarks=3000, places_bbox=PARIS):
    OUT.mkdir(parents=True, exist_ok=True)

    lm = Landmarks()
    lm.apply_file(str(pbf), locations=True)
    landmarks = sorted(lm.items.values(), key=lambda x: -x["score"])[:n_landmarks]  # les plus connus
    w, s_, e, n = places_bbox
    lm.places = [p for p in lm.places if w <= p["lon"] <= e and s_ <= p["lat"] <= n]
    for i in landmarks:
        i["score"] += 1000   # un monument passe toujours avant un commerce
    # un même commerce peut être cartographié deux fois (point et bâtiment) : on garde le mieux noté
    seen = {}
    for p in lm.places:
        key = (p["name"].lower(), round(p["lat"], 3), round(p["lon"], 3))
        if key not in seen or seen[key]["score"] < p["score"]:
            seen[key] = p
    items = assign_zoom(landmarks + list(seen.values()))
    items.sort(key=lambda i: (i["z"], -i["score"]))
    feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [i["lon"], i["lat"]]},
              "properties": {"name": i["name"], "family": i["family"], "subclass": i["subclass"],
                             "z": i["z"], "rank": k + 1, "osm": i["osm"]}}
             for k, i in enumerate(items)]
    (OUT / "landmarks.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                                                      ensure_ascii=False, separators=(",", ":")))
    from collections import Counter
    print(f"{len(feats)} lieux ({sum(i['kind'] == 'place' for i in items)} commerces) ; par zoom :",
          dict(sorted(Counter(i["z"] for i in items).items())))
    print("premiers commerces :", [i["name"] for i in items if i["kind"] == "place"][:25])

    # (horaires : désormais dans les tuiles de lieux, voir build_places.py)

    rt = Routes()
    rt.apply_file(str(pbf))
    wanted = set().union(*(e["ways"] for e in rt.lines.values())) if rt.lines else set()
    wy = Ways(wanted)
    wy.apply_file(str(pbf), locations=True)
    lines = []
    for (mode, ref), e in sorted(rt.lines.items()):
        merged = line_geometry(e["relations"], wy.geoms)
        if merged is None:
            continue
        geom = mapping(merged)
        geom["coordinates"] = json.loads(json.dumps(geom["coordinates"]), parse_float=lambda v: round(float(v), 5))
        colour = e["colour"] or DEFAULT_COLOURS[mode]
        if not colour.startswith("#"):
            colour = "#" + colour
        lines.append({"type": "Feature", "geometry": geom,
                      "properties": {"mode": mode, "ref": ref, "colour": colour.upper()}})
    (OUT / "transit-lines.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": lines},
                                                          separators=(",", ":")))
    print(f"{len(lines)} lignes : {[(l['properties']['mode'], l['properties']['ref'], l['properties']['colour']) for l in lines]}")

    build_exits(pbf)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("pbf", nargs="?", default="data/ile_de_france.osm.pbf")
    ap.add_argument("--landmarks", type=int, default=3000, help="nombre de lieux remarquables (les plus connus)")
    ap.add_argument("--places-bbox", default=",".join(map(str, PARIS)), help="zone des commerces mis en avant : ouest,sud,est,nord")
    a = ap.parse_args()
    main(Path(a.pbf), a.landmarks, tuple(map(float, a.places_bbox.split(","))))
