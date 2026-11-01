"""Zoom d'apparition des lieux mis en avant, par rang dans le quartier (méthode validée par le porteur le 01/11/2026).

Avant (build_overlays.assign_zoom) : les lieux étaient placés un par un, zoom après zoom, et un lieu placé gardait sa
place ; un lieu moins connu, placé à un zoom plus large, pouvait ainsi bloquer un lieu célèbre aux zooms suivants
(le Rijksmuseum n'apparaissait qu'au zoom 15,5, gêné par une place voisine).

Maintenant, comme Google Maps :
1. la carte est découpée en carrés dont la taille suit l'écart voulu à l'écran à ce zoom ; dans chaque carré, seuls
   les plus connus apparaissent (un monument et un commerce par carré : deux classements séparés, pour que les
   restaurants ne disputent plus la place aux monuments) ;
2. le zoom d'apparition d'un lieu est le premier où il est parmi eux : il ne dépend que des lieux plus connus de son
   carré, jamais de l'ordre de placement ;
3. les chevauchements restants (deux lieux de part et d'autre d'un bord de carré) sont réglés par la carte à
   l'affichage : le plus connu gagne (« symbol-sort-key », rang écrit par build_landmarks.py).
"""
import math
import os

from build_overlays import PLACES_FROM, STEPS, spacing_px

# taille du carré, en part de l'écart voulu à l'écran (build_overlays.SPACING) : les monuments plus serrés que les
# commerces. Réglée le 01/11/2026 pour garder une carte aussi calme qu'avant (étiquettes dessinées : 135 contre 164
# sur l'étalon, tests/landmarks-rendu.mjs) ; 0,6 / 1,0 en dessinait 27 % de plus. LM_CELL, LM_CELL_PLACE : pour mesurer.
CELL = {"landmark": float(os.environ.get("LM_CELL", 0.9)), "place": float(os.environ.get("LM_CELL_PLACE", 1.5))}
PER_CELL = {"landmark": 1, "place": 1}


def assign_zoom_cells(items, lat0=48.86, cell=CELL, per_cell=PER_CELL):
    """Donne à chaque lieu « z », le premier zoom où il est parmi les plus connus de son carré (de son genre)."""
    m_per_px0 = 156543.03 * math.cos(math.radians(lat0))
    kx = 111320 * math.cos(math.radians(lat0))
    xy = [(i["lon"] * kx, i["lat"] * 111320) for i in items]
    order = sorted(range(len(items)), key=lambda k: -items[k]["score"])
    for z in STEPS:
        d = spacing_px(z) * m_per_px0 / 2 ** z
        seen = {}
        for k in order:
            it = items[k]
            kind = it["kind"]
            if kind == "place" and z < PLACES_FROM:
                continue
            size = d * cell.get(kind, 1.0)
            key = (kind, int(xy[k][0] // size), int(xy[k][1] // size))
            n = seen.get(key, 0)
            if n < per_cell.get(kind, 1):
                seen[key] = n + 1
                if "z" not in it:
                    it["z"] = z
    return [i for i in items if "z" in i]
