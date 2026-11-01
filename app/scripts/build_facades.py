#!/usr/bin/env python3
"""
Devanture de chaque lieu : une photo Panoramax (Street View libre) prise près du lieu, et l'angle où regarder.

Source : le méta-catalogue Panoramax (api.panoramax.xyz), qui fédère les instances publiques. À Paris, l'essentiel
vient de la campagne de la Ville de Paris (photos 360°, Licence Ouverte 2.0, instance IGN). Les photos
d'autres contributeurs (CC-BY-SA 4.0) servent en second choix, avec leur crédit.

Entrée : les tuiles de lieux (build_places.py) et la boîte de la ville.
Sortie : facades.json  { "<id lieu>": [idPhoto, hôte, azimut, capVersLeLieu, distance, licence, auteur, date] }
L'app ne fait aucune requête Panoramax à l'usage : elle charge seulement l'image choisie, et la recadre.

Usage :  python app/scripts/build_facades.py --places app/static/data/places --bbox 2.224,48.815,2.47,48.902 --out facades.json
Mesuré le 13/10/2026 sur le 6e : 63 177 photos, 82 % des commerces ont une photo 360° à moins de 18 m.
"""
import argparse, collections, glob, json, math, sys, time, urllib.parse, urllib.request

import tileio

API = "https://api.panoramax.xyz/api/search"
UA = "UntrackedMaps/0.2 (https://untrackedmaps.app; facades build)"
R = 111320
# Étiquettes des lieux dont on veut la devanture
WANT = ("shop", "amenity", "tourism", "leisure", "craft", "office", "healthcare")
SKIP_AMENITY = {"parking", "bicycle_parking", "toilets", "atm", "drinking_water", "charging_station", "bench", "waste_basket"}


def dist(a, b):
    return math.hypot((a[0] - b[0]) * math.cos(math.radians(a[1])) * R, (a[1] - b[1]) * R)


def bearing(a, b):
    k = math.cos(math.radians(a[1]))
    return (math.degrees(math.atan2((b[0] - a[0]) * k, b[1] - a[1])) + 360) % 360


def fetch(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # réseau ou 5xx : on réessaie
            if i == tries - 1:
                print("échec", url[:120], e, file=sys.stderr)
                return None
            time.sleep(5 * (i + 1))


def instance_host(feature):
    """Hôte de l'instance Panoramax qui héberge la photo (lien « via » du méta-catalogue), celui que l'app interroge
    en /api/pictures/<id>/sd.jpg. Pas l'hôte de « geovisio:image » : pour une partie des photos de l'IGN, c'est leur
    stockage S3, où cette adresse n'existe pas (constaté le 01/11/2026 : 38 % des devantures sans image)."""
    for link in feature.get("links") or []:
        if link.get("rel") == "via" and link.get("href"):
            return urllib.parse.urlparse(link["href"]).netloc
    img = (feature.get("properties") or {}).get("geovisio:image") or ""
    host = urllib.parse.urlparse(img).netloc
    return "" if ".s3." in host else host


def photos_in(bbox, cell=0.005):
    """Toutes les photos 360° d'une boîte, par cellules assez petites pour rester sous la limite de 10 000 par appel."""
    w, s, e, n = bbox
    out = {}
    nx = max(1, math.ceil((e - w) / cell))
    ny = max(1, math.ceil((n - s) / (cell * 0.66)))
    calls = 0
    for i in range(nx):
        for j in range(ny):
            cw, ce = w + (e - w) * i / nx, w + (e - w) * (i + 1) / nx
            cs, cn = s + (n - s) * j / ny, s + (n - s) * (j + 1) / ny
            url = f"{API}?bbox={cw:.5f},{cs:.5f},{ce:.5f},{cn:.5f}&limit=10000"
            d = fetch(url)
            calls += 1
            if not d:
                continue
            feats = d.get("features", [])
            if len(feats) >= 10000:
                print(f"cellule {i},{j} saturée (10 000) : photos manquantes", file=sys.stderr)
            for f in feats:
                p = f["properties"]
                io = p.get("pers:interior_orientation") or {}
                if (io.get("field_of_view") or 360) != 360 or p.get("view:azimuth") is None:
                    continue
                host = instance_host(f)
                if not host:
                    continue
                out[f["id"]] = (f["geometry"]["coordinates"][0], f["geometry"]["coordinates"][1], float(p["view:azimuth"]),
                                host, p.get("license") or "", p.get("geovisio:producer") or "", (p.get("datetime") or "")[:10])
            time.sleep(0.3)
    print(f"{len(out)} photos 360° en {calls} appels")
    return out


def wanted(tags):
    if tags.get("amenity") in SKIP_AMENITY:
        return False
    return "name" in tags and any(k in tags for k in WANT)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--places", default="app/static/data/places")
    ap.add_argument("--bbox", required=True, help="ouest,sud,est,nord")
    ap.add_argument("--out", default="facades.json")
    ap.add_argument("--cell", type=float, default=0.005)
    args = ap.parse_args()
    bbox = [float(x) for x in args.bbox.split(",")]
    t0 = time.time()
    pics = photos_in(bbox, args.cell)
    cell = 0.0005
    grid = collections.defaultdict(list)
    for pid, p in pics.items():
        grid[(int(p[0] / cell), int(p[1] / cell))].append((pid, p))
    places = []
    for pid, lon, lat, tags, *_ in tileio.iter_items(args.places):   # (5e élément : devanture déjà présente)
        if bbox[0] < lon < bbox[2] and bbox[1] < lat < bbox[3] and wanted(tags):
            places.append((pid, lon, lat))
    out = {}
    for pid, lon, lat in places:
        cx, cy = int(lon / cell), int(lat / cell)
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for qid, p in grid[(cx + dx, cy + dy)]:
                    d = dist(p, (lon, lat))
                    if not 4 <= d <= 18:
                        continue
                    # Licence Ouverte d'abord (Ville de Paris / IGN), puis la plus proche de 9 m, puis la plus récente
                    key = (0 if p[4].startswith("etalab") else 1, abs(d - 9), p[6] and -int(p[6][:4]) or 0)
                    if best is None or key < best[0]:
                        best = (key, qid, p, d)
        if best:
            _, qid, p, d = best
            out[str(pid)] = [qid, p[3], round(p[2]), round(bearing(p, (lon, lat))), round(d), p[4], p[5], p[6]]
    json.dump(out, open(args.out, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out)} devantures pour {len(places)} lieux ({100 * len(out) / max(1, len(places)):.0f} %), en {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
