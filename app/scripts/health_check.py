#!/usr/bin/env python3
"""Contrôle quotidien de la production (06/11/2026, après l'incident des données : régions jamais publiées, photos
Wikimedia disparues, sites jamais lus, sans que rien ne s'en alarme). Vérifie ce que le site sert vraiment, zone par
zone, ce que valent les services extérieurs (sur le fond, pas seulement « répond »), et l'état des derniers calculs.
Écrit un rapport Markdown ; code de sortie 1 s'il y a un problème (le calcul ouvre alors un signalement GitHub).

Usage : python health_check.py [--report rapport.md]
"""
import argparse, datetime, json, os, sys, urllib.parse, urllib.request
from pathlib import Path

SITE = os.environ.get("SITE", "https://untrackedmaps.app")
REPO = os.environ.get("GITHUB_REPOSITORY", "hfreryr/untracked")
UA = "UntrackedMapsBot/0.1 (+https://untrackedmaps.app/confidentialite ; contrôle quotidien)"
ZONES = json.loads((Path(__file__).parent.parent / "src/lib/cities/zones.json").read_text())
MAX_AGE = {"idf": 2, "zone": 8}          # jours : chaque nuit en Île-de-France, chaque semaine ailleurs
FLOORS = {"wiki_photos": 1, "site_photos": 1, "hours": 1}   # au moins un : zéro veut dire une étape cassée
# calculs dont le dernier passage doit avoir réussi
WORKFLOWS = {"places.yml": "Lieux par tuile (nuit)", "places-zones.yml": "Lieux des régions", "extras.yml": "Compléments des lieux",
             "facades.yml": "Devantures Panoramax"}


def get(url, as_json=True, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r) if as_json else r.read()


def exists(url):
    try:
        get(url, as_json=False)
        return True
    except Exception:
        return False


def age_days(built, today):
    return (today - datetime.datetime.fromisoformat(built.replace("Z", "+00:00")).date()).days


def check_index(name, idx, today, kind):
    """Problèmes d'un index de lieux (pur) : âge, vide, champs à zéro."""
    out = []
    if not idx:
        return [f"{name} : aucune donnée en ligne"]
    if not idx.get("count"):
        out.append(f"{name} : index vide")
    a = age_days(idx.get("built", "2000-01-01T00:00:00Z"), today)
    if a > MAX_AGE[kind]:
        out.append(f"{name} : données de {a} jours (au plus {MAX_AGE[kind]})")
    for k, floor in FLOORS.items():
        v = (idx.get("metrics") or {}).get(k)
        if v is not None and v < floor:
            out.append(f"{name} : {k} = {v}")
    return out


def check_extras(extras):
    """Compléments d'Île-de-France (pur)."""
    p = (extras or {}).get("places") or {}
    out = []
    for k, label in (("_wph", "photos Wikimedia"), ("_wt", "articles Wikipédia"), ("_photo", "photos des sites")):
        n = sum(1 for v in p.values() if k in v)
        if n < 100:
            out.append(f"Île-de-France : {n} lieux avec {label} dans les compléments (au moins 100 attendus)")
    return out


def data_checks(today):
    probs, lines = [], []
    try:
        idx = get(f"{SITE}/data/places/index.json")
    except Exception as e:
        idx, _ = None, probs.append(f"Île-de-France : index illisible ({e})")
    probs += check_index("Île-de-France", idx, today, "idf")
    if idx:
        lines.append(f"| Île-de-France | {idx.get('built', '?')[:10]} | {idx.get('count', '?')} | {json.dumps(idx.get('metrics', {}))} |")
    try:
        probs += check_extras(get(f"{SITE}/data/extras.json"))
    except Exception as e:
        probs.append(f"Île-de-France : compléments illisibles ({e})")
    for z in ZONES:
        base = f"{SITE}/data/zones/{z['id']}"
        try:
            zi = get(f"{base}/places/index.json")
        except Exception:
            zi = None
        probs += check_index(z["name"], zi, today, "zone")
        missing = [f for f in ("places/landmarks/index.json", "places/search/index.json", "sitehours.json", "wikiphotos.json")
                   if not exists(f"{base}/{f}")]
        if missing:
            probs.append(f"{z['name']} : fichiers absents : {', '.join(missing)}")
        if zi:
            lines.append(f"| {z['name']} | {zi.get('built', '?')[:10]} | {zi.get('count', '?')} | {json.dumps(zi.get('metrics', {}))} |")
    return probs, lines


