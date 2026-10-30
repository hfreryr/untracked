#!/usr/bin/env python3
"""
Compléments aux lieux OSM, tirés de sources ouvertes, pour les fiches qui n'ont pas l'information dans OSM.

Décision du porteur du projet (15/10/2026) : le prototype doit être aussi complet que possible sans contribution
des utilisateurs. Mesures et licences : docs/sources-donnees.md.

Règles :
  - un complément ne remplace jamais une valeur d'OSM, il ne fait que combler un manque ;
  - chaque complément garde sa source, affichée dans la fiche (étiquette `_src` de la tuile) ;
  - rien de ce fichier n'est envoyé dans OSM.

Sources branchées :
  - overture : site web et téléphone (Overture Maps Foundation, CDLA-Permissive 2.0), lus par HTTPS sans identifiants ;
  - atp : horaires, site et téléphone publiés par les enseignes sur leurs propres sites (All The Places, CC0) ;
  - annuaire : horaires des services publics (annuaire de l'administration, service-public.fr, Licence Ouverte 2.0) ;
  - paris : horaires des parcs, squares, piscines, bibliothèques, musées et mairies (Ville de Paris, ODbL), seulement
    pour la période en vigueur (horaires d'été, d'hiver…).

Sortie : extras.json = {"places": {"<id codé comme dans les tuiles>": {"website": [valeur, source],
                                     "opening_hours": [valeur, source, fin de validité AAAA-MM-JJ], …}, …}}
Usage :  python app/scripts/build_extras.py paris.osm.pbf --out extras.json [--overture-release 2026-09-23.1]
"""
import argparse, csv, gzip, io, json, math, re, sys, time, unicodedata, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_places import Places  # mêmes lieux et mêmes identifiants que les tuiles

OVERTURE = "https://overturemaps-us-west-2.s3.amazonaws.com"
UA = "UntrackedMapsBot/0.1 (+https://untrackedmaps.app/confidentialite)"
# Plateformes et sites génériques : pas le site du lieu (et rien de Google)
NOT_A_SITE = re.compile(r"google\.|goo\.gl|tripadvisor|thefork|lafourchette|ubereats|deliveroo|just-?eat|pagesjaunes|yelp\.|"
                        r"privateaser|4sq\.com|foursquare|eater\.space|menuonline|wiicmenu|cityvox|yespark|zenpark|"
                        r"ratp\.fr|paris\.fr|booking\.com|airbnb|groupon", re.I)
# Mots trop courants pour identifier un lieu à eux seuls (« Centre culturel », « Grands Boulevards »)
GENERIC = {"centre", "culturel", "grand", "grands", "boulevard", "boulevards", "eglise", "saint", "sainte", "place", "rue", "avenue",
           "gare", "metro", "station", "parking", "hotel", "jardin", "square", "pharmacie", "boulangerie", "tabac", "pressing",
           "laverie", "coiffure", "coiffeur", "epicerie", "superette", "cave", "librairie", "maison", "atelier", "galerie", "france"}
# Lieux qu'on complète : commerces, services, restauration, hôtels, musées (pas les gares, églises, parkings, monuments)
SKIP_AMENITY = {"place_of_worship", "parking", "parking_entrance", "bicycle_parking", "bicycle_rental", "atm", "toilets",
                "drinking_water", "charging_station", "fountain", "bench", "waste_basket", "recycling", "post_box", "taxi", "grave_yard"}
STOP = {"le", "la", "les", "de", "du", "des", "paris", "the", "et", "l", "d", "chez", "au", "aux", "a", "en", "sur", "restaurant", "cafe", "bar"}


