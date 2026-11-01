#!/usr/bin/env python3
"""
Photos Wikimedia Commons des lieux, préparées à l'avance (porteur, 01/11/2026 : « les photos mettent 1 à 3 s à
apparaître »). Avant, l'app interrogeait Wikidata, Wikipédia puis Commons, l'un après l'autre, à l'ouverture de chaque
fiche (contraire à la règle « données préparées à l'avance », et Wikimedia voyait chaque fiche ouverte). Maintenant,
chaque semaine, pour les lieux qui ont un identifiant Wikidata ou un article Wikipédia :
  1. Wikidata (par lots de 50) : l'image du lieu (P18), sa catégorie Commons (P373), le titre de l'article français ;
     un lieu qui n'a qu'un article Wikipédia : son identifiant Wikidata par Wikipédia (par lots de 50) ;
  2. Commons : l'adresse de chaque image à 960 px (taille standard de Wikimedia), son auteur et sa licence ;
  3. jusqu'à 5 autres images de la catégorie du lieu (une demande par catégorie, 3 000 au plus par semaine).
Politesse (https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits) : identifiant explicite, une demande à la fois,
pause entre deux demandes, attente quand Wikimedia demande de ralentir ; résultat gardé 90 jours (wikiphotos.json).

Sortie : extras.json complété en place : "_wph": [[chemin de l'image, crédit], …] (chemin après
https://upload.wikimedia.org/wikipedia/commons/thumb/), "_wt": titre de l'article français ; l'app n'interroge plus que
le résumé Wikipédia (texte), sans attendre, et les images.
Usage :  python app/scripts/build_wikiphotos.py idf.osm.pbf --extras out/extras.json --state out/wikiphotos.json
Licences : images sous licences libres de Commons (auteur et licence affichés en plein écran) ; Wikidata CC0.
"""
import argparse, datetime, html, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

UA = "UntrackedMapsBot/0.1 (+https://untrackedmaps.app/confidentialite ; photos des lieux, une fois par semaine)"
THUMB = "https://upload.wikimedia.org/wikipedia/commons/thumb/"
WIDTH = 960          # tailles acceptées par Wikimedia : 250, 330, 500, 960, 1280… (une autre est refusée)
MAX_PHOTOS = 6
KEEP_DAYS = 90
PAUSE = 0.5


def get_json(url, tries=5, pause=PAUSE, opener=urllib.request.urlopen):
    """Une demande à Wikimedia ; attend et réessaie si on lui demande de ralentir (429, 503)."""
    for k in range(tries):
        time.sleep(pause)
        try:
            with opener(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or k == tries - 1:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 10 * (k + 1))
    return None


def chunks(xs, n=50):
    xs = list(xs)
    return [xs[i:i + n] for i in range(0, len(xs), n)]


def strip_tags(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()


def photo_of(page):
    """Page de fichier Commons (réponse imageinfo) → [chemin, crédit], ou None (pas une photo)."""
    ii = (page or {}).get("imageinfo", [{}])[0]
    url = ii.get("thumburl") or ""
    if not url.startswith(THUMB) or not re.search(r"\.(jpe?g|png|webp)$", page.get("title", ""), re.I):
        return None
    meta = ii.get("extmetadata") or {}
    artist = strip_tags(meta.get("Artist", {}).get("value"))[:60]
    licence = strip_tags(meta.get("LicenseShortName", {}).get("value"))
    return [url[len(THUMB):], " · ".join(x for x in (artist, licence) if x)]


def commons_query(extra):
    return ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata"
            f"&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth={WIDTH}&{extra}")


def entities(qids, get=get_json):
    """Wikidata : {Q: {"file", "category", "title"}}."""
    out = {}
    for batch in chunks(qids):
        j = get("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|sitelinks"
                f"&sitefilter=frwiki&ids={'|'.join(batch)}") or {}
        for q, e in (j.get("entities") or {}).items():
            c = e.get("claims") or {}
            val = lambda p: (((c.get(p) or [{}])[0].get("mainsnak") or {}).get("datavalue") or {}).get("value")
            out[q] = {"file": val("P18"), "category": val("P373"),
                      "title": ((e.get("sitelinks") or {}).get("frwiki") or {}).get("title")}
    return out


def qids_of_titles(titles, get=get_json):
    """Wikipédia en français : {titre: Q} (lieux qui n'ont qu'un article, sans identifiant Wikidata dans OSM)."""
    out = {}
    for batch in chunks(titles):
        j = get("https://fr.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&ppprop=wikibase_item"
                f"&redirects=1&titles={urllib.parse.quote('|'.join(batch))}") or {}
        q = j.get("query") or {}
        back = {}
        for r in (q.get("normalized") or []) + (q.get("redirects") or []):
            back[r["to"]] = back.get(r["from"], r["from"])
        for p in (q.get("pages") or {}).values():
            item = (p.get("pageprops") or {}).get("wikibase_item")
            if item:
                out[back.get(p["title"], p["title"])] = item
    return out


