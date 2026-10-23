"""Réseau cyclable : catégorie de chaque voie OSM (build_bikes.kind)."""
from build_bikes import kind, write, tile_of


def test_pistes():
    assert kind({'highway': 'cycleway'}) == 'track'
    assert kind({'highway': 'primary', 'cycleway:right': 'track'}) == 'track'


def test_bandes_et_voies_bus():
    assert kind({'highway': 'secondary', 'cycleway:both': 'lane'}) == 'lane'
    assert kind({'highway': 'primary', 'cycleway:left': 'share_busway'}) == 'lane'
    assert kind({'highway': 'primary', 'busway': 'lane', 'bicycle': 'yes'}) == 'lane'


def test_double_sens():
    assert kind({'highway': 'residential', 'oneway': 'yes', 'oneway:bicycle': 'no'}) == 'contra'
    assert kind({'highway': 'residential', 'oneway': 'yes'}) is None


def test_velo_autorise_et_exclusions():
    assert kind({'highway': 'pedestrian', 'bicycle': 'yes'}) == 'shared'
    assert kind({'highway': 'living_street'}) == 'shared'
    assert kind({'highway': 'footway'}) is None
    assert kind({'highway': 'residential', 'cycleway:both': 'lane', 'bicycle': 'no'}) is None
    assert kind({'building': 'yes'}) is None


def test_decoupage_par_tuile(tmp_path):
    import json
    line = lambda k, pts: {'type': 'Feature', 'properties': {'k': k}, 'geometry': {'type': 'LineString', 'coordinates': pts}}
    fs = [line('track', [[2.35, 48.86], [2.36, 48.86]]),          # Paris
          line('lane', [[2.50, 48.87], [2.51, 48.87]]),           # Rosny-sous-Bois
          line('lane', [[2.10, 48.80], [2.11, 48.80]])]           # Versailles
    tiles = write(fs, str(tmp_path))
    assert sum(tiles.values()) == 3
    idx = json.load(open(tmp_path / 'bikes' / 'index.json'))
    assert idx['zoom'] == 11 and len(idx['tiles']) == len(tiles)
    x, y = tile_of(2.10, 48.80)
    assert len(json.load(open(tmp_path / 'bikes' / '11' / str(x) / f'{y}.json'))['features']) >= 1
    # ancien fichier unique : Paris seulement
    assert [f['properties']['k'] for f in json.load(open(tmp_path / 'bikes.geojson'))['features']] == ['track']
