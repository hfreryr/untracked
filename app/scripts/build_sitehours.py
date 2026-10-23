#!/usr/bin/env python3
"""
Horaires lus sur le site web des lieux qui n'en ont pas dans OSM (restaurants, cafés, bars, boulangeries…).

Ordre (frugal et applicable partout, décision du porteur du projet du 15/10/2026) :
  1. Common Crawl : la page du lieu est souvent déjà archivée (copies mensuelles en accès libre) ; on la lit
     dans l'archive, sans visiter le site. Mesure sur Paris : 47 % des sites présents.
  2. Sinon, une visite du site, rarement : un site déjà lu n'est pas relu avant 28 jours (90 jours s'il n'a jamais
     publié d'horaires), et on demande au site si la page a changé avant de la retélécharger.
  L'état de chaque site (date de lecture, horaires trouvés) est gardé d'une semaine à l'autre (sitehours.json).

On ne lit que les données structurées que le site publie lui-même pour les moteurs de recherche (schema.org :
`openingHours` ou `openingHoursSpecification`), pas le texte de la page : c'est précis, et sans interprétation.
Mesure du 15/10/2026 (docs/sources-donnees.md) : ≈ 21 % des sites joignables en publient.

Politesse : une seule page par site (la page indiquée), robots.txt respecté, identifiant explicite, délai court.
Prudence : le nom publié par le site doit ressembler au nom du lieu (sinon ce sont peut-être les horaires du
siège d'une chaîne ou d'un autre établissement) ; les horaires doivent être au format OSM valide.

Entrée : l'extrait OSM et extras.json (build_extras.py, pour les sites trouvés ailleurs qu'OSM).
Sortie : extras.json complété en place : "opening_hours": [horaires, "site"] (relu chaque semaine).
Usage :  python app/scripts/build_sitehours.py paris.osm.pbf --extras out/extras.json [--limit 200]
"""
import argparse, concurrent.futures as cf, datetime, gzip, json, re, ssl, sys, time, urllib.request, urllib.robotparser
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent))
from build_places import Places
from build_extras import NOT_A_SITE, tokens, valid_hours, GENERIC

UA = "UntrackedMapsBot/0.1 (+https://untrackedmaps.app/confidentialite ; lecture hebdomadaire des horaires publiés)"
FOOD = ("restaurant", "cafe", "bar", "pub", "fast_food", "ice_cream", "biergarten")
SHOPS = ("bakery", "pastry", "confectionery", "chocolate", "deli", "butcher", "cheese", "wine", "florist", "books", "hairdresser", "beauty")
LDJSON = re.compile(r"<script[^>]+application/ld\+json[^>]*>(.*?)</script>", re.S | re.I)
DAYS_EN = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
OSM_DAYS = ("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su")
HM = re.compile(r"^(\d{1,2}):(\d{2})")


def wanted(tags):
    """Lieux dont on cherche les horaires sur leur site : restauration et commerces de bouche ou de quartier."""
    return "opening_hours" not in tags and (tags.get("amenity") in FOOD or tags.get("shop") in SHOPS)


def week_to_osm(week):
    """[[« 09:00-18:00 », …] × 7 jours] → « Mo-Fr 09:00-18:00; Sa 10:00-17:00 » (jours sans plage : fermés)."""
    groups = []
    for d, spans in enumerate(week):
        v = ",".join(spans)
        if groups and groups[-1][2] == v and groups[-1][1] == d - 1:
            groups[-1][1] = d
        else:
            groups.append([d, d, v])
    out = []
    for a, b, v in groups:
        if not v:
            continue
        days = OSM_DAYS[a] if a == b else (f"{OSM_DAYS[a]},{OSM_DAYS[b]}" if b == a + 1 else f"{OSM_DAYS[a]}-{OSM_DAYS[b]}")
        out.append(f"{days} {v}")
    return "; ".join(out) or None


def hm(t):
    m = HM.match(str(t or "").strip())
    return f"{int(m[1]):02d}:{m[2]}" if m else None


def from_spec(specs):
    """openingHoursSpecification → horaires OSM (None si incomplet ou daté : horaires exceptionnels)."""
    week = [[] for _ in range(7)]
    for s in specs if isinstance(specs, list) else [specs]:
        if not isinstance(s, dict) or s.get("validFrom") or s.get("validThrough"):
            continue  # horaires exceptionnels (jour férié, vacances) : pas la semaine habituelle
        days = s.get("dayOfWeek")
        days = days if isinstance(days, list) else [days]
        o, c = hm(s.get("opens")), hm(s.get("closes"))
        if not (o and c) or o == c:
            continue
        for d in days:
            k = DAYS_EN.get(str(d or "").rstrip("/").split("/")[-1].lower())
            if k is None:
                return None
            span = f"{o}-{'24:00' if c == '00:00' else c}"
            if span not in week[k]:
                week[k].append(span)
    for spans in week:
        spans.sort()
    return week_to_osm(week) if any(week) else None


