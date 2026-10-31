"""Index de recherche des lieux, lu par le téléphone (recherche instantanée, sans service tiers).

Construit à partir des tuiles de lieux (build_places.py) et de la notoriété QRank (Wikidata, CC0),
téléchargée chaque semaine par build_extras.py dans extras.json (clé « qrank »).

    python app/scripts/build_search.py out/places --extras extras.json

Écrit l'index découpé (Île-de-France, 23/10/2026 : un fichier unique serait trop lourd pour le téléphone) :
    out/places/search/index.json   {"v":2, "zoom":12, "zones":["2075/1409", …]}
    out/places/search/core.json    l'essentiel de la région (lieux connus, gares, communes…), toujours chargé
    out/places/search/12/x/y.json  les autres lieux, par zone d'environ 6,5 km de côté (chargées autour de l'utilisateur)
    out/places/search.json         Paris seulement (l'ancien index unique), pour les versions de l'app pas encore à jour
Chaque fichier a le format :
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
import gzip
import json
import math
import os
import re
import shutil
import unicodedata

import tileio

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


ZONE = 12
# toujours chargés, où que l'on soit : ce que l'on cherche de loin (une gare, un musée, une commune, un lieu connu)
CORE_KV = {"railway=station", "public_transport=station", "tourism=museum", "tourism=attraction", "tourism=zoo",
           "tourism=theme_park", "leisure=stadium", "amenity=university", "amenity=hospital", "historic=castle", "historic=monument"}
CORE_RANK = 25
# lieux-dits trop nombreux pour le cœur (Bretagne, 31/10/2026 : 85 000 des 103 000 lieux du cœur, 5,7 Mo) :
# ils restent dans leur zone, trouvés quand on est à côté
NOT_CORE = {"place=hamlet", "place=isolated_dwelling", "place=farm", "place=locality", "place=plot", "place=square"}


def is_core(row, types):
    kv = types[row[4]]
    if kv in NOT_CORE:
        return False
    return kv.startswith("place=") or kv in CORE_KV or (len(row) > 5 and row[5] >= CORE_RANK)


def tile_of(lon, lat, z=ZONE):
    n = 2 ** z
    r = math.radians(lat)
    return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)


def pack(rows, types, streets):
    """Un fichier autonome : ses propres tables de types et de rues (indices renumérotés)."""
    ts = sorted({types[r[4]] for r in rows})
    ss = sorted({streets[int(r[8].split("|")[1])] for r in rows if len(r) > 8 and r[8]})
    ti, si = {k: i for i, k in enumerate(ts)}, {k: i for i, k in enumerate(ss)}
    out = []
    for r in rows:
        r = list(r)
        r[4] = ti[types[r[4]]]
        if len(r) > 8 and r[8]:
            num, s_, pc = r[8].split("|")
            r[8] = f"{num}|{si[streets[int(s_)]]}|{pc}"
        out.append(r)
    return {"v": 1, "types": ts, "streets": ss, "items": out}


def dump(path, obj):
    """JSON compressé (gzip, date nulle : fichier identique d'une semaine à l'autre si rien n'a changé)."""
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()
    with open(path, "wb") as f:
        f.write(gzip.compress(raw, 9, mtime=0))


def write_split(base, types, streets, rows):
    """Écrit core + zones (compressés, index v3) ; renvoie (nombre de lieux du cœur, {zone: nombre})."""
    core = [r for r in rows if is_core(r, types)]
    zones = {}
    for r in rows:
        if not is_core(r, types):
            zones.setdefault(tile_of(r[1], r[2]), []).append(r)
    d = os.path.join(base, "search")
    shutil.rmtree(d, ignore_errors=True)            # pas de fichiers d'une ancienne version qui traînent
    os.makedirs(d, exist_ok=True)
    dump(os.path.join(d, "core.json.gz"), pack(core, types, streets))
    legacy = os.path.join(base, "search.json")      # l'ancien index unique (avant le 23/10/2026) : plus servi
    if os.path.exists(legacy):
        os.remove(legacy)
    for (x, y), rs in zones.items():
        os.makedirs(os.path.join(d, str(ZONE), str(x)), exist_ok=True)
        dump(os.path.join(d, str(ZONE), str(x), f"{y}.json.gz"), pack(rs, types, streets))
    json.dump({"v": 3, "zoom": ZONE, "ext": ".json.gz", "built": datetime.date.today().isoformat(),
               "zones": sorted(f"{x}/{y}" for x, y in zones)},
              open(os.path.join(d, "index.json"), "w"), separators=(",", ":"))
    return len(core), {f"{x}/{y}": len(rs) for (x, y), rs in zones.items()}


def read_tiles(places_dir):
    for it in tileio.iter_items(places_dir):
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
    n_core, zones = write_split(args.places, types, streets, rows)
    size = lambda p: os.path.getsize(p) // 1024
    zdir = os.path.join(args.places, "search", str(ZONE))
    biggest = max((size(os.path.join(r, f)) for r, _, fs in os.walk(zdir) for f in fs), default=0)
    print(f"{len(rows)} lieux dans l'index ({sum(1 for r in rows if r[5])} avec notoriété) : cœur {n_core} lieux "
          f"({size(os.path.join(args.places, 'search', 'core.json.gz'))} Ko), {len(zones)} zones (la plus lourde : {biggest} Ko)")


if __name__ == "__main__":
    main()
