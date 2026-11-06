"""Contrôle avant la publication : on ne publie pas des lieux qui ont fondu par rapport à la version en ligne
(extrait OSM tronqué, panne d'une source, erreur de calcul). Une baisse de plus de 10 % des lieux, des tuiles, ou d'un
champ (horaires, photos des sites, photos Wikimedia, articles, devantures ; 06/11/2026) arrête la publication : la
version précédente reste en ligne, entière, et le calcul échoue en rouge (mail de GitHub).

Usage :  python app/scripts/check_publish.py out/places/index.json [https://untrackedmaps.app/data/places/index.json]
Code de sortie 0 : publiable ; 1 : baisse anormale (ou index vide).
"""
import json
import sys
import urllib.request

ONLINE = "https://untrackedmaps.app/data/places/index.json"
MAX_DROP = 0.10   # baisse tolérée d'une nuit à l'autre
MIN_COUNT = 50    # en dessous, un champ n'est pas comparé (trop peu pour qu'une variation veuille dire quelque chose)
LABELS = {"named": "lieux nommés", "hours": "horaires", "site_photos": "photos des sites", "wiki_photos": "photos Wikimedia",
          "articles": "articles Wikipédia", "facades": "devantures"}


def cells(index):
    """Nombre de carrés de 2,4 km couverts : depuis les fichiers adaptatifs (v2, 31/10/2026), un fichier en couvre
    plusieurs, donc on compare les carrés, pas les fichiers (l'ancien index en avait un par fichier)."""
    return index.get("cells", len(index.get("tiles") or []))


def verdict(new, old, max_drop=MAX_DROP):
    """(publiable, explication). old peut manquer (première publication, site injoignable)."""
    nt = cells(new)
    if not nt or not new.get("count", 1):
        return False, "index vide"
    if not old:
        return True, f"{nt} tuiles ; pas de version en ligne pour comparer"
    checks = [("tuiles", nt, cells(old))]
    if "count" in new and "count" in old:          # (le nombre de lieux n'est dans l'index que depuis le 30/10/2026)
        checks.append(("lieux", new["count"], old["count"]))
    # champs (index depuis le 06/11/2026) : comparés dès qu'ils sont dans les deux versions et assez nombreux
    nm, om = new.get("metrics") or {}, old.get("metrics") or {}
    for k in ("named", "hours", "site_photos", "wiki_photos", "articles", "facades"):
        if k in nm and om.get(k, 0) >= MIN_COUNT:
            checks.append((LABELS[k], nm[k], om[k]))
    msgs, ok = [], True
    for name, n, o in checks:
        msgs.append(f"{name} : {o} → {n}")
        if o and n < o * (1 - max_drop):
            ok = False
            msgs[-1] += f" (baisse de {100 * (o - n) / o:.0f} %, plus de {max_drop:.0%})"
    return ok, " ; ".join(msgs)


def main(path, online=ONLINE):
    new = json.load(open(path))
    try:
        with urllib.request.urlopen(online, timeout=30) as r:
            old = json.load(r)
    except Exception as e:  # site injoignable : on ne bloque pas pour autant
        print(f"version en ligne illisible ({e})")
        old = None
    ok, why = verdict(new, old)
    print(("publiable : " if ok else "NON PUBLIÉ : ") + why)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