def service_checks():
    """Les services extérieurs donnent-ils un résultat juste (pas seulement une réponse) ?"""
    probs = []
    sys.path.insert(0, str(Path(__file__).parent))
    try:
        import build_wikiphotos as w
        n = len(w.ranked(w.category_pages("Château de Chambord") or []))
        if n < 5:
            probs.append(f"Wikimedia : {n} photo reconnue pour le château de Chambord (au moins 5 attendues) — format changé ?")
    except Exception as e:
        probs.append(f"Wikimedia : échec ({e})")
    checks = [
        ("Photon (recherche)", "https://photon.komoot.io/api/?q=grand+palais&lang=fr&limit=5&lat=48.85&lon=2.34",
         lambda j: any("Palais" in (f.get("properties") or {}).get("name", "") for f in j.get("features", []))),
        ("Géoplateforme (adresses)", "https://data.geopf.fr/geocodage/search?q=57+rue+de+rennes+paris&index=address&limit=3",
         lambda j: len(j.get("features", [])) > 0),
        ("Transitous (transports)", "https://api.transitous.org/api/v5/plan?fromPlace=48.8823,2.3376&toPlace=48.8513,2.3105&numItineraries=2",
         lambda j: len(j.get("itineraries", [])) > 0),
        ("Valhalla (itinéraires)", "https://valhalla1.openstreetmap.de/route?json=" + urllib.parse.quote(
            '{"locations":[{"lat":48.8521,"lon":2.3394},{"lat":48.8462,"lon":2.3460}],"costing":"pedestrian"}'),
         lambda j: (j.get("trip") or {}).get("summary", {}).get("length", 0) > 0),
    ]
    for name, url, ok in checks:
        try:
            if not ok(get(url)):
                probs.append(f"{name} : réponse sans le résultat attendu")
        except Exception as e:
            probs.append(f"{name} : pas de réponse ({e})")
    return probs


def run_checks():
    """Dernier passage de chaque calcul sur main (API GitHub ; pas ceux d'une branche de travail, 06/11/2026)."""
    probs = []
    tok = os.environ.get("GITHUB_TOKEN")
    h = {"Authorization": f"Bearer {tok}"} if tok else {}
    for wf, name in WORKFLOWS.items():
        try:
            runs = get(f"https://api.github.com/repos/{REPO}/actions/workflows/{wf}/runs?per_page=1&status=completed&branch=main", headers=h)
            r = (runs.get("workflow_runs") or [None])[0]
            if r and r.get("conclusion") not in ("success", "skipped"):
                probs.append(f"Calcul « {name} » : dernier passage en échec ({r.get('conclusion')}) — {r.get('html_url')}")
        except Exception as e:
            probs.append(f"Calcul « {name} » : état illisible ({e})")
    try:
        r = get(f"https://api.github.com/repos/{REPO}/actions/runs?branch=gh-pages&per_page=1&status=completed", headers=h)["workflow_runs"][0]
        if r.get("conclusion") != "success":
            probs.append(f"Mise en ligne du site : dernier passage en échec ({r.get('conclusion')}) — {r.get('html_url')}")
    except Exception as e:
        probs.append(f"Mise en ligne du site : état illisible ({e})")
    return probs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", default="rapport.md")
    a = ap.parse_args()
    today = datetime.datetime.now(datetime.timezone.utc).date()
    dp, lines = data_checks(today)
    sp, rp = service_checks(), run_checks()
    probs = dp + sp + rp
    md = [f"# Contrôle des données du {today:%d/%m/%Y}", "",
          f"**{len(probs)} problème(s)**" if probs else "**Aucun problème.**", ""]
    md += [f"- {p}" for p in probs]
    md += ["", "## Zones", "", "| Zone | Calcul | Lieux | Mesures |", "|---|---|---|---|", *lines]
    Path(a.report).write_text("\n".join(md) + "\n")
    print("\n".join(md))
    return 1 if probs else 0


if __name__ == "__main__":
    sys.exit(main())
