// Index de recherche découpé par zone (Île-de-France, 23/10/2026 ; chaque région et Amsterdam, 31/10/2026) :
// le téléphone ne charge que l'essentiel de la région où il se trouve (gares, musées, communes, lieux connus) et les
// zones autour de lui (≈ 6,5 km de côté). Toujours rien d'envoyé : la recherche se fait sur l'appareil.
// Fichiers (scripts/build_search.py), pour chaque source de lieux (places/, zones/<id>/places/, voir placestore.js) :
// search/index.json, search/core.json.gz, search/<z>/<x>/<y>.json.gz (compressés comme les tuiles de lieux).
// Ancien format non compressé (index v2, fichiers .json) encore lu, le temps que les données suivent.
import { prepare, searchIndex } from './searchindex.js';
import { SOURCES } from './placestore.js';
import { readJson } from './gzjson.js';
import { city } from '#lib/cities/index.js';

// zones à ± 4 km : au centre de Paris ≈ le poids de l'ancien index unique (5,5 Mo, 1,9 Mo compressé, mesuré le 23/10)
const RADIUS_KM = 4;
const metas = new Map();          // url de l'index → promesse de l'index des zones (ou null)
const cache = new Map();          // url → promesse de l'index préparé

export const tileOf = (lon, lat, z) => {
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
};

const around = (at) => {
  const dLat = RADIUS_KM / 111, dLon = RADIUS_KM / (111 * Math.cos((at.lat * Math.PI) / 180));
  return [at.lon - dLon, at.lat - dLat, at.lon + dLon, at.lat + dLat];
};

/** Zones (« x/y ») à charger autour de `at` : celles qui touchent un carré de ± RADIUS_KM, parmi celles qui existent. */
export function zonesAround(at, z, available) {
  const [w, s, e, n] = around(at);
  const [x0, y1] = tileOf(w, s, z), [x1, y0] = tileOf(e, n, z);
  const have = new Set(available), out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (have.has(`${x}/${y}`)) out.push(`${x}/${y}`);
  return out;
}

const meets = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** Sources de lieux dont la zone touche les environs de `at` (près d'une limite de région : les deux). */
export function sourcesNear(at, sources = SOURCES) {
  const box = around(at);
  return sources.filter((s) => meets(box, s.bbox || city.searchBbox));
}

function load(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => (r.ok ? readJson(r) : null)).then((raw) => (raw?.items ? prepare(raw) : null))
      .catch(() => { cache.delete(url); return null; }));
  }
  return cache.get(url);
}

/** Chemins des fichiers à lire dans une source, d'après son index (v2 : .json ; v3 : .json.gz).
 *  Rien si la source n'a aucun lieu autour de `at` : les cadres des régions se chevauchent (Paris est dans celui du
 *  Centre), on ne charge pas l'essentiel d'une région voisine pour rien. */
export function filesFor(m, at) {
  const ext = m.ext || '.json', near = zonesAround(at, m.zoom, m.zones);
  return near.length ? [`core${ext}`, ...near.map((k) => `${m.zoom}/${k}${ext}`)] : [];
}

async function indexesOf(base, src, at) {
  const dir = `${base}${src.dir}search/`;
  if (!metas.has(dir)) metas.set(dir, fetch(`${dir}index.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  const m = await metas.get(dir);
  return m ? Promise.all(filesFor(m, at).map((p) => load(dir + p))) : [];
}

/** Les index à interroger autour de `at` (préparés, mis en cache) ; vide là où nous n'avons pas de données. */
export async function indexesAt(base, at) {
  return (await Promise.all(sourcesNear(at).map((s) => indexesOf(base, s, at)))).flat().filter(Boolean);
}

/** Recherche dans plusieurs index : meilleurs résultats de chacun, doublons retirés (même lieu dans deux fichiers). */
export function searchMany(idxs, query, at, limit = 7) {
  const all = idxs.flatMap((idx) => searchIndex(idx, query, at, limit));
  all.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return all.filter((r) => !seen.has(r.id) && seen.add(r.id)).slice(0, limit);
}
