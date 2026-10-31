// Lieux mis en avant sur la carte (monuments, bonnes adresses), avec leur zoom d'apparition : mêmes règles partout
// (porteur, 31/10/2026). Préparés par zone (scripts/build_landmarks.py) en carrés d'≈ 40 km, compressés ; on ne
// charge que les carrés à l'écran, depuis notre hébergement. Remplace l'ancien fichier unique de l'Île-de-France.
import { dataBase } from './config.js';
import { readJson } from './gzjson.js';
import { SOURCES, tileXY } from './placestore.js';
import { outsideFilter } from './mapstyle.js';
import { city } from './cities/index.js';

export const MIN_ZOOM = 11.5;
const indexes = new Map();   // source → Promise<{ zoom, tiles: Set }>
const tiles = new Map();     // 'source:z/x/y' → Promise<[feature]>

function index(src) {
  if (!indexes.has(src.id)) {
    indexes.set(src.id, fetch(`${dataBase()}${src.dir}landmarks/index.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j ? { zoom: j.zoom, tiles: new Set(j.tiles) } : { zoom: 10, tiles: new Set() }))
      .then((ix) => { if (ix.tiles.size && src.bbox) covered(src.bbox); return ix; })
      .catch(() => ({ zoom: 10, tiles: new Set() })));
  }
  return indexes.get(src.id);
}

// zones dont les carrés existent : le fond de carte s'y efface (avant leur première construction, il reste en secours)
const boxes = [city.searchBbox];
let onCovered = () => {};
function covered(bbox) { if (!boxes.includes(bbox)) { boxes.push(bbox); onCovered(); } }

/** Une ligne d'un carré → entité GeoJSON (mêmes propriétés que l'ancien fichier : le calque et le clic ne changent pas). */
// identifiant unique d'une zone à l'autre (identifiant OSM × 10 + type), pour masquer le lieu choisi sous son épingle
const KIND = { node: 1, way: 2, relation: 3 };
const idOf = (osm) => { const [t, n] = osm.split('/'); return Number(n) * 10 + (KIND[t] || 0); };
export const toFeature = ([lon, lat, name, family, subclass, z, rank, osm]) =>
  ({ type: 'Feature', id: idOf(osm), geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { name, family, subclass, z, rank, osm } });

function tile(src, key) {
  const k = `${src.id}:${key}`;
  if (!tiles.has(k)) {
    tiles.set(k, fetch(`${dataBase()}${src.dir}landmarks/${key}.json.gz`)
      .then((r) => (r.ok ? readJson(r) : []))
      .then((rows) => rows.map(toFeature))
      .catch(() => []));
  }
  return tiles.get(k);
}

const meets = (a, b) => !b || (a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]);

/** Les lieux mis en avant dans une zone de la carte, sans doublon (bordure entre deux régions). */
export async function landmarksIn({ west, south, east, north }) {
  const view = [west, south, east, north];
  const lists = [];
  for (const src of SOURCES.filter((s) => meets(view, s.bbox))) {
    const ix = await index(src);
    const [x0, y0] = tileXY(west, north, ix.zoom), [x1, y1] = tileXY(east, south, ix.zoom);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = `${ix.zoom}/${x}/${y}`;
      if (ix.tiles.has(key)) lists.push(tile(src, key));
    }
  }
  const seen = new Set();
  return (await Promise.all(lists)).flat().filter((f) => !seen.has(f.properties.osm) && seen.add(f.properties.osm));
}

/** Tient la source « landmarks » de la carte à jour quand on la déplace (et après un changement de thème). */
export function followLandmarks(map) {
  let data = { type: 'FeatureCollection', features: [] }, n = 0;
  const apply = () => map.getSource('landmarks')?.setData(data);
  const refresh = async () => {
    if (map.getZoom() < MIN_ZOOM - 0.5) return;
    const b = map.getBounds(), id = ++n;
    // un peu au-delà de l'écran, pour que les lieux soient là quand on fait glisser la carte
    const dx = (b.getEast() - b.getWest()) / 2, dy = (b.getNorth() - b.getSouth()) / 2;
    const feats = await landmarksIn({ west: b.getWest() - dx, south: b.getSouth() - dy, east: b.getEast() + dx, north: b.getNorth() + dy });
    if (id !== n) return;   // une demande plus récente est partie entre-temps
    if (feats.length === data.features.length && feats.every((f, i) => f === data.features[i])) return;
    data = { type: 'FeatureCollection', features: feats };
    apply();
  };
  const filter = () => { if (map.getLayer('poi-outside')) map.setFilter('poi-outside', outsideFilter(boxes)); };
  onCovered = filter;
  map.on('moveend', refresh);
  map.on('style.load', () => { apply(); filter(); });
  refresh();
  return refresh;
}
