"""Lignes de métro et de tram des grandes villes françaises, pour la carte « Transports » hors Île-de-France.

  static/data/transit-cities.geojson   mêmes propriétés que transit-lines.geojson (mode, ref, colour), plus « city »

Chaque ville est lue dans l'extrait OpenStreetMap de son département (download.openstreetmap.fr, quelques dizaines
de Mo chacun, gardés dans data/villes/) : jamais d'Overpass. Seules les lignes dont le tracé passe dans le cadre de
la ville sont gardées (un extrait départemental peut déborder sur un réseau voisin).

Usage :  python app/scripts/build_transit_cities.py            (télécharge les extraits manquants, puis construit)
         python app/scripts/build_transit_cities.py --offline  (n'utilise que les extraits déjà téléchargés)
Données © contributeurs OpenStreetMap, licence ODbL.
"""
import argparse
import json
import sys
import urllib.request
from pathlib import Path

import osmium
from shapely.geometry import box, mapping

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_overlays import DEFAULT_COLOURS, Ways, line_geometry  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "villes"
OUT = Path(__file__).resolve().parent.parent / "static" / "data" / "transit-cities.geojson"
BASE = "https://download.openstreetmap.fr/extracts/europe/france/"

# ville → (extrait départemental, cadre ouest, sud, est, nord)
CITIES = {
    "lyon": ("rhone_alpes/rhone", (4.68, 45.62, 5.08, 45.86)),
    "marseille": ("provence_alpes_cote_d_azur/bouches_du_rhone", (5.23, 43.17, 5.62, 43.42)),
    "lille": ("nord_pas_de_calais/nord", (2.90, 50.52, 3.32, 50.78)),
    "toulouse": ("midi_pyrenees/haute_garonne", (1.24, 43.48, 1.62, 43.72)),
    "bordeaux": ("aquitaine/gironde", (-0.80, 44.70, -0.40, 44.98)),
    "nantes": ("pays_de_la_loire/loire_atlantique", (-1.75, 47.12, -1.40, 47.32)),
    "strasbourg": ("alsace/bas_rhin", (7.62, 48.48, 7.90, 48.66)),
    "rennes": ("bretagne/ille_et_vilaine", (-1.80, 48.03, -1.55, 48.20)),
    "montpellier": ("languedoc_roussillon/herault", (3.75, 43.53, 4.00, 43.70)),
    "grenoble": ("rhone_alpes/isere", (5.62, 45.10, 5.85, 45.26)),
    "nice": ("provence_alpes_cote_d_azur/alpes_maritimes", (7.10, 43.62, 7.40, 43.80)),
}


def city_mode(t):
    """Métro (y compris VAL et métro sur pneus) et tram ; ni bus, ni funiculaire, ni train régional."""
    r = t.get("route")
    if r == "subway":
        return "metro"
    if r in ("tram", "light_rail"):
        return "tram"
    return None


class CityRoutes(osmium.SimpleHandler):
    """Relations de lignes ; numéro et couleur pris sur la ligne, sinon sur son « route_master » (tram B de Bordeaux)."""
    def __init__(self):
        super().__init__()
        self.routes = {}   # id -> (mode, ref, colour, ways)
        self.masters = {}  # id d'un trajet -> (ref, colour) de sa ligne

    def relation(self, r):
        t = r.tags
        if t.get("type") == "route_master":
            for m in r.members:
                if m.type == "r":
                    self.masters[m.ref] = ((t.get("ref") or "").strip(), t.get("colour"))
            return
        if t.get("type") != "route":
            return
        mode = city_mode(t)
        if mode:
            ways = [m.ref for m in r.members if m.type == "w" and m.role in ("", "forward", "backward")]
            self.routes[r.id] = (mode, (t.get("ref") or "").strip(), t.get("colour"), ways)

    @property
    def lines(self):
        """(mode, ref) -> {colour, ways, relations} ; numéros courts seulement (ni navettes d'événement, ni tram-train TER)."""
        out = {}
        for rid, (mode, ref, colour, ways) in self.routes.items():
            mref, mcolour = self.masters.get(rid, ("", None))
            ref = ref or mref
            if not ref or len(ref) > 3 or ref.startswith("TER"):
                continue
            e = out.setdefault((mode, ref), {"colour": None, "ways": set(), "relations": []})
            e["colour"] = e["colour"] or colour or mcolour
            e["relations"].append(ways)
            e["ways"].update(ways)
        return out


def colour_of(c, mode):
    c = (c or DEFAULT_COLOURS[mode]).strip()
    return ("#" + c if not c.startswith("#") else c).upper()


def build_city(name, pbf, bbox):
    rt = CityRoutes()
    rt.apply_file(str(pbf))
    lines = rt.lines
    wanted = set().union(*(e["ways"] for e in lines.values())) if lines else set()
    wy = Ways(wanted)
    wy.apply_file(str(pbf), locations=True)
    frame = box(*bbox)
    feats = []
    for (mode, ref), e in sorted(lines.items()):
        g = line_geometry(e["relations"], wy.geoms)
        if g is None or not g.intersects(frame):
            continue
        geom = mapping(g)
        geom["coordinates"] = json.loads(json.dumps(geom["coordinates"]), parse_float=lambda v: round(float(v), 5))
        feats.append({"type": "Feature", "geometry": geom,
                      "properties": {"mode": mode, "ref": ref, "colour": colour_of(e["colour"], mode), "city": name}})
    return feats


def fetch(path):
    CACHE.mkdir(parents=True, exist_ok=True)
    dst = CACHE / (path.split("/")[-1] + ".osm.pbf")
    if not dst.exists():
        print(f"téléchargement {path}…", flush=True)
        tmp = dst.with_suffix(".part")
        urllib.request.urlretrieve(BASE + path + "-latest.osm.pbf", tmp)
        tmp.rename(dst)
    return dst


def main(offline=False, only=None):
    feats = []
    for name, (path, bbox) in CITIES.items():
        if only and name not in only:
            continue
        pbf = CACHE / (path.split("/")[-1] + ".osm.pbf")
        if not offline:
            pbf = fetch(path)
        if not pbf.exists():
            print(f"{name} : extrait absent, ignoré")
            continue
        f = build_city(name, pbf, bbox)
        print(f"{name} : {len(f)} lignes {[p['properties']['ref'] for p in f]}", flush=True)
        feats += f
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")))
    print(f"{OUT.name} : {len(feats)} lignes, {OUT.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="ne rien télécharger")
    ap.add_argument("--only", nargs="*", help="villes à construire (par défaut toutes)")
    a = ap.parse_args()
    main(a.offline, a.only)
