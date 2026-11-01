// Lieux OpenStreetMap lus dans des tuiles préparées à l'avance (scripts/build_places.py).
// Aucune requête lieu par lieu à un service tiers : l'app charge la tuile (≈ 2,4 km de côté) et y lit tout.
// Tout reste sur l'appareil ; seules les tuiles consultées sont téléchargées, depuis notre hébergement.
import { tx } from '#lib/i18n/index.js';
import { dataBase } from './config.js';
import { readJson } from './gzjson.js';
import { pictureUrls } from './panoramax.js';

import ZONES from './cities/zones.json' with { type: 'json' };

// Plusieurs jeux de tuiles : l'Île-de-France (data/places/, refait chaque nuit) et les autres villes
// (data/zones/<ville>/places/, refaites moins souvent, voir zones.json). L'index d'une ville n'est chargé que si
// l'on regarde dans son cadre.
export const SOURCES = [{ id: 'idf', dir: 'places/', bbox: null }, ...ZONES.map((z) => ({ id: z.id, dir: ['zones', z.id, 'places', ''].join('/'), bbox: z.bbox }))];
const indexes = new Map();  // id de la source → Promise<{ zooms, tiles: Set('z/x/y'), built }>
const files = new Map();    // 'source:z/x/y' → Promise<Map('x/y' de zoom 14 → [lieux])>
const ZOOM = 14;            // carrés de base (≈ 2,4 km) ; un fichier en couvre un ou plusieurs (voir scripts/tileio.py)

function loadIndex(src = SOURCES[0]) {
  if (!indexes.has(src.id)) {
    indexes.set(src.id, (async () => {
      try {
        const r = await fetch(`${dataBase()}${src.dir}index.json`);
        const j = r.ok ? await r.json() : null;
        return j ? readIndex(j) : { zooms: [ZOOM], built: null, tiles: new Set(), ext: '.json.gz' };
      } catch {
        return { zooms: [ZOOM], built: null, tiles: new Set(), ext: '.json.gz' };
      }
    })());
  }
  return indexes.get(src.id);
}

/** Index v2 (fichiers adaptatifs « z/x/y », compressés) ou v1 (un fichier .json par carré « x/y » de zoom 14). */
export function readIndex(j) {
  if (j.v >= 2) return { zooms: [...j.zooms].sort((a, b) => a - b), built: j.built, tiles: new Set(j.tiles), ext: '.json.gz' };
  return { zooms: [j.zoom], built: j.built, tiles: new Set(j.tiles.map((k) => `${j.zoom}/${k}`)), ext: '.json' };
}

/** Le fichier qui contient ce carré de zoom 14 (« z/x/y »), ou null. */
export function fileOf(index, x, y) {
  for (const z of index.zooms) {
    const s = ZOOM - z, key = `${z}/${x >> s}/${y >> s}`;
    if (index.tiles.has(key)) return key;
  }
  return null;
}

/** Bords (ouest, sud, est, nord) d'une tuile. */
function tileBox(x, y, z) {
  const n = 2 ** z, lon = (v) => (v / n) * 360 - 180;
  const lat = (v) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * v) / n))) * 180) / Math.PI;
  return [lon(x), lat(y + 1), lon(x + 1), lat(y)];
}
const meets = (a, b) => !b || (a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]);
/** Sources dont le cadre touche cette tuile (l'Île-de-France est toujours consultée). */
export const sourcesFor = (x, y, z = ZOOM) => SOURCES.filter((s) => meets(tileBox(x, y, z), s.bbox));

/** La source et le fichier qui ont ce carré, ou null. */
async function sourceOf(x, y) {
  for (const s of sourcesFor(x, y)) {
    const index = await loadIndex(s);
    const file = fileOf(index, x, y);
    if (file) return { src: s, file, ext: index.ext };
  }
  return null;
}

export function tileXY(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return [x, y];
}

