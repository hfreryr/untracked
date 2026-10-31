"""Mesure du classement des lieux mis en avant sur la carte (porteur, 31/10/2026 : « le Rijksmuseum n'apparaît qu'au zoom
15,5 » ; « ne pas aller vers la première solution venue »).

Compare plusieurs façons de noter les lieux à un étalon : des lieux connus de 3 quartiers (Amsterdam centre, Paris 6e,
Rennes centre), relevés dans des guides publics (data/eval/etalon.json). L'étalon sert UNIQUEMENT à mesurer ; rien
n'en entre dans l'app ni dans OSM.

Pour chaque variante : part des lieux de l'étalon visibles au zoom 14, 15 et 16 (« voir » et « manger » à part), et
mélange des familles visibles au zoom 15 dans le quartier.

Usage : python app/scripts/eval_landmarks.py data/eval/etalon.json \
          amsterdam=data/ams/nh.osm.pbf:4.73,52.27,5.07,52.43 paris6=data/paris.osm.pbf rennes=data/fr/bretagne.osm.pbf \
          --qrank data/qrank.csv.gz
"""
import argparse
import csv
import gzip
import json
import math
import re
import sys
import unicodedata
from collections import Counter

import osmium
from shapely import wkb
from shapely.geometry import Point

from build_overlays import CAT_BONUS, PLACES_FROM, STEPS, classify, commercial, spacing_px

# ——— Lieux candidats, avec tous les signaux disponibles ———


class Candidates(osmium.SimpleHandler):
    def __init__(self, bbox=None):
        super().__init__()
        self.rows = []
        self.bbox = bbox
        self.fab = osmium.geom.WKBFactory()

    def _add(self, o, osm, geom_fn):
        t = o.tags
        if "name" not in t:
            return
        c, p = classify(t), None
        if not c:
            p = commercial(t)
            if not p or t.get("disused") or t.get("abandoned"):
                return
        try:
            pt, area = geom_fn()
        except Exception:
            return
        if self.bbox and not (self.bbox[0] <= pt.x <= self.bbox[2] and self.bbox[1] <= pt.y <= self.bbox[3]):
            return
        keys = {tag.k for tag in t}
        self.rows.append({
            "name": t.get("name:fr") or t["name"], "osm": osm, "lon": round(pt.x, 6), "lat": round(pt.y, 6),
            "family": c[0] if c else p[1], "weight": c[1] if c else 0, "sub": p[0] if p else "",
            "fame": sum(1 for k in keys if k.startswith("name:") and len(k) <= 10),
            "wikidata": t.get("wikidata"), "area": area, "version": o.version,
            "heritage": bool(keys & {"heritage", "ref:mhs", "ref:FR:merimee"}),
            "chain": bool(keys & {"brand", "brand:wikidata"}),
            "web": bool(keys & {"website", "contact:website"}), "phone": bool(keys & {"phone", "contact:phone"}),
            "hours": "opening_hours" in keys, "extra": bool(keys & {"cuisine", "diet:vegetarian", "outdoor_seating"}),
            "nkeys": len(keys), "landmark_class": bool(c),
        })

    def node(self, n):
        if n.location.valid():
            self._add(n, f"node/{n.id}", lambda: (Point(n.location.lon, n.location.lat), 0))

    def area(self, a):
        def g():
            geom = wkb.loads(self.fab.create_multipolygon(a), hex=True)
            return geom.representative_point(), geom.area
        self._add(a, f"{'way' if a.from_way() else 'relation'}/{a.orig_id()}", g)


# ——— Variantes de notation ———
# Chacune renvoie (genre, note) : genre « landmark » (monuments, musées, parcs, gares) ou « place » (adresses).

def is_landmark(r):
    return r["landmark_class"] and (r["family"] == "train" or r["fame"] >= 3 or r["wikidata"])


def richness(r):
    return ((8 if r["wikidata"] else 0) + (0 if r["chain"] else min(r["fame"], 10)) - (2 if r["chain"] else 0)
            + (1.5 if r["web"] else 0) + (1 if r["phone"] else 0) + (1 if r["hours"] else 0) + (0.5 if r["extra"] else 0)
            + min(r["nkeys"] / 10, 2))


def v0(r, q):
    """Aujourd'hui : traductions du nom, Wikidata, catégorie, taille ; fiche bien remplie pour les adresses."""
    if is_landmark(r):
        return "landmark", r["fame"] + (8 if r["wikidata"] else 0) + r["weight"] * 4 + min(r["area"] * 1e7, 25) + 1000
    return "place", richness(r) + CAT_BONUS.get(r["family"], 0)


