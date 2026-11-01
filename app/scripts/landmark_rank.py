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
LAST_Z = 16.5     # zoom à partir duquel tous les lieux retenus peuvent apparaître (comme Plans, galerie marchande du 01/11)


def assign_zoom_cells(items, lat0=48.86, cell=CELL, per_cell=PER_CELL):
    """Donne à chaque lieu « z », le premier zoom où il est parmi les plus connus de son carré (de son genre)."""
    # mètres par pixel au zoom 0 de la carte : MapLibre dessine des tuiles de 512 px (et non 256 comme l'ancien calcul,
    # build_overlays.assign_zoom, qui doublait sans le dire l'écart à l'écran : carte trop vide, Amsterdam 01/11/2026)
    m_per_px0 = 78271.52 * math.cos(math.radians(lat0))
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
    # les autres apparaissent tous en zoomant encore, la carte ne gardant que ceux qui ne se chevauchent pas
    # (avant : jamais affichés, même au plus près ; dans une galerie marchande, la plupart des boutiques manquaient)
    for it in items:
        if "z" not in it:
            it["z"] = LAST_Z
    return items
