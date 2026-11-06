"""Contrôle avant de publier les compléments d'Île-de-France (data/extras.json) et leurs états (06/11/2026) : le 02/11,
une étape ratée a publié des compléments sans aucune photo Wikimedia ni article, à la place des bons. Ici, chaque champ
est compté et comparé à la version en ligne : une baisse de plus de 10 % arrête la publication (la version en ligne
reste, entière) et le calcul échoue en rouge.

Usage :  python check_extras.py out/extras.json [https://untrackedmaps.app/data/extras.json]
Code de sortie 0 : publiable ; 1 : baisse anormale.
"""
import json
import sys
import urllib.request

ONLINE = "https://untrackedmaps.app/data/extras.json"
MAX_DROP = 0.10
MIN_COUNT = 50
FIELDS = {"website": "sites", "phone": "téléphones", "opening_hours": "horaires", "_photo": "photos des sites",
          "_wph": "photos Wikimedia", "_wt": "articles Wikipédia"}


def counts(extras):
    """Nombre de lieux par champ. Pure."""
    places = (extras or {}).get("places") or {}
    out = {"lieux": len(places)}
    for k, label in FIELDS.items():
        out[label] = sum(1 for v in places.values() if k in v)
    return out


def verdict(new, old, max_drop=MAX_DROP):
    """(publiable, explication) ; old peut manquer (première publication)."""
    n = counts(new)
    if not old:
        return True, "pas de version en ligne pour comparer : " + ", ".join(f"{k} {v}" for k, v in n.items())
    o = counts(old)
    ok, msgs = True, []
    for k, v in n.items():
        msgs.append(f"{k} : {o[k]} → {v}")
        if o[k] >= MIN_COUNT and v < o[k] * (1 - max_drop):
            ok = False
            msgs[-1] += f" (baisse de {100 * (o[k] - v) / o[k]:.0f} %)"
    return ok, " ; ".join(msgs)


def main(path, online=ONLINE):
    new = json.load(open(path))
    try:
        with urllib.request.urlopen(online, timeout=60) as r:
            old = json.load(r)
    except Exception as e:
        print(f"::error::version en ligne illisible ({e}) : publication refusée par prudence")
        return 1
    ok, why = verdict(new, old)
    print(("publiable : " if ok else "::error::NON PUBLIÉ : ") + why)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
