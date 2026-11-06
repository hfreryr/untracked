"""Tuiles de lieux adaptatives et compressées (décision du 31/10/2026, voir docs/villes.md).

Les lieux sont rangés par carré de zoom 14 (≈ 2,4 km de côté à Paris), puis regroupés en fichiers aussi grands que
possible : on part de carrés de zoom 10 (≈ 40 km) et on ne coupe en 4 que tant qu'un fichier compressé dépasse
TARGET. À la campagne, un fichier couvre donc un canton ; en ville, il reste à 2,4 km. Les fichiers sont stockés
compressés (gzip) : c'est leur taille stockée qui compte dans la limite de 1 Go de GitHub Pages.

Mesuré sur l'Ille-et-Vilaine (30/10/2026) : 2 984 fichiers et 9,6 Mo en tuiles fixes non compressées,
≈ 100 fichiers et ≈ 2,4 Mo ici.

Fichiers :  <dossier>/<z>/<x>/<y>.json.gz   ({"v":1,"t":[[id, lon, lat, {tags}, devanture?], …]}, compressé)
Index :     <dossier>/index.json            {"v":2, "zooms":[10,…,14], "tiles":["12/2041/1405", …], "cells": n, …}
"""
import glob
import gzip
import json
import math
import os
from collections import defaultdict

CELL = 14          # zoom des carrés de base
ZMIN = 10          # plus grand fichier possible (≈ 40 km de côté)
TARGET = 48_000    # taille compressée au-delà de laquelle un fichier est coupé en 4


def cell_of(lon, lat, z=CELL):
    n = 2 ** z
    r = math.radians(lat)
    return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)


def pack(items):
    """Contenu d'un fichier, compressé. mtime=0 : un fichier inchangé reste identique octet pour octet (sinon chaque
    nuit réécrirait tous les fichiers dans l'historique du site)."""
    s = json.dumps({"v": 1, "t": sorted(items, key=lambda it: it[0])}, ensure_ascii=False, separators=(",", ":"))
    return gzip.compress(s.encode(), 9, mtime=0)


def split(cells, zmin=ZMIN, zmax=CELL, target=TARGET):
    """{(x, y) de zoom 14: [lieux]} → {(z, x, y): octets compressés}, en coupant en 4 tant que c'est trop gros."""
    out = {}

    def go(z, x, y, sub):
        data = pack([it for v in sub.values() for it in v])
        if z >= zmax or len(data) <= target:
            out[(z, x, y)] = data
            return
        kids = defaultdict(dict)
        s = zmax - z - 1
        for (cx, cy), v in sub.items():
            kids[(cx >> s, cy >> s)][(cx, cy)] = v
        for (kx, ky), ksub in kids.items():
            go(z + 1, kx, ky, ksub)

    roots = defaultdict(dict)
    for (cx, cy), v in cells.items():
        if v:
            roots[(cx >> (zmax - zmin), cy >> (zmax - zmin))][(cx, cy)] = v
    for (x, y), sub in roots.items():
        go(zmin, x, y, sub)
    return out


COVER = 13   # carrés de zoom 13 (≈ 3 km) qui ont au moins un lieu : là, le fond de carte cède la place à nos lieux


def cover(cells, z=COVER):
    """Carrés de zoom `z` habités, en rangées : [[y, x début, x fin], …] (06/11/2026 : le cadre rectangulaire d'une région
    débordait à l'étranger, et le fond de carte y était effacé sans rien à la place : Genève, Bâle, Kehl…). Pure."""
    s = CELL - z
    rows = defaultdict(set)
    for (x, y), v in cells.items():
        if v:
            rows[y >> s].add(x >> s)
    out = []
    for y in sorted(rows):
        xs = sorted(rows[y])
        start = prev = xs[0]
        for x in xs[1:]:
            if x != prev + 1:
                out.append([y, start, prev])
                start = x
            prev = x
        out.append([y, start, prev])
    return out


def metrics(cells):
    """Ce que valent les lieux, champ par champ (06/11/2026 : les photos Wikimedia d'Île-de-France ont été remplacées
    par rien, et seul le nombre de lieux était contrôlé). Comparé à la version en ligne avant publication. Pure."""
    m = dict.fromkeys(("places", "named", "hours", "site_photos", "wiki_photos", "articles", "facades"), 0)
    for items in cells.values():
        for it in items:
            t = it[3]
            m["places"] += 1
            m["named"] += bool(t.get("name"))
            m["hours"] += bool(t.get("opening_hours"))
            m["site_photos"] += bool(t.get("_photo"))
            m["wiki_photos"] += bool(t.get("_wph"))
            m["articles"] += bool(t.get("_wt"))
            m["facades"] += len(it) > 4 and bool(it[4])
    return m


def write(out_dir, cells, meta, **kw):
    """Écrit les fichiers et l'index ; renvoie la liste des tailles compressées."""
    files = split(cells, **kw)
    for (z, x, y), data in files.items():
        d = os.path.join(out_dir, str(z), str(x))
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, f"{y}.json.gz"), "wb") as f:
            f.write(data)
    index = {"v": 2, "zooms": sorted({z for z, _, _ in files}), "cells": sum(1 for v in cells.values() if v), **meta,
             "tiles": sorted(f"{z}/{x}/{y}" for z, x, y in files), "cover": {"z": COVER, "rows": cover(cells)},
             "metrics": metrics(cells)}
    with open(os.path.join(out_dir, "index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"))
    return [len(d) for d in files.values()]


def read_file(path):
    with open(path, "rb") as f:
        b = f.read()
    return json.loads(gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b)


def iter_items(places_dir):
    """Tous les lieux d'un dossier de tuiles, ancien format (14/x/y.json) ou nouveau (z/x/y.json.gz)."""
    for path in glob.glob(os.path.join(places_dir, "[0-9]*", "*", "*.json*")):
        yield from read_file(path)["t"]