def norm(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def tokens(s):
    return {t for t in norm(s).split() if t not in STOP and len(t) > 1}


def same_name(a, b):
    """Même lieu par le nom : identiques une fois normalisés, ou au moins 2 mots en commun couvrant 60 % du plus court,
    dont un mot distinctif (pas « centre », « saint », « hôtel »…)."""
    if norm(a) and norm(a) == norm(b):
        return True
    ta, tb = tokens(a), tokens(b)
    common = ta & tb
    return len(common) >= 2 and len(common) >= 0.6 * min(len(ta), len(tb)) and bool(common - GENERIC)


def completable(tags):
    """Lieux qu'on complète : commerces et services, pas les gares, lieux de culte, parkings ni monuments."""
    if any(k in tags for k in ("railway", "public_transport", "place", "historic", "man_made")):
        return False
    if tags.get("amenity") in SKIP_AMENITY:
        return False
    return any(k in tags for k in ("shop", "amenity", "craft", "office", "healthcare")) or tags.get("tourism") in (
        "hotel", "hostel", "guest_house", "apartment", "museum", "gallery")


def site_of(name, url):
    """Le site porte le nom du lieu (« Loca Images » → loca-images.com) : écarte les sites d'un voisin ou d'un annuaire."""
    host = re.sub(r"^https?://(www\.)?", "", url.lower()).split("/")[0]
    flat = re.sub(r"[^a-z0-9]", "", host)
    words = [t for t in tokens(name) if len(t) >= 3]
    joined = re.sub(r"[^a-z0-9]", "", norm(name))
    return bool(words) and (any(w in flat for w in words) or (len(joined) >= 5 and joined in flat))


def meters(lat1, lon1, lat2, lon2):
    return math.hypot((lat1 - lat2) * 111320, (lon1 - lon2) * 111320 * math.cos(math.radians(lat1)))


def phone_fr(p):
    """Numéro au format affiché en France (+33 1 23 45 67 89), ou None s'il n'est pas reconnu."""
    d = re.sub(r"[^\d+]", "", p or "")
    if d.startswith("0033"):
        d = "+33" + d[4:]
    if d.startswith("0") and len(d) == 10:
        d = "+33" + d[1:]
    if not re.fullmatch(r"\+33[1-9]\d{8}", d):
        return None
    return f"+33 {d[3]} {d[4:6]} {d[6:8]} {d[8:10]} {d[10:12]}"


def latest_release():
    xml = urllib.request.urlopen(f"{OVERTURE}/?list-type=2&prefix=release/&delimiter=/", timeout=60).read().decode()
    return sorted(re.findall(r"release/([0-9.-]+)/", xml))[-1]


def overture_places(release, bbox):
    import duckdb
    xml = urllib.request.urlopen(f"{OVERTURE}/?list-type=2&prefix=release/{release}/theme=places/type=place/", timeout=60).read().decode()
    files = re.findall(r"<Key>([^<]+\.parquet)</Key>", xml)
    if not files:
        raise SystemExit(f"Overture {release} : aucun fichier de lieux trouvé")
    urls = ",".join(f"'{OVERTURE}/{f}'" for f in files)
    c = duckdb.connect()
    c.sql("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
    w, s, e, n = bbox
    return c.sql(f"""
        SELECT names.primary AS name, ST_Y(geometry) AS lat, ST_X(geometry) AS lon, websites, phones, confidence,
               addresses[1].freeform AS street, addresses[1].postcode AS postcode
        FROM read_parquet([{urls}])
        WHERE bbox.xmin BETWEEN {w} AND {e} AND bbox.ymin BETWEEN {s} AND {n}
          AND confidence >= 0.6 AND names.primary IS NOT NULL
          AND (websites IS NOT NULL OR phones IS NOT NULL OR addresses[1].freeform IS NOT NULL)
    """).fetchall()


def match_rows(items, rows, radius, keep):
    """Associe chaque ligne (nom, lat, lon, …) au lieu OSM le plus proche portant le même nom, à `radius` m au plus,
    parmi les lieux retenus par `keep`. Renvoie {index du lieu OSM : [(distance, ligne), …]}."""
    grid = defaultdict(list)
    for i, (oid, lon, lat, tags) in enumerate(items):
        if tags.get("name") and keep(tags):
            grid[(int(lat * 1000), int(lon * 1000))].append(i)
    reach = max(1, math.ceil(radius / 70))  # une case de la grille ≈ 74 m de large, 111 m de haut
    found = {}
    for row in rows:
        name, lat, lon = row[0], row[1], row[2]
        best = None
        gi, gj = int(lat * 1000), int(lon * 1000)
        for a in range(-reach, reach + 1):
            for b in range(-reach, reach + 1):
                for i in grid.get((gi + a, gj + b), ()):
                    oid, olon, olat, tags = items[i]
                    d = meters(lat, lon, olat, olon)
                    if d <= radius and same_name(name, tags["name"]) and (best is None or d < best[0]):
                        best = (d, i)
        if best:
            found.setdefault(best[1], []).append((best[0], row))
    return found


def match_overture(items, rows, address=None):
    """Lieux Overture (nom, lat, lon, sites, téléphones, confiance, rue, code postal) : même nom à 40 m au plus."""
    found = match_rows(items, rows, 40, completable)
    address = address or street_address
    return {i: [(d, r[3] or [], r[4] or [], address(*(r[6:8] if len(r) > 7 else (None, None)))) for d, r in c]
            for i, c in found.items()}


# Adresse d'Overture (« 172 Bd Saint-Germain ») pour les lieux qu'OSM ne situe pas (2 restaurants sur 3 à Paris).
# Mesuré le 16/10 sur 8 029 lieux qui ont déjà une adresse OSM : la même dans ≈ 87 % des cas.
ABBR = {"av": "Avenue", "bd": "Boulevard", "blvd": "Boulevard", "pl": "Place", "prom": "Promenade", "fg": "Faubourg",
        "fbg": "Faubourg", "r": "Rue", "sq": "Square", "imp": "Impasse", "pass": "Passage", "qu": "Quai", "all": "Allée", "crs": "Cours"}
ADDR = re.compile(r"^(\d+(?:\s?(?:bis|ter|[a-d]))?)[,\s]+(.{3,50})$", re.I)


def phone_nl(p):
    """Numéro néerlandais au format affiché (+31 20 123 4567, +31 6 1234 5678), ou None."""
    d = re.sub(r"[^\d+]", "", p or "")
    if d.startswith("0031"):
        d = "+31" + d[4:]
    if d.startswith("0") and len(d) == 10:
        d = "+31" + d[1:]
    if not re.fullmatch(r"\+31[1-9]\d{8}", d):
        return None
    n = d[3:]
    if n[0] == "6":
        return f"+31 6 {n[1:5]} {n[5:]}"
    if n[:2] in NL_TWO:
        return f"+31 {n[:2]} {n[2:5]} {n[5:]}"
    return f"+31 {n[:3]} {n[3:6]} {n[6:]}"


NL_TWO = {"10", "13", "15", "20", "23", "24", "26", "30", "33", "35", "36", "38", "40", "43", "45", "46", "50", "53", "55", "58",
          "70", "71", "72", "73", "74", "75", "76", "77", "78", "79"}   # indicatifs à deux chiffres (Amsterdam 20, Rotterdam 10…)
STREET_FIRST = re.compile(r"^(.{3,50}?)\s+(\d+\s?[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?)$")


def street_address_nl(freeform, postcode):
    """(numéro, rue, code postal) pour une adresse « rue numéro » (« Amstelzijde 4 », Pays-Bas), sinon None."""
    m = STREET_FIRST.match((freeform or "").strip())
    if not m or re.search(r"\d{4}", m[1]):
        return None
    pc = (postcode or "").strip().upper()
    return m[2].replace(" ", "").lower(), m[1], pc if re.fullmatch(r"\d{4}\s?[A-Z]{2}", pc) else None


def street_address(freeform, postcode):
    """(numéro, rue, code postal) si l'adresse est nette (« 172 Boulevard Saint-Germain »), sinon None."""
    m = ADDR.match((freeform or "").strip())
    if not m or re.search(r"\d{5}", m[2]):
        return None
    words = m[2].split()
    first = words[0].rstrip(".").lower()
    street = " ".join([ABBR.get(first, words[0])] + words[1:])
    pc = (postcode or "").strip()
    return m[1].lower(), street, pc if re.fullmatch(r"\d{5}", pc) else None


# ——— Ville de Paris : horaires des parcs, squares, piscines, bibliothèques, musées, mairies (ODbL) ———
PARIS_API = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/{}/exports/json"
PARIS_SETS = ("ilots-de-fraicheur-espaces-verts-frais", "ilots-de-fraicheur-equipements-activites")
PARIS_TYPES = {"Promenades ouvertes", "Bois", "Jardinets décoratifs", "Jardins grandes institutions", "Piscine", "Bibliothèque",
               "Musée", "Mairie d'arrondissement", "Bains-douches", "Baignade extérieure"}
DAYS = (("lundi", "Mo"), ("mardi", "Tu"), ("mercredi", "We"), ("jeudi", "Th"), ("vendredi", "Fr"), ("samedi", "Sa"), ("dimanche", "Su"))
SPAN = re.compile(r"(\d{1,2})\s*[h:H]\s*(\d{2})?\s*[-–]\s*(\d{1,2})\s*[h:H]\s*(\d{2})?")


def paris_keep(tags):
    """Lieux OSM que la Ville décrit : parcs et jardins, piscines, bibliothèques, musées, mairies, bains-douches."""
    return tags.get("leisure") in ("park", "garden", "sports_centre", "swimming_pool", "nature_reserve") or tags.get("amenity") in (
        "library", "townhall", "public_bath", "shower") or tags.get("tourism") == "museum"


def day_hours(text):
    """« 07h00 - 08h30 / 11h30 - 13h30 » → « 07:00-08:30,11:30-13:30 » ; « - » ou « Fermé » → « off » ; illisible → None."""
    t = (text or "").strip()
    if t in ("-", "–") or t.lower().startswith("ferm"):
        return "off"
    parts = [p.strip() for p in t.split("/")]
    spans = []
    for p in parts:
        m = SPAN.fullmatch(p)
        if not m:
            return None
        h1, m1, h2, m2 = int(m[1]), int(m[2] or 0), int(m[3]), int(m[4] or 0)
        if h1 > 24 or h2 > 24:
            return None
        spans.append(f"{h1:02d}:{m1:02d}-{h2:02d}:{m2:02d}")
    return ",".join(spans) or None


def paris_opening_hours(rec):
    """Horaires de la semaine au format OSM (« Mo-Fr 08:00-21:30; Sa,Su 09:00-21:30 »), ou None si incomplets."""
    if rec.get("ouvert_24h") == "Oui":
        return "24/7"
    week = []
    for fr, osm in DAYS:
        v = day_hours(rec.get(f"horaires_{fr}"))
        if v is None:
            return None
        week.append((osm, v))
    if all(v == "off" for _, v in week):
        return None
    groups = []  # jours consécutifs aux mêmes horaires
    for osm, v in week:
        if groups and groups[-1][2] == v:
            groups[-1][1] = osm
        else:
            groups.append([osm, osm, v])
    out = []
    for a, b, v in groups:
        if v == "off":
            continue
        days = a if a == b else (f"{a},{b}" if [d for _, d in DAYS].index(b) - [d for _, d in DAYS].index(a) == 1 else f"{a}-{b}")
        out.append(f"{days} {v}")
    return "; ".join(out)


def paris_period(text, today):
    """Période de validité « du 01/10/26 au 24/10/26 » → date de fin (AAAA-MM-JJ) si elle couvre aujourd'hui ;
    None si la période est passée ou à venir ; "" s'il n'y a pas de période."""
    m = re.search(r"du (\d\d)/(\d\d)/(\d\d) au (\d\d)/(\d\d)/(\d\d)", text or "")
    if not m:
        return ""
    start = f"20{m[3]}-{m[2]}-{m[1]}"
    end = f"20{m[6]}-{m[5]}-{m[4]}"
    return end if start <= today <= end else None


def paris_rows(records, today):
    """Lignes (nom, lat, lon, horaires, fin de validité) des lieux de la Ville aux horaires lisibles et en vigueur."""
    rows = []
    for r in records:
        if r.get("type") not in PARIS_TYPES or not r.get("geo_point_2d") or not r.get("nom"):
            continue
        until = paris_period(r.get("horaires_periode"), today)
        hours = paris_opening_hours(r)
        if until is None or not hours or not valid_hours(hours):
            continue
        g = r["geo_point_2d"]
        rows.append((r["nom"], g["lat"], g["lon"], hours, until))
    return rows


_D = r"(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)"
_DAYSPEC = rf"{_D}(?:-{_D})?(?:,{_D}(?:-{_D})?)*"
_T = r"(?:[01]\d|2[0-4]):[0-5]\d"
_RULE = re.compile(rf"(?:{_DAYSPEC}\s+)?(?:{_T}-{_T}(?:,{_T}-{_T})*|off|closed)")


def valid_hours(oh):
    """Horaires au format OSM simple que la fiche sait lire, sans plages qui se chevauchent ; sinon on écarte."""
    if oh == "24/7":
        return True
    for rule in (r.strip() for r in (oh or "").split(";")):
        if not _RULE.fullmatch(rule):
            return False
        spans = sorted(re.findall(rf"({_T})-({_T})", rule))
        if any(b[0] < a[1] for a, b in zip(spans, spans[1:])):
            return False
    return bool(oh)


# ——— All The Places : ce que les enseignes publient sur leurs sites (CC0) ———
ATP_LATEST = "https://data.alltheplaces.xyz/runs/latest.json"
# Notoriété des entités Wikidata (vues des articles Wikipédia sur un an), domaine public (CC0), mise à jour chaque semaine.
# Sert à classer la recherche : « élysée » → le palais, pas un salon de massage (tests du 15/10/2026).
QRANK = "https://qrank.toolforge.org/download/qrank.csv.gz"


def qrank_subset(wanted, source=QRANK):
    """{Qid: rang} pour les seules entités de nos lieux (le fichier complet fait ≈ 125 Mo, lu au fil de l'eau)."""
    if isinstance(source, str) and source.startswith("http"):
        req = urllib.request.Request(source, headers={"User-Agent": "UntrackedMapsBot/0.1 (+https://untrackedmaps.app/confidentialite)"})
        raw = urllib.request.urlopen(req, timeout=120)
    else:
        raw = open(source, "rb")
    out = {}
    with gzip.open(raw, "rt", encoding="utf-8") as f:
        for row in csv.reader(f):
            if row[0] in wanted:
                out[row[0]] = int(row[1])
    return out


ATP_SKIP = re.compile(r"park|stasher|bagbnb|nannybag|bounce|charg|ev_|lime|velib|cityscoot|indigo|onepark|zenpark|yespark|saemes|effia", re.I)
COORD = re.compile(rb'"coordinates":\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)')


def atp_rows(zip_path, bbox):
    """Lignes (nom, lat, lon, propriétés) des lieux All The Places de la zone, lues sans tout charger en mémoire."""
    import zipfile
    w, s, e, n = bbox
    rows = []
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if not info.filename.endswith(".geojson") or ATP_SKIP.search(info.filename):
                continue
            with z.open(info) as f:
                for line in f:
                    m = COORD.search(line)
                    if not m:
                        continue
                    lon, lat = float(m[1]), float(m[2])
                    if not (s <= lat <= n and w <= lon <= e):
                        continue
                    try:
                        p = json.loads(line.strip().rstrip(b",")).get("properties", {})
                    except ValueError:
                        continue
                    name = p.get("name") or p.get("brand")
                    if name and p.get("amenity") not in ("parking", "charging_station", "atm", "vending_machine", "parcel_locker", "bicycle_rental"):
                        rows.append((name, lat, lon, p))
    return rows


def match_atp(items, rows):
    """Même enseigne (brand:wikidata) à 80 m, sinon même nom à 40 m."""
    by_brand = defaultdict(list)
    for i, (oid, lon, lat, tags) in enumerate(items):
        if tags.get("brand:wikidata"):
            by_brand[tags["brand:wikidata"]].append(i)
    found = {}
    rest = []
    for row in rows:
        _, lat, lon, p = row
        best = None
        for i in by_brand.get(p.get("brand:wikidata"), ()):
            d = meters(lat, lon, items[i][2], items[i][1])
            if d <= 80 and (best is None or d < best[0]):
                best = (d, i)
        if best:
            found.setdefault(best[1], []).append((best[0], row))
        else:
            rest.append(row)
    for i, c in match_rows(items, rest, 40, completable).items():
        found.setdefault(i, []).extend(c)
    return found


# ——— Annuaire de l'administration (service-public.fr, Licence Ouverte 2.0) ———
ANNUAIRE = ("https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/exports/json"
            "?where=plage_ouverture%20is%20not%20null%20and%20search(adresse%2C%22Paris%22)&select=nom,adresse,plage_ouverture")
JOURS = {"Lundi": 0, "Mardi": 1, "Mercredi": 2, "Jeudi": 3, "Vendredi": 4, "Samedi": 5, "Dimanche": 6}


def annuaire_hours(plages):
    """Plages de l'annuaire → horaires OSM ; None si une plage est « sur rendez-vous » ou illisible."""
    week = [[] for _ in range(7)]
    for p in plages:
        if re.search(r"rendez|rdv", p.get("commentaire") or "", re.I):
            return None
        a, b = JOURS.get(p.get("nom_jour_debut")), JOURS.get(p.get("nom_jour_fin"))
        if a is None or b is None or b < a:
            return None
        spans = []
        for k in (1, 2):
            h1, h2 = p.get(f"valeur_heure_debut_{k}") or "", p.get(f"valeur_heure_fin_{k}") or ""
            if h1 and h2:
                spans.append(f"{h1[:5]}-{h2[:5]}")
        for d in range(a, b + 1):
            week[d] += spans
    # ouvert 1 ou 2 jours : en général la permanence d'un service hébergé là, pas les horaires du lieu
    if sum(1 for d in week if d) < 3:
        return None
    rec = {f"horaires_{fr}": " / ".join(s.replace(":", "h").replace("-", " - ") for s in week[i]) or "-" for i, (fr, _) in enumerate(DAYS)}
    return paris_opening_hours(rec)


def annuaire_keep(tags):
    """Services publics seulement (pas l'école ni le square qui partagent l'adresse d'une PMI)."""
    return tags.get("amenity") in ("townhall", "police", "social_facility", "community_centre", "social_centre", "courthouse") or (
        tags.get("office") == "government")


def annuaire_rows(records):
    rows = []
    for r in records:
        try:
            plages = json.loads(r.get("plage_ouverture") or "[]")
            adresses = json.loads(r.get("adresse") or "[]")
        except ValueError:
            continue
        ad = next((a for a in adresses if a.get("type_adresse") == "Adresse" and (a.get("code_postal") or "").startswith("75")
                   and a.get("latitude")), None)
        hours = annuaire_hours(plages)
        if ad and hours and r.get("nom"):
            rows.append((r["nom"], float(ad["latitude"]), float(ad["longitude"]), hours))
    return rows


def paris_records():
    out = []
    for name in PARIS_SETS:
        out += json.load(urllib.request.urlopen(PARIS_API.format(name), timeout=120))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pbf")
    ap.add_argument("--out", default="extras.json")
    ap.add_argument("--overture-release", help="version d'Overture (par défaut : la plus récente)")
    ap.add_argument("--qrank", help="qrank.csv.gz déjà téléchargé (sinon : le plus récent)")
    ap.add_argument("--atp", help="archive output.zip d'All The Places déjà téléchargée (sinon : la plus récente)")
    ap.add_argument("--pays", default="FR", choices=["FR", "NL"], help="formats des téléphones et adresses ; l'annuaire de l'administration seulement en France")
    ap.add_argument("--no-paris", action="store_true", help="sans les horaires de la Ville de Paris (autres villes : places-zones.yml)")
    args = ap.parse_args()
    phone_of = phone_nl if args.pays == "NL" else phone_fr
    t0 = time.time()

    h = Places(14)
    h.apply_file(args.pbf, locations=True)
    items = [it for tile in h.tiles.values() for it in tile]
    lons = [it[1] for it in items]
    lats = [it[2] for it in items]
    bbox = (min(lons), min(lats), max(lons), max(lats))
    print(f"{len(items)} lieux OSM", file=sys.stderr)

    extras = defaultdict(dict)
    stats = Counter()

    def put(oid, key, value, source, until=None, has=False):
        """Ajoute un complément si ni OSM ni une source précédente ne l'a déjà (ordre = ordre de confiance)."""
        if has or key in extras[str(oid)]:
            return
        extras[str(oid)][key] = [value, source, until] if until else [value, source]
        stats[f"{source}:{key}"] += 1

    # 1. All The Places : publié par l'enseigne elle-même, le plus fiable
    try:
        zp = args.atp
        if not zp:
            # sans identifiant explicite, le serveur d'All The Places répond 403 (constaté le 15/10/2026 sur GitHub)
            get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=600)
            run = json.load(get(ATP_LATEST))
            zp = "atp.zip"
            with get(run["output_url"]) as r, open(zp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
        arows = atp_rows(zp, bbox)
        print(f"All The Places : {len(arows)} lieux dans la zone", file=sys.stderr)
        for i, cands in match_atp(items, arows).items():
            oid, lon, lat, tags = items[i]
            _, (_, _, _, p) = min(cands, key=lambda c: c[0])
            if valid_hours(p.get("opening_hours")):
                put(oid, "opening_hours", p["opening_hours"], "atp", has="opening_hours" in tags)
            if p.get("website") and not NOT_A_SITE.search(p["website"]):
                put(oid, "website", p["website"], "atp", has=bool(tags.get("website") or tags.get("contact:website")))
            tel = phone_of(p.get("phone", "").split(";")[0])
            if tel:
                put(oid, "phone", tel, "atp", has=bool(tags.get("phone") or tags.get("contact:phone")))
    except Exception as e:  # une source en panne ne bloque pas les autres
        print("All The Places ignoré :", e, file=sys.stderr)
    release = args.overture_release or latest_release()
    rows = overture_places(release, bbox)
    print(f"Overture {release} : {len(rows)} lieux dans la zone", file=sys.stderr)
    found = match_overture(items, rows, street_address_nl if args.pays == "NL" else street_address)
    # un même site attribué à plusieurs lieux sans rapport : site d'un réseau ou d'un centre commercial, on l'écarte
    site_use = Counter(w for cands in found.values() for _, ws, _, _ in cands for w in ws[:1])
    for i, cands in found.items():
        oid, lon, lat, tags = items[i]
        cands.sort(key=lambda c: c[0])
        _, websites, phones, addr = cands[0]
        if addr and not tags.get("addr:street"):
            put(oid, "addr", list(addr), "overture")
        has_site = tags.get("website") or tags.get("contact:website")
        has_phone = tags.get("phone") or tags.get("contact:phone")
        site = next((w for w in websites if not NOT_A_SITE.search(w) and site_use[w] <= 3 and site_of(tags["name"], w)), None)
        if site:
            put(oid, "website", site, "overture", has=bool(has_site))
        tel = next((p for p in map(phone_of, phones) if p), None)
        if tel:
            put(oid, "phone", tel, "overture", has=bool(has_phone))

    today = time.strftime("%Y-%m-%d")
    try:
        prows = [] if args.no_paris else paris_rows(paris_records(), today)
    except Exception as e:  # une source en panne ne bloque pas les autres
        print("Ville de Paris ignorée :", e, file=sys.stderr)
        prows = []
    for i, cands in match_rows(items, prows, 150, paris_keep).items():
        oid, lon, lat, tags = items[i]
        _, (name, _, _, hours, until) = min(cands, key=lambda c: c[0])
        put(oid, "opening_hours", hours, "paris", until or None, has="opening_hours" in tags)

    try:
        arows = annuaire_rows(json.load(urllib.request.urlopen(ANNUAIRE, timeout=120))) if args.pays == "FR" else []
    except Exception as e:
        print("Annuaire ignoré :", e, file=sys.stderr)
        arows = []
    for i, cands in match_rows(items, arows, 80, annuaire_keep).items():
        oid, lon, lat, tags = items[i]
        # plusieurs services au même endroit (mairie : état civil, élections…) aux horaires différents : on s'abstient
        if len({c[1][3] for c in cands}) > 1 or not valid_hours(cands[0][1][3]):
            continue
        put(oid, "opening_hours", cands[0][1][3], "annuaire", has="opening_hours" in tags)
    extras = {k: v for k, v in extras.items() if v}

    # notoriété Wikidata (QRank) des lieux qui ont un identifiant Wikidata, pour classer la recherche (build_search.py)
    try:
        qrank = qrank_subset({tags["wikidata"] for _, _, _, tags in items if tags.get("wikidata")}, args.qrank or QRANK)
        print(f"QRank : {len(qrank)} lieux connus", file=sys.stderr)
    except Exception as e:  # noqa: BLE001 — une source en panne ne bloque pas les autres
        print("QRank ignoré :", e, file=sys.stderr)
        qrank = {}

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps({"v": 1, "built": today, "overture": release, "places": extras, "qrank": qrank},
                                         ensure_ascii=False, separators=(",", ":")))
    print("compléments : " + ", ".join(f"{k} {v}" for k, v in sorted(stats.items())) + f" ; {len(extras)} lieux, en {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
