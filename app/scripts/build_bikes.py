"""Réseau cyclable de Paris pour la carte vélo (étape 2, 22/10/2026), depuis l'extrait OSM de la nuit.

Le fond de carte (OpenFreeMap) ne garde que les pistes séparées : les bandes peintes, les voies bus partagées et
les double-sens cyclables sont des attributs de la rue dans OSM, perdus dans ses tuiles. On les extrait ici.

Sortie : data/bikes.geojson, chargé par l'app seulement quand la carte vélo s'affiche.
  k = "track"   piste séparée (highway=cycleway, ou cycleway*=track sur la rue)
      "lane"    bande cyclable ou voie bus ouverte aux vélos (cycleway*=lane / share_busway, busway + bicycle)
      "contra"  double-sens cyclable (rue à sens unique, oneway:bicycle=no)
      "shared"  rue ou allée où le vélo est autorisé (piétonne, zone de rencontre, chemin) — affichée en zoom
Données © contributeurs OpenStreetMap, ODbL.
Usage : python build_bikes.py paris.osm.pbf --out out/bikes.geojson
"""
import argparse
import json
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pbf')
    ap.add_argument('--out', default='out/bikes.geojson')
    a = ap.parse_args()
    h = Bikes()
    h.apply_file(a.pbf, locations=True)
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    with open(a.out, 'w') as f:
        json.dump({'type': 'FeatureCollection', 'features': h.features}, f, separators=(',', ':'))
    count = {}
    for ft in h.features:
        count[ft['properties']['k']] = count.get(ft['properties']['k'], 0) + 1
    print(f'{len(h.features)} voies cyclables', count, f'{os.path.getsize(a.out) // 1024} Ko')


if __name__ == '__main__':
    main()