def from_text(oh):
    """openingHours schema.org (« Mo-Fr 09:00-18:00 », chaîne ou liste) → horaires OSM."""
    parts = oh if isinstance(oh, list) else [oh]
    rules = [re.sub(r"\s+", " ", str(p)).strip() for p in parts if p]
    return "; ".join(rules) or None


def businesses(node):
    """Objets schema.org d'une page (y compris dans @graph et les listes)."""
    if isinstance(node, list):
        for n in node:
            yield from businesses(n)
    elif isinstance(node, dict):
        if "@graph" in node:
            yield from businesses(node["@graph"])
        if "openingHours" in node or "openingHoursSpecification" in node:
            yield node


def similar(osm_name, site_name):
    """Le nom publié par le site partage un mot distinctif avec le nom du lieu (évite les horaires d'un autre)."""
    a, b = tokens(osm_name) - GENERIC, tokens(site_name or "") - GENERIC
    return bool(a & b)


def hours_in(html, name):
    """Horaires du lieu trouvés dans les données structurées d'une page, ou None."""
    for block in LDJSON.findall(html):
        try:
            data = json.loads(block.strip())
        except ValueError:
            continue
        for b in businesses(data):
            if not similar(name, b.get("name")):
                continue
            oh = from_spec(b["openingHoursSpecification"]) if b.get("openingHoursSpecification") else from_text(b.get("openingHours"))
            if oh and valid_hours(oh):
                return oh
    return None


_robots = {}


def allowed(url):
    host = urlparse(url)
    root = f"{host.scheme}://{host.netloc}"
    if root not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(root + "/robots.txt", headers={"User-Agent": UA})
            rp.parse(urllib.request.urlopen(req, timeout=8).read().decode("utf-8", "ignore").splitlines())
        except Exception:
            rp.parse([])  # pas de robots.txt lisible : rien d'interdit
        _robots[root] = rp
    return _robots[root].can_fetch(UA, url)


def fetch(url, etag=None, lastmod=None):
    """Page du site → (html, etag, last-modified) ; html = "" si la page n'a pas changé (réponse 304) ; None si refusé."""
    if not url.startswith("http"):
        url = "http://" + url
    if NOT_A_SITE.search(url) or not allowed(url):
        return None, None, None
    headers = {"User-Agent": UA, "Accept-Language": "fr"}
    if etag:
        headers["If-None-Match"] = etag
    if lastmod:
        headers["If-Modified-Since"] = lastmod
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=12, context=ssl.create_default_context()) as r:
            if "html" not in (r.headers.get("Content-Type") or ""):
                return None, None, None
            return r.read(1_500_000).decode("utf-8", "ignore"), r.headers.get("ETag"), r.headers.get("Last-Modified")
    except urllib.error.HTTPError as e:
        if e.code == 304:
            return "", etag, lastmod
        raise


# ——— Rythme des lectures ———
RECHECK_WITH_HOURS = 28    # jours avant de relire un site qui publie ses horaires
RECHECK_WITHOUT = 90       # jours avant de relire un site qui n'en a jamais publié


def due(entry, today):
    """Faut-il relire ce site aujourd'hui ? (entry : état de la dernière lecture, ou None)"""
    if not entry or not entry.get("checked"):
        return True
    age = (datetime.date.fromisoformat(today) - datetime.date.fromisoformat(entry["checked"])).days
    # site injoignable ou refusé : on réessaie au bout de 28 jours (panne passagère possible)
    return age >= (RECHECK_WITH_HOURS if entry.get("hours") or entry.get("via") == "échec" else RECHECK_WITHOUT)


# ——— Common Crawl : pages déjà archivées, lues sans visiter les sites ———
CC_INDEX = "https://index.commoncrawl.org/collinfo.json"
CC_DATA = "https://data.commoncrawl.org/"


def host_of(url):
    return urlparse(url if "://" in url else "http://" + url).netloc.lower().split(":")[0]


def norm_path(path):
    """« /fr/ » et « /fr » → « /fr » ; « » → « / »."""
    p = (path or "/").rstrip("/")
    return p or "/"


def reg_candidates(host):
    """Domaines enregistrés possibles d'un hôte (« www.resto.fr » → resto.fr ; « a.b.co.uk » → b.co.uk, co.uk…)."""
    parts = host.split(".")
    return {".".join(parts[-k:]) for k in (2, 3) if len(parts) >= k}


def cc_get(url, headers=None, timeout=120):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})}), timeout=timeout)