def files_info(files, get=get_json):
    """Commons : {nom de fichier: [chemin, crédit]} pour l'image principale de chaque lieu."""
    out = {}
    for batch in chunks(files):
        j = get(commons_query("titles=" + urllib.parse.quote("|".join("File:" + f for f in batch)))) or {}
        q = j.get("query") or {}
        norm = {n["to"]: n["from"] for n in q.get("normalized") or []}
        for p in (q.get("pages") or {}).values():
            ph = photo_of(p)
            if ph:
                out[norm.get(p["title"], p["title"])[5:]] = ph
    return out


def category_photos(category, get=get_json, n=MAX_PHOTOS - 1):
    j = get(commons_query("generator=categorymembers&gcmtype=file&gcmlimit=20&gcmtitle="
                          + urllib.parse.quote("Category:" + category))) or {}
    pages = sorted(((j.get("query") or {}).get("pages") or {}).values(), key=lambda p: p.get("index", 0))
    return [ph for ph in map(photo_of, pages) if ph][:n]


def prepare(wanted, state, today, get=get_json, max_new=0, max_categories=3000):
    """wanted : {clé: (Q ou None, titre Wikipédia ou None)} → state[Q] = {"d", "t", "p", "k" (catégorie), "c" (lue)}.
    Les catégories (une demande chacune) sont lues au plus `max_categories` par passage : les autres la semaine suivante."""
    old = (datetime.date.fromisoformat(today) - datetime.timedelta(days=KEEP_DAYS)).isoformat()
    missing_q = {t for q, t in wanted.values() if not q and t}
    found = qids_of_titles(sorted(missing_q), get) if missing_q else {}
    qids = {q or found.get(t) for q, t in wanted.values()} - {None}
    todo = sorted(q for q in qids if (state.get(q) or {}).get("d", "") < old)
    if max_new:
        todo = todo[:max_new]
    ents = entities(todo, get)
    main = files_info(sorted({e["file"] for e in ents.values() if e["file"]}), get)
    for q in todo:
        e = ents.get(q) or {}
        state[q] = {"d": today, "t": e.get("title"), "p": [main[e["file"]]] if e.get("file") in main else [],
                    "k": e.get("category"), "c": False}
    cats = [q for q in sorted(qids) if (state.get(q) or {}).get("k") and not state[q].get("c")][:max_categories]
    for q in cats:
        s = state[q]
        try:
            for ph in category_photos(s["k"], get):
                if len(s["p"]) < MAX_PHOTOS and ph[0] not in {p[0] for p in s["p"]}:
                    s["p"].append(ph)
            s["c"] = True
        except Exception as err:   # une catégorie illisible n'arrête pas les autres ; réessayée la semaine suivante
            print("catégorie ignorée :", s["k"], err, file=sys.stderr)
    return found, len(todo), len(cats)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pbf")
    ap.add_argument("--extras", required=True, help="extras.json, complété en place")
    ap.add_argument("--state", default="wikiphotos.json", help="résultats des semaines précédentes, mis à jour en place")
    ap.add_argument("--max-new", type=int, default=20000, help="au plus N lieux interrogés par passage")
    a = ap.parse_args()
    t0 = time.time()
    today = time.strftime("%Y-%m-%d")
    from build_places import Places
    data = json.loads(Path(a.extras).read_text())
    extras = data.setdefault("places", {})
    try:
        state = json.loads(Path(a.state).read_text()).get("q", {})
    except Exception:
        state = {}
    h = Places(14)
    h.apply_file(a.pbf, locations=True)
    wanted = {}
    for oid, _lon, _lat, tags in (it for tile in h.tiles.values() for it in tile):
        q = tags.get("wikidata") if re.fullmatch(r"Q\d+", tags.get("wikidata") or "") else None
        t = (re.match(r"^fr:(.+)$", tags.get("wikipedia") or "") or [None, None])[1]
        if q or t:
            wanted[str(oid)] = (q, t)
    found, asked, cats = prepare(wanted, state, today, max_new=a.max_new)
    n = 0
    for oid, (q, t) in wanted.items():
        s = state.get(q or found.get(t))
        if s and (s["p"] or s["t"]):
            ex = extras.setdefault(oid, {})
            if s["p"]:
                ex["_wph"] = [s["p"], "wikimedia"]
            if s["t"]:
                ex["_wt"] = [s["t"], "wikipedia"]
            n += bool(s["p"])
    Path(a.extras).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    Path(a.state).write_text(json.dumps({"v": 1, "updated": today, "q": state}, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(wanted)} lieux liés à Wikidata ou Wikipédia, {asked} interrogés cette fois, {cats} catégories lues, {n} avec photos ;"
          f" en {time.time() - t0:.0f} s", flush=True)


if __name__ == "__main__":
    main()