def qbonus(r, q):
    v = q.get(r["wikidata"] or "", 0)
    return 4 * math.log10(v) if v > 1 else 0


def v1(r, q):
    """+ QRank (consultations Wikipédia) pour tous les lieux qui ont une fiche Wikidata."""
    kind, s = v0(r, q)
    return kind, s + qbonus(r, q)


def v2(r, q):
    """+ monument historique, + attention des contributeurs OSM (nombre de versions de l'objet)."""
    kind, s = v1(r, q)
    s += (6 if r["heritage"] else 0) + min(math.log2(max(r["version"], 1)), 6)
    return kind, s


def percentile_scores(rows, base):
    """Note convertie en rang dans sa famille de genre (monuments d'un côté, adresses de l'autre), de 0 à 100."""
    by_kind = {}
    raw = []
    for r in rows:
        kind, s = base(r)
        raw.append((kind, s))
        by_kind.setdefault(kind, []).append(s)
    for k in by_kind:
        by_kind[k].sort()
    import bisect
    return [(kind, 100 * bisect.bisect_left(by_kind[kind], s) / max(1, len(by_kind[kind]))) for kind, s in raw]


def v3_factory(lm_bonus, base=None):
    """Deux classements séparés (monuments / adresses) ramenés en rang 0-100, puis mêlés : un monument n'écrase plus
    d'office une adresse ; « lm_bonus » points d'avance au monument à rang égal."""
    def run(rows, q):
        b = base or v2
        sc = percentile_scores(rows, lambda r: (lambda k, s: (k, s - (1000 if k == "landmark" else 0)))(*b(r, q)))
        return [(k, s + (lm_bonus if k == "landmark" else 0)) for k, s in sc]
    return run


VARIANTS = {"v0 aujourd'hui": v0, "v1 +QRank": v1, "v2 +QRank +patrimoine +versions OSM": v2,
            "v3a deux classements, signaux v0 (+15)": v3_factory(15, v0),
            "v3 deux classements, signaux v2 (+0)": v3_factory(0), "v3 deux classements, signaux v2 (+15)": v3_factory(15),
            "v3 deux classements, signaux v2 (+30)": v3_factory(30)}


def assign_zoom(items, lat0):
    """Comme build_overlays.assign_zoom, mais l'écart exigé entre lieux (la densité à l'écran) suit toujours la note
    d'aujourd'hui (« tscore ») : seules l'ordre et la composition changent d'une variante à l'autre, pas le nombre de
    lieux affichés — sinon une variante « gagnerait » en montrant simplement plus de lieux."""
    m_per_px0 = 156543.03 * math.cos(math.radians(lat0))
    kx = 111320 * math.cos(math.radians(lat0))
    xy = [(i["lon"] * kx, i["lat"] * 111320) for i in items]
    order = sorted(range(len(items)), key=lambda k: -items[k]["score"])
    tight = [0.45 if i["kind"] == "landmark" else min(1.0, max(0.3, 1.2 - i["tscore"] / 20)) for i in items]
    placed = []
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
            near = any(math.hypot(xy[j][0] - x, xy[j][1] - y)
                       < (d if items[j]["kind"] == it["kind"] else d / 2) * max(tight[k], tight[j])
                       for gx in (cx - 1, cx, cx + 1) for gy in (cy - 1, cy, cy + 1) for j in grid.get((gx, gy), ()))
            if not near:
                it["z"] = z
                placed.append(k)
                grid.setdefault((cx, cy), []).append(k)
    return [i for i in items if "z" in i]


