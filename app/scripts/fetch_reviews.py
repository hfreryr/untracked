"""Avis libres de Mangrove (Open Reviews Association) dans un cadre, récupérés en une seule demande, pour les fiches.

Licence des avis : CC BY 4.0 (conditions de Mangrove, https://mangrove.reviews/terms, vérifiées le 30/10/2026).
L'app ne contacte pas Mangrove pour lire : les avis sont rangés dans les tuiles de lieux (build_places.py --reviews).

Usage :  python app/scripts/fetch_reviews.py --bbox 1.44,48.12,3.56,49.24 --out reviews.json
Sortie : [{"osm": "node/123" | null, "lat", "lon", "name", "r" (0-100), "o" (texte), "n" (pseudo), "t" (date unix),
           "s" (signature), "img" (nombre de photos)}, …]
"""
import argparse
import json
import re
import sys
import urllib.parse
import urllib.request

API = "https://api.mangrove.reviews"
GEO = re.compile(r"^geo:(-?[\d.]+),(-?[\d.]+)")


def normalize(raw):
    """Réponse de l'API → avis simplifiés ; ignore ce qui n'est pas un avis de lieu noté."""
    out = []
    for rv in raw.get("reviews", []):
        p = rv.get("payload") or {}
        m = GEO.match(p.get("sub") or "")
        if not m or p.get("action") or p.get("rating") is None:      # actions (signalements, modifications…) : pas un avis
            continue
        q = urllib.parse.parse_qs(urllib.parse.urlsplit(p["sub"]).query)
        meta = p.get("metadata") or {}
        osm = meta.get("osm_id")
        osm = "/".join(osm.split("/")[:2]) if isinstance(osm, str) and re.match(r"^(node|way|relation)/\d+", osm) else None
        out.append({"osm": osm, "lat": float(m.group(1)), "lon": float(m.group(2)), "name": (q.get("q") or [""])[0],
                    "r": int(p["rating"]), "o": (p.get("opinion") or "").strip(), "n": (meta.get("nickname") or "").strip(),
                    "t": int(p.get("iat") or 0), "s": rv.get("signature"), "img": len(p.get("images") or []),
                    "_k": (rv.get("kid") or rv.get("signature"), osm or p["sub"])})
    # une même personne qui a réécrit son avis sur le même lieu : seul le plus récent compte
    latest = {}
    for r in out:
        if r["_k"] not in latest or r["t"] > latest[r["_k"]]["t"]:
            latest[r["_k"]] = r
    return [{k: v for k, v in r.items() if k != "_k"} for r in out if latest[r["_k"]] is r]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", required=True, help="ouest,sud,est,nord")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    w, s, e, n = a.bbox.split(",")
    url = f"{API}/geo?" + urllib.parse.urlencode({"xmin": w, "ymin": s, "xmax": e, "ymax": n})
    with urllib.request.urlopen(url, timeout=120) as r:
        reviews = normalize(json.load(r))
    json.dump(reviews, open(a.out, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(reviews)} avis ({sum(1 for x in reviews if x['osm'])} avec leur lieu OSM)", file=sys.stderr)


if __name__ == "__main__":
    main()
