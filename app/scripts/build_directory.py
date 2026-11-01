"""Annuaire national des lieux par nom (01/11/2026) : trouver « Gordes », « Palais des Papes » ou le Rijksmuseum
depuis n'importe où, sans service tiers (règle du porteur : la bonne réponse quelle que soit la distance).

Réunit l'essentiel de chaque région déjà publiée (search/core.json[.gz], build_search.py) : communes, gares, musées,
châteaux, lieux connus. Les quartiers et lieux-dits restent dans leur région (trouvés quand on est à côté).
Découpé par début de mot, pour que le téléphone ne charge que un ou deux petits fichiers par recherche :
un lieu figure dans le fichier de chacun de ses mots (« Palais des Papes » : « pa »), et un début trop fréquent
(« sa » de « Saint ») est redécoupé sur 3, 4… lettres.

    python app/scripts/build_directory.py <dossier data du site>        (ex. pages/data)

Écrit <data>/directory/index.json {"v":1, "keys":{"go":412, "sai":1300, …}} et <data>/directory/<clé>.json.gz,
au format des index de recherche (types, streets, items). Fichiers de 40 Ko au plus visés (≈ 1 500 lieux).
"""
import argparse
import datetime
import glob
import gzip
import json
import os
import shutil

from build_search import dump, norm, pack

# toujours dans l'annuaire : ce que l'on cherche de loin
KEEP_KV = {"railway=station", "public_transport=station", "tourism=museum", "tourism=attraction", "tourism=zoo",
           "tourism=theme_park", "leisure=stadium", "amenity=university", "amenity=hospital", "historic=castle",
           "historic=monument", "place=city", "place=town", "place=village", "place=municipality", "place=island",
           "aeroway=aerodrome", "leisure=park"}
# quartiers, lieux-dits, îlots : seulement s'ils sont connus (« Montmartre » oui, « Les Hauts de Bel Air » non)
LOCAL_PLACE_RANK = 30
RANK = 25            # tout lieu assez connu (vues Wikipédia), quel que soit son type
STOP = {"de", "du", "des", "la", "le", "les", "l", "d", "a", "au", "aux", "et", "en", "sur", "the", "and", "of"}
MAX_ITEMS = 1500     # au-delà, le début de mot est redécoupé sur une lettre de plus


def keep(kv, rank):
    if kv in KEEP_KV or rank >= RANK:
        return True
    return kv.startswith("place=") and rank >= LOCAL_PLACE_RANK


def words_of(text):
    """Mots d'un nom (comme searchindex.js) : plus les élisions collées (« d orsay » → « dorsay »)."""
    w = [x for x in norm(text).split(" ") if x]
    out = set(w)
    for i in range(len(w) - 1):
        if len(w[i]) == 1:
            out.add(w[i] + w[i + 1])
    return {x for x in out if len(x) >= 2 and x not in STOP}


def read_core(search_dir):
    for name in ("core.json.gz", "core.json"):
        p = os.path.join(search_dir, name)
        if os.path.exists(p):
            raw = gzip.open(p).read() if p.endswith(".gz") else open(p, "rb").read()
            return json.loads(raw)
    return None


def collect(data_dir):
    """Lieux retenus de toutes les régions : liste de (ligne, types, streets) ; doublons retirés (cadres qui se chevauchent)."""
    dirs = [os.path.join(data_dir, "places", "search")] + sorted(glob.glob(os.path.join(data_dir, "zones", "*", "places", "search")))
    seen_id, seen_cell, out = set(), set(), []
    for d in dirs:
        core = read_core(d)
        if not core:
            continue
        types, streets = core["types"], core.get("streets", [])
        for r in core["items"]:
            kv, rank = types[r[4]], (r[5] if len(r) > 5 else 0)
            if not keep(kv, rank) or r[3] in seen_id:
                continue
            cell = (norm(r[0]), int(r[1] / 0.0027), int(r[2] / 0.0018))
            if cell in seen_cell:
                continue
            seen_id.add(r[3])
            seen_cell.add(cell)
            out.append((list(r), types, streets))
    return out


def bucket(entries, depth=2):
    """{clé: [indices]} : chaque lieu sous le début de chacun de ses mots, redécoupé tant qu'un fichier est trop gros."""
    keys = {}
    for i, (r, _, _) in enumerate(entries):
        ws = words_of(r[0]) | {w for a in (r[6].split(";") if len(r) > 6 and r[6] else []) for w in words_of(a)}
        for w in ws:
            keys.setdefault(w, set()).add(i)
    out = {}

    def split(prefix, words):
        items = set().union(*(keys[w] for w in words))
        longer = [w for w in words if len(w) > len(prefix)]
        if len(items) <= MAX_ITEMS or not longer:
            out[prefix] = items
            return
        # les mots égaux au début (« sai ») restent sous ce début ; les autres descendent d'une lettre
        exact = [w for w in words if len(w) == len(prefix)]
        if exact:
            out[prefix] = set().union(*(keys[w] for w in exact))
        sub = {}
        for w in longer:
            sub.setdefault(w[: len(prefix) + 1], []).append(w)
        for p, ws in sub.items():
            split(p, ws)

    first = {}
    for w in keys:
        first.setdefault(w[:depth], []).append(w)
    for p, ws in first.items():
        split(p, ws)
    return out


def merged_pack(rows):
    """Un fichier : lignes venues de régions différentes, ramenées à une seule table de types et de rues."""
    types = sorted({t[r[4]] for r, t, _ in rows})
    streets = sorted({s[int(r[8].split("|")[1])] for r, _, s in rows if len(r) > 8 and r[8]})
    ti, si = {k: i for i, k in enumerate(types)}, {k: i for i, k in enumerate(streets)}
    items = []
    for r, t, s in rows:
        r = list(r)
        r[4] = ti[t[r[4]]]
        if len(r) > 8 and r[8]:
            num, k, pc = r[8].split("|")
            r[8] = f"{num}|{si[s[int(k)]]}|{pc}"
        items.append(r)
    return pack(items, types, streets)


def write(data_dir, entries, buckets):
    d = os.path.join(data_dir, "directory")
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    for k, idx in buckets.items():
        dump(os.path.join(d, f"{k}.json.gz"), merged_pack([entries[i] for i in sorted(idx)]))
    json.dump({"v": 1, "ext": ".json.gz", "built": datetime.date.today().isoformat(),
               "keys": {k: len(v) for k, v in sorted(buckets.items())}},
              open(os.path.join(d, "index.json"), "w"), separators=(",", ":"))
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data", help="dossier data/ du site (places/, zones/<id>/places/)")
    args = ap.parse_args()
    entries = collect(args.data)
    buckets = bucket(entries)
    d = write(args.data, entries, buckets)
    sizes = [os.path.getsize(os.path.join(d, f)) for f in os.listdir(d) if f.endswith(".gz")]
    print(f"annuaire : {len(entries)} lieux, {len(buckets)} fichiers, {sum(sizes) // 1024} Ko "
          f"(le plus lourd : {max(sizes, default=0) // 1024} Ko)")


if __name__ == "__main__":
    main()