def cc_recent(n):
    """Les n dernières copies (« CC-MAIN-2026-39 »…). La liste officielle (index.commoncrawl.org) est parfois
    injoignable : on essaie alors les semaines récentes une à une sur data.commoncrawl.org."""
    for _ in range(3):
        try:
            return [x["id"] for x in json.load(cc_get(CC_INDEX, timeout=30))][:n]
        except Exception:
            time.sleep(5)
    found, day = [], datetime.date.today()
    for _ in range(26 * 7 // 7):
        y, w, _ = day.isocalendar()
        crawl = f"CC-MAIN-{y}-{w:02d}"
        try:
            cc_get(f"{CC_DATA}crawl-data/{crawl}/cc-index-table.paths.gz", timeout=30).close()
            found.append(crawl)
            if len(found) == n:
                break
        except Exception:
            pass
        day -= datetime.timedelta(days=7)
    return found


def surt(url):
    """Clé d'archive de Common Crawl : « https://www.Resto.fr/Menu/ » → « fr,resto)/menu »."""
    u = urlparse(url if "://" in url else "http://" + url)
    host = u.netloc.lower().split(":")[0]
    host = host[4:] if host.startswith("www.") else host
    path = (u.path or "/").lower().rstrip("/") or "/"
    return ",".join(reversed(host.split("."))) + ")" + path


def cc_pages(sites, crawls=2):
    """Pour chaque site (URL), sa page archivée par Common Crawl dans l'une des `crawls` dernières copies :
    {url: (date de copie, html)}. Seulement la page exacte du site (pour une chaîne, la page d'accueil donnerait
    les horaires du siège). Lecture de l'archive seulement : aucun site n'est visité.
    Coût par copie (Paris, ≈ 3 600 sites) : index des domaines ≈ 4 Mo, index compact ≈ 105 Mo, ≈ 1 500 blocs de
    ≈ 270 Ko pour les domaines présents, puis les pages elles-mêmes."""
    import bisect, duckdb
    c = duckdb.connect()
    c.sql("INSTALL httpfs; LOAD httpfs;")
    keys = {u: surt(u) for u in sites}
    out = {}
    for crawl in cc_recent(crawls):
        todo = [u for u in sites if u not in out]
        if not todo:
            break
        # 1) domaines présents dans cette copie (colonne minuscule de l'index en colonnes)
        paths = gzip.decompress(cc_get(f"{CC_DATA}crawl-data/{crawl}/cc-index-table.paths.gz").read()).decode().split()
        files = ",".join(f"'{CC_DATA}{p}'" for p in paths if "subset=warc" in p)
        regs = {r for u in todo for r in reg_candidates(host_of(u)[4:] if host_of(u).startswith("www.") else host_of(u))}
        c.execute("CREATE OR REPLACE TABLE regs(d VARCHAR)")
        c.executemany("INSERT INTO regs VALUES (?)", [[r] for r in regs])
        present = {r for (r,) in c.sql(f"SELECT DISTINCT url_host_registered_domain FROM read_parquet([{files}]) "
                                         "WHERE url_host_registered_domain IN (SELECT d FROM regs)").fetchall()}
        todo = [u for u in todo if reg_candidates(host_of(u)[4:] if host_of(u).startswith("www.") else host_of(u)) & present]
        if not todo:
            continue
        # 2) index compact : on repère le bloc de chaque page, on ne lit que ces blocs
        base = f"{CC_DATA}cc-index/collections/{crawl}/indexes/"
        idx = [l.split("\t") for l in cc_get(base + "cluster.idx", timeout=600).read().decode().splitlines()]
        firsts = [row[0].split(" ")[0] for row in idx]
        blocks = defaultdict(list)
        for u in todo:
            i = max(0, bisect.bisect_right(firsts, keys[u]) - 1)
            blocks[i].append(u)
        recs = {}
        for i, us in blocks.items():
            _, fname, off, ln = idx[i][0], idx[i][1], int(idx[i][2]), int(idx[i][3])
            try:
                lines = gzip.decompress(cc_get(base + fname, {"Range": f"bytes={off}-{off + ln - 1}"}).read()).decode("utf-8", "ignore").splitlines()
            except Exception:
                continue
            want = {keys[u]: u for u in us}
            for line in lines:
                k, ts, js = line.split(" ", 2)
                if k in want:
                    r = json.loads(js)
                    if r.get("status") == "200" and "html" in (r.get("mime-detected") or r.get("mime") or "") and ts > recs.get(want[k], ("",))[0]:
                        recs[want[k]] = (ts, r["filename"], int(r["offset"]), int(r["length"]))
        # 3) les pages elles-mêmes, dans l'archive
        for u, (ts, wf, o, ln) in recs.items():
            try:
                raw = cc_get(CC_DATA + wf, {"Range": f"bytes={o}-{o + ln - 1}"}, 60).read()
                out[u] = (f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}", gzip.decompress(raw).decode("utf-8", "ignore"))
            except Exception:
                continue
    return out


def pick_fresh(fresh, state, n):
    """Au plus n sites : ceux déjà connus (relecture) d'abord, puis les nouveaux du centre de Paris vers l'extérieur."""
    return sorted(fresh, key=lambda j: (j[2] not in state, (j[3] - 2.3488) ** 2 * 0.43 + (j[4] - 48.8534) ** 2))[:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pbf")
    ap.add_argument("--extras", required=True, help="extras.json, complété en place")
    ap.add_argument("--state", default="sitehours.json", help="état des lectures précédentes, mis à jour en place")
    ap.add_argument("--limit", type=int, default=0, help="nombre de sites à traiter (essai)")
    ap.add_argument("--no-cc", action="store_true", help="sans Common Crawl (essai)")
    ap.add_argument("--max-new", type=int, default=0,
                    help="au plus N sites à lire par passage, les plus proches de Paris d'abord (Île-de-France, 23/10/2026 :"
                         " la première lecture de la région s'étale sur plusieurs semaines au lieu d'allonger une seule tâche)")
    args = ap.parse_args()
    t0 = time.time()
    today = time.strftime("%Y-%m-%d")
    data = json.loads(Path(args.extras).read_text())
    extras = data.setdefault("places", {})
    try:
        state = json.loads(Path(args.state).read_text()).get("sites", {})
    except Exception:
        state = {}

    h = Places(14)
    h.apply_file(args.pbf, locations=True)
    todo = []
    for oid, lon, lat, tags in (it for tile in h.tiles.values() for it in tile):
        ex = extras.get(str(oid), {})
        if not wanted(tags) or "opening_hours" in ex:
            continue
        site = tags.get("website") or tags.get("contact:website") or (ex.get("website") or [None])[0]
        if site and tags.get("name") and not NOT_A_SITE.search(site):
            todo.append((str(oid), tags["name"], site, lon, lat))
    if args.limit:
        todo = todo[: args.limit]
    stats = Counter()
    fresh = [j for j in todo if due(state.get(j[2]), today)]
    stats["déjà lus récemment"] = len(todo) - len(fresh)
    if args.max_new and len(fresh) > args.max_new:
        stats["remis à une prochaine semaine"] = len(fresh) - args.max_new
        fresh = pick_fresh(fresh, state, args.max_new)
    print(f"{len(todo)} sites, dont {len(fresh)} à lire", file=sys.stderr)

    # 1. Common Crawl
    archived = {}
    if fresh and not args.no_cc:
        try:
            archived = cc_pages(sorted({j[2] for j in fresh}))
        except Exception as e:
            print("Common Crawl ignoré :", e, file=sys.stderr)
    live = []
    for oid, name, site, *_ in fresh:
        if site in archived:
            date, html = archived[site]
            oh = hours_in(html, name)
            state[site] = {**state.get(site, {}), "checked": today, "hours": oh, "via": "commoncrawl", "page": date}
            stats["archive Common Crawl"] += 1
        else:
            live.append((oid, name, site))

    # 2. visite du site, pour ceux que Common Crawl n'a pas
    def one(job):
        oid, name, site = job
        prev = state.get(site, {})
        try:
            html, etag, lastmod = fetch(site, prev.get("etag"), prev.get("lastmod"))
        except Exception:
            return site, "injoignable", {**prev, "checked": today, "via": "échec", "hours": prev.get("hours")}
        if html is None:
            return site, "refusé ou pas une page", {**prev, "checked": today, "via": "échec", "hours": prev.get("hours")}
        if html == "":
            return site, "page inchangée", {**prev, "checked": today}
        return site, "visite", {"checked": today, "hours": hours_in(html, name), "via": "site", "etag": etag, "lastmod": lastmod}

    with cf.ThreadPoolExecutor(16) as ex:
        for site, status, entry in ex.map(one, live):
            stats[status] += 1
            if entry:
                state[site] = entry

    # 3. horaires connus (de cette semaine ou des précédentes) → compléments
    for oid, name, site, *_ in todo:
        oh = (state.get(site) or {}).get("hours")
        if oh and valid_hours(oh):
            extras.setdefault(oid, {})["opening_hours"] = [oh, "site"]
            stats["lieux avec horaires"] += 1
    Path(args.extras).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    Path(args.state).write_text(json.dumps({"v": 1, "updated": today, "sites": state}, ensure_ascii=False, separators=(",", ":")))
    print("sites : " + ", ".join(f"{k} {v}" for k, v in stats.most_common()) + f", en {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
