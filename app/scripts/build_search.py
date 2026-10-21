"""Index de recherche des lieux, lu par le téléphone (recherche instantanée, sans service tiers).

Construit à partir des tuiles de lieux (build_places.py) et de la notoriété QRank (Wikidata, CC0),
téléchargée chaque semaine par build_extras.py dans extras.json (clé « qrank »).

    python app/scripts/build_search.py out/places --extras extras.json

Écrit out/places/search.json :
    {"v":1, "built":…, "types":["tourism=museum", …], "streets":["Rue de Rennes", …],
     "items":[[nom, lon, lat, id, type, notoriété, autres noms?, extra?, adresse?], …]}
- notoriété : 0 à 99 (log10 du nombre de vues Wikipédia × 10, d'après QRank ; 0 sans Wikidata) ;
- autres noms : alt_name, old_name, short_name, official_name… séparés par « ; » ;
- extra : cuisine et régime (« v » végétarien, « V » végétalien), pour les recherches « restaurant italien », « vegan » ;
- adresse : « numéro|rue|code postal », la rue étant un indice dans « streets » (les champs vides en fin de ligne sont omis).
  Numéro « ~ » : pas d'adresse connue, rue la plus proche (affichée « près de … »).
Doublons (même nom à moins de 200 m, ou même Wikidata) : on garde le plus connu, puis le plus utile (une gare plutôt que son quai).
"""
import argparse
import datetime
import glob
import json
import math
import os
import re
import unicodedata

MAIN = ("amenity", "shop", "tourism", "leisure", "healthcare", "office", "craft", "historic", "railway", "public_transport", "place", "building")
ALT = ("alt_name", "old_name", "short_name", "official_name", "loc_name", "name:fr")
# lieux sans intérêt pour la recherche par nom (ils doublonnent la gare, le lieu ou la rue dont ils portent le nom)
SKIP = {("railway", "subway_entrance"), ("railway", "train_station_entrance"), ("public_transport", "platform"),
        ("public_transport", "stop_position"), ("amenity", "taxi"), ("amenity", "bicycle_rental"), ("railway", "platform"),
        ("amenity", "parking_entrance"), ("tourism", "information"), ("amenity", "vending_machine"), ("amenity", "post_box")}
# en cas de doublon, ordre de préférence (plus petit = préféré)
PREFER = {"railway=station": 0, "public_transport=station": 1, "tourism=museum": 0, "tourism=attraction": 1, "leisure=park": 0}


def norm(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def main_tag(t):
    for k in MAIN:
        if k in t:
            return f"{k}={t[k].split(';')[0]}"
    return ""


def extra_of(t):
    x = t.get("cuisine", "").split(";")[0].strip()
    diet = ""
    if t.get("diet:vegan") in ("yes", "only"):
        diet = "V"
    elif t.get("diet:vegetarian") in ("yes", "only"):
        diet = "v"
    return f"{x}|{diet}" if (x or diet) else ""


def notoriety(t, qrank):
    q = qrank.get(t.get("wikidata", ""), 0)
    return min(99, round(10 * math.log10(q))) if q > 1 else 0


def build(items, qrank):
    """items : [(id, lon, lat, tags)] → (types, lignes de l'index)."""
    rows = []
    for oid, lon, lat, t in items:
        name = (t.get("name") or "").strip()
        if not name:
            continue
        kv = main_tag(t)
        if tuple(kv.split("=", 1)) in SKIP:
            continue
        alts = sorted({a.strip() for k in ALT for a in (t.get(k) or "").split(";") if a.strip() and norm(a) != norm(name)})
        rows.append({"name": name, "lon": round(lon, 5), "lat": round(lat, 5), "id": oid, "kv": kv,
                     "rank": notoriety(t, qrank), "alts": ";".join(alts), "x": extra_of(t), "wd": t.get("wikidata"),
                     # sans adresse : la rue la plus proche (« _rue », build_places.py), marquée « ~ » : l'app affiche « près de … »
                     # (mesuré le 21/10 sur 3 000 lieux à adresse connue : bonne rue 78 %, rue voisine 19 %, aucune 3 %)
                     "num": t.get("addr:housenumber", "") if t.get("addr:street") else ("~" if t.get("_rue") else ""),
                     "street": t.get("addr:street") or t.get("_rue", ""), "pc": t.get("addr:postcode", "") if t.get("addr:street") else ""})
    # doublons : même Wikidata, ou même nom à moins de 200 m (grille de ≈ 200 m)
    rows.sort(key=lambda r: (-r["rank"], PREFER.get(r["kv"], 5), -len(r["alts"])))
    seen_wd, seen_cell, kept = set(), set(), []
    for r in rows:
        if r["wd"] and r["wd"] in seen_wd:
            continue
        n = norm(r["name"])
        cx, cy = int(r["lon"] / 0.0027), int(r["lat"] / 0.0018)
        cells = {(n, cx + dx, cy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        if cells & seen_cell:
            continue
        seen_cell.add((n, cx, cy))
        if r["wd"]:
            seen_wd.add(r["wd"])
        kept.append(r)
    types = sorted({r["kv"] for r in kept})
    ti = {k: i for i, k in enumerate(types)}
    streets = sorted({r["street"] for r in kept if r["street"]})
    si = {k: i for i, k in enumerate(streets)}
    out = []
    for r in kept:
        addr = f'{r["num"]}|{si[r["street"]]}|{r["pc"]}' if r["street"] else ""
        row = [r["name"], r["lon"], r["lat"], r["id"], ti[r["kv"]], r["rank"], r["alts"], r["x"], addr]
        while row[-1] == "":
            row.pop()
        out.append(row)
    return types, streets, out


def read_tiles(places_dir):
    for f in glob.glob(os.path.join(places_dir, "*", "*", "*.json")):
        for it in json.load(open(f))["t"]:
            yield it[0], it[1], it[2], it[3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("places", help="dossier des tuiles de lieux (sortie de build_places.py)")
    ap.add_argument("--extras", help="extras.json (pour la notoriété QRank)")
    args = ap.parse_args()
    qrank = {}
    if args.extras and os.path.exists(args.extras):
        qrank = json.load(open(args.extras)).get("qrank", {})
    types, streets, rows = build(read_tiles(args.places), qrank)
    out = {"v": 1, "built": datetime.date.today().isoformat(), "types": types, "streets": streets, "items": rows}
    path = os.path.join(args.places, "search.json")
    with open(path, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(rows)} lieux dans l'index, {os.path.getsize(path) // 1024} Ko ({sum(1 for r in rows if r[5])} avec notoriété)")


if __name__ == "__main__":
    main()