/** Lieux d'un fichier, rangés par carré de zoom 14. */
function loadFile({ src, file, ext }) {
  const key = `${src.id}:${file}`;
  if (!files.has(key)) {
    files.set(key, (async () => {
      const r = await fetch(`${dataBase()}${src.dir}${file}${ext}`).catch(() => null);
      const j = r?.ok ? await readJson(r) : null;
      const cells = new Map();
      for (const [id, lon, lat, tags, f] of j?.t || []) {
        const k = tileXY(lon, lat, ZOOM).join('/');
        if (!cells.has(k)) cells.set(k, []);
        // base : dossier de la zone, pour les fichiers qui l'accompagnent (photos des avis, review_photos.py)
        cells.get(k).push({ id, lon, lat, tags, facade: f ? facadeOf(f) : null, base: `${dataBase()}${src.dir}` });
      }
      return cells;
    })().catch(() => new Map()));
  }
  return files.get(key);
}

/** Toutes les sources qui ont ce carré (deux régions voisines peuvent se chevaucher sur leur bordure). */
async function sourcesWith(x, y) {
  const out = [];
  for (const s of sourcesFor(x, y)) {
    const index = await loadIndex(s);
    const file = fileOf(index, x, y);
    if (file) out.push({ src: s, file, ext: index.ext });
  }
  return out;
}

/** Lieux d'un carré, réunis depuis toutes les sources qui l'ont, sans doublon (même identifiant OSM). */
async function loadTile(x, y) {
  const lists = await Promise.all((await sourcesWith(x, y)).map(async (w) => (await loadFile(w)).get(`${x}/${y}`) || []));
  if (lists.length < 2) return lists[0] || [];
  const seen = new Set();
  return lists.flat().filter((p) => !seen.has(p.id) && seen.add(p.id));
}

/** Les lieux d'une zone (au plus `maxTiles` tuiles, les plus proches du centre d'abord). */
export async function placesInBounds({ west, south, east, north }, maxTiles = 6) {
  const [x0, y0] = tileXY(west, north, ZOOM);
  const [x1, y1] = tileXY(east, south, ZOOM);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const keys = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const where = await sourceOf(x, y);
    // un fichier d'un seul carré n'existe que s'il a des lieux ; un grand fichier (campagne) peut avoir des carrés vides :
    // on le charge (il est petit, et sera lu de toute façon) pour ne garder que les carrés habités
    if (where && (where.file.startsWith(`${ZOOM}/`) || (await loadFile(where)).has(`${x}/${y}`))) keys.push([x, y]);
  }
  keys.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
  const lists = await Promise.all(keys.slice(0, maxTiles).map(([x, y]) => loadTile(x, y)));
  return lists.flat();
}

/** Un lieu par son identifiant OSM, cherché dans la tuile de sa position (et les voisines si besoin). */
export async function placeById(osmType, osmId, lat, lon) {
  const id = Number(osmId) * 10 + { node: 1, way: 2, relation: 3 }[osmType];
  const [x, y] = tileXY(lon, lat, ZOOM);
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const hit = (await loadTile(x + dx, y + dy)).find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}

/** La zone couverte par les données ? */
export async function covers(lat, lon) {
  const [x, y] = tileXY(lon, lat, ZOOM);
  return !!(await sourceOf(x, y));
}

/** Date de l'extrait OSM dont viennent les lieux : ceux d'Île-de-France, ou ceux du point donné (null si non couvert). */
export async function dataDate(lat, lon) {
  if (lat == null) return (await loadIndex()).built;
  const [x, y] = tileXY(lon, lat, ZOOM);
  const where = await sourceOf(x, y);
  return where ? (await loadIndex(where.src)).built : null;
}

/**
 * Photo de devanture (Panoramax, 360°) : de quoi la charger et la recadrer vers le lieu.
 * [idPhoto, hôte, azimut de la photo, cap vers le lieu, distance, licence, auteur, date]
 */
function facadeOf([id, host, az, bearing, d, lic, by, date]) {
  // l'image complète (équirectangulaire, recadrée à l'affichage) et ses tuiles HD pour le plein écran
  const { src, tile } = pictureUrls(id, host);
  const rel = ((bearing - az + 540) % 360) - 180;     // où regarder, en degrés depuis le centre de la photo
  const credit = lic.startsWith('etalab') ? tx('photos.ville_de_paris_ign_panoramax') : tx('photos.panoramax_2', { auteur: by || 'contributeur', lic });
  return { id, src, tile, rel, d, credit, lic, date, page: `https://api.panoramax.xyz/#focus=pic&pic=${id}` };
}