def select(rows, q, variant, n_landmarks=4000):
    if callable(variant) and variant.__name__ == "run":
        scored = variant(rows, q)
    else:
        scored = [variant(r, q) for r in rows]
    items = []
    for r, (kind, s) in zip(rows, scored):
        k0, s0 = v0(r, q)
        items.append({**r, "kind": kind, "score": s, "tscore": s0 - (1000 if k0 == "landmark" else 0)})
    lms = sorted((i for i in items if i["kind"] == "landmark"), key=lambda i: -i["score"])[:n_landmarks]
    seen = {}
    for p in (i for i in items if i["kind"] == "place"):
        key = (p["name"].lower(), round(p["lat"], 3), round(p["lon"], 3))
        if key not in seen or seen[key]["score"] < p["score"]:
            seen[key] = p
    # deux lieux de même nom voisins (point et bâtiment) : on garde le mieux noté
    best = {}
    for i in lms:
        k = (i["name"], round(i["lat"], 2), round(i["lon"], 2))
        if k not in best or best[k]["score"] < i["score"]:
            best[k] = i
    all_items = list(best.values()) + list(seen.values())
    lat0 = sorted(i["lat"] for i in all_items)[len(all_items) // 2]
    return assign_zoom(all_items, lat0=lat0)


# ——— Comparaison à l'étalon ———

STOP = r"\b(le|la|les|l|de|du|des|d|the|het|de|restaurant|cafe|café|brasserie|bar|creperie|crêperie|eglise|église|musee|musée|museum|place|plein|hotel|hôtel)\b"


def norm(s):
    s = unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return " ".join(re.sub(STOP, " ", s).split())


def match(name, rows, bbox):
    """Le lieu de l'étalon dans nos données (même nom normalisé, ou nom contenu), dans le quartier élargi."""
    w, s, e, n = bbox
    m = 0.01
    n0 = norm(name)
    if not n0:
        return None
    cands = [r for r in rows if w - m <= r["lon"] <= e + m and s - m <= r["lat"] <= n + m]
    exact = [r for r in cands if norm(r["name"]) == n0]
    if exact:
        return exact
    part = [r for r in cands if n0 in norm(r["name"]) or (len(norm(r["name"])) > 3 and norm(r["name"]) in n0)]
    return part or None


def evaluate(city, et, rows, q):
    found = {}
    for kind in ("voir", "manger"):
        for name in et[kind]:
            m = match(name, rows, et["bbox"])
            found[(kind, name)] = {r["osm"] for r in m} if m else None
    out = {"absents d'OSM": sorted(n for (k, n), v in found.items() if v is None)}
    for vname, variant in VARIANTS.items():
        sel = select(rows, q, variant)
        z_of = {}
        for i in sel:
            z_of[i["osm"]] = min(z_of.get(i["osm"], 99), i["z"])
        res = {}
        for kind in ("voir", "manger"):
            zs = [min((z_of.get(o, 99) for o in found[(kind, n)]), default=99) for n in et[kind] if found[(kind, n)]]
            res[kind] = {f"z{z}": round(100 * sum(1 for x in zs if x <= z) / max(1, len(zs))) for z in (14, 15, 16)}
            res[kind]["n"] = len(zs)
        w, s, e, n = et["bbox"]
        vis = Counter(i["family"] for i in sel if i["z"] <= 15 and w <= i["lon"] <= e and s <= i["lat"] <= n)
        res["mélange z15"] = dict(vis.most_common())
        res["total z15"] = sum(vis.values())
        res["exemples manquants z16"] = [n for kind in ("voir", "manger") for n in et[kind]
                                          if found[(kind, n)] and min(z_of.get(o, 99) for o in found[(kind, n)]) > 16][:8]
        out[vname] = res
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("etalon")
    ap.add_argument("zones", nargs="+", help="ville=extrait.osm.pbf[:ouest,sud,est,nord]")
    ap.add_argument("--qrank", required=True)
    ap.add_argument("--out", default="data/eval/resultats.json")
    ap.add_argument("--cache", help="fichier des candidats déjà lus (évite de relire les extraits)")
    a = ap.parse_args()
    et = json.load(open(a.etalon))
    import os, pickle
    if a.cache and os.path.exists(a.cache):
        zones, q = pickle.load(open(a.cache, "rb"))
        a.zones = []
    else:
        zones, q = [], None
    for z in a.zones:
        city, rest = z.split("=")
        pbf, _, bb = rest.partition(":")
        h = Candidates(tuple(map(float, bb.split(","))) if bb else None)
        h.apply_file(pbf, locations=True)
        print(f"{city} : {len(h.rows)} candidats", file=sys.stderr, flush=True)
        zones.append((city, h.rows))
    if q is None:
        wanted = {r["wikidata"] for _, rows in zones for r in rows if r["wikidata"]}
        q = {}
        with gzip.open(a.qrank, "rt", encoding="utf-8") as f:
            for row in csv.reader(f):
                if row[0] in wanted:
                    q[row[0]] = int(row[1])
        print(f"QRank : {len(q)} lieux", file=sys.stderr, flush=True)
        if a.cache:
            pickle.dump((zones, q), open(a.cache, "wb"))
    results = {city: evaluate(city, et[city], rows, q) for city, rows in zones}
    json.dump(results, open(a.out, "w"), ensure_ascii=False, indent=1)
    for city, r in results.items():
        absent = ", ".join(r["absents d'OSM"]) or "aucun"
        print(f"\n== {city} (absents d'OSM : {absent})")
        for v, res in r.items():
            if v == "absents d'OSM":
                continue
            print(f"  {v:38s} voir {res['voir']}  manger {res['manger']}")
            print(f"  {'':38s} total z15 {res['total z15']} · mélange {res['mélange z15']} ; manquants z16 : {res['exemples manquants z16']}")


if __name__ == "__main__":
    main()
