"""Réseau cyclable de Paris pour la carte vélo (étape 2, 22/10/2026), depuis l'extrait OSM de la nuit.

Le fond de carte (OpenFreeMap) ne garde que les pistes séparées : les bandes peintes, les voies bus partagées et
les double-sens cyclables sont des attributs de la rue dans OSM, perdus dans ses tuiles. On les extrait ici.

Sortie (Île-de-France, 23/10/2026 : découpée pour que le téléphone ne charge que ce qu'il affiche) :
  out/bikes/index.json        {"v":1, "zoom":11, "tiles":["1037/704", …]}
  out/bikes/11/x/y.json       FeatureCollection des voies dont le premier point est dans la tuile (≈ 13 km de côté)
  out/bikes.geojson           Paris seulement, pour les versions de l'app pas encore à jour
  k = "track"   piste séparée (highway=cycleway, ou cycleway*=track sur la rue)
      "lane"    bande cyclable ou voie bus ouverte aux vélos (cycleway*=lane / share_busway, busway + bicycle)
      "contra"  double-sens cyclable (rue à sens unique, oneway:bicycle=no)
      "shared"  rue ou allée où le vélo est autorisé (piétonne, zone de rencontre, chemin) — affichée en zoom
Données © contributeurs OpenStreetMap, ODbL.
Usage : python build_bikes.py ile_de_france.osm.pbf --out out
"""
import argparse
import json
import math
import os

import osmium

SIDES = ('cycleway', 'cycleway:both', 'cycleway:left', 'cycleway:right')
BIKE_OK = {'yes', 'designated', 'permissive'}
ROADS = {'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'trunk',
         'primary_link', 'secondary_link', 'tertiary_link'}


def kind(tags):
    """Catégorie cyclable d'une voie OSM (dict de tags), ou None."""
    hw = tags.get('highway')
    if not hw:
        return None
    if tags.get('bicycle') == 'no' and hw != 'cycleway':
        return None
    if hw == 'cycleway':
        return 'track'
    sides = {tags.get(k, '') for k in SIDES}
    if 'track' in sides:
        return 'track'
    if sides & {'lane', 'share_busway', 'opposite_lane'} or (
            tags.get('busway') in {'lane', 'both'} and tags.get('bicycle') in BIKE_OK):
        return 'lane'
    if hw in ROADS and tags.get('oneway') in {'yes', '-1'} and (
            tags.get('oneway:bicycle') == 'no' or sides & {'opposite', 'opposite_track'}):
        return 'contra'
    if hw in {'pedestrian', 'footway', 'path', 'bridleway', 'track'} and tags.get('bicycle') in BIKE_OK:
        return 'shared'
    if hw == 'living_street' or tags.get('bicycle_road') == 'yes' or tags.get('cyclestreet') == 'yes':
        return 'shared'
    return None


class Bikes(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []

    def way(self, w):
        k = kind({t.k: t.v for t in w.tags})
        if not k:
            return
        try:
            coords = [[round(n.lon, 5), round(n.lat, 5)] for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        if len(coords) >= 2:
            self.features.append({'type': 'Feature', 'properties': {'k': k},
                                  'geometry': {'type': 'LineString', 'coordinates': coords}})


ZOOM = 11
PARIS = (2.224, 48.815, 2.47, 48.902)          # ouest, sud, est, nord (fichier unique des anciennes versions)


def tile_of(lon, lat, z=ZOOM):
    n = 2 ** z
    r = math.radians(lat)
    return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)


def write(features, out):
    """Tuiles + index + fichier Paris ; renvoie {tuile: nombre}."""
    fc = lambda fs: {'type': 'FeatureCollection', 'features': fs}
    tiles = {}
    for ft in features:
        lon, lat = ft['geometry']['coordinates'][0]
        tiles.setdefault(tile_of(lon, lat), []).append(ft)
    for (x, y), fs in tiles.items():
        os.makedirs(os.path.join(out, 'bikes', str(ZOOM), str(x)), exist_ok=True)
        json.dump(fc(fs), open(os.path.join(out, 'bikes', str(ZOOM), str(x), f'{y}.json'), 'w'), separators=(',', ':'))
    json.dump({'v': 1, 'zoom': ZOOM, 'tiles': sorted(f'{x}/{y}' for x, y in tiles)},
              open(os.path.join(out, 'bikes', 'index.json'), 'w'), separators=(',', ':'))
    w, s, e, n = PARIS
    paris = [f for f in features if any(w <= c[0] <= e and s <= c[1] <= n for c in f['geometry']['coordinates'])]
    json.dump(fc(paris), open(os.path.join(out, 'bikes.geojson'), 'w'), separators=(',', ':'))
    return {f'{x}/{y}': len(fs) for (x, y), fs in tiles.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pbf')
    ap.add_argument('--out', default='out')
    a = ap.parse_args()
    h = Bikes()
    h.apply_file(a.pbf, locations=True)
    tiles = write(h.features, a.out)
    count = {}
    for ft in h.features:
        count[ft['properties']['k']] = count.get(ft['properties']['k'], 0) + 1
    print(f'{len(h.features)} voies cyclables', count, f'{len(tiles)} tuiles')


if __name__ == '__main__':
    main()
