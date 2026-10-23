// Index de recherche découpé par zone (Île-de-France, 23/10/2026) : le téléphone ne charge que l'essentiel
// (lieux connus de toute la région : gares, musées, communes…) et les zones autour de lui (≈ 6,5 km de côté),
// au lieu d'un fichier unique devenu trop lourd. Toujours rien d'envoyé : la recherche se fait sur l'appareil.
// Fichiers (scripts/build_search.py) : places/search/index.json, search/core.json, search/<z>/<x>/<y>.json.
// Ancien format (un seul places/search.json) encore accepté, le temps que les données de la nuit suivent.
import { prepare, searchIndex } from './searchindex.js';

// zones à ± 4 km : au centre de Paris ≈ le poids de l'ancien index unique (5,5 Mo, 1,9 Mo compressé, mesuré le 23/10)
const RADIUS_KM = 4;
let meta = null;                  // promesse de l'index des zones (ou null : ancien format)
const cache = new Map();          // chemin → promesse de l'index préparé

export const tileOf = (lon, lat, z) => {
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
};

/** Zones (« x/y ») à charger autour de `at` : celles qui touchent un carré de ± RADIUS_KM, parmi celles qui existent. */
export function zonesAround(at, z, available) {
  const dLat = RADIUS_KM / 111, dLon = RADIUS_KM / (111 * Math.cos((at.lat * Math.PI) / 180));
  const [x0, y1] = tileOf(at.lon - dLon, at.lat - dLat, z), [x1, y0] = tileOf(at.lon + dLon, at.lat + dLat, z);
  const have = new Set(available), out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (have.has(`${x}/${y}`)) out.push(`${x}/${y}`);
  return out;
}

function load(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => (r.ok ? r.json() : null)).then((raw) => (raw?.items ? prepare(raw) : null))
      .catch(() => { cache.delete(url); return null; }));
  }
  return cache.get(url);
}

/** Les index à interroger autour de `at` (préparés, mis en cache). */
export async function indexesAt(base, at) {
  meta ??= fetch(`${base}places/search/index.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const m = await meta;
  if (!m) return [await load(`${base}places/search.json`)].filter(Boolean);
  const paths = ['core', ...zonesAround(at, m.zoom, m.zones).map((k) => `${m.zoom}/${k}`)];
  return (await Promise.all(paths.map((p) => load(`${base}places/search/${p}.json`)))).filter(Boolean);
}

/** Recherche dans plusieurs index : meilleurs résultats de chacun, doublons retirés (même lieu dans deux fichiers). */
export function searchMany(idxs, query, at, limit = 7) {
  const all = idxs.flatMap((idx) => searchIndex(idx, query, at, limit));
  all.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return all.filter((r) => !seen.has(r.id) && seen.add(r.id)).slice(0, limit);
}
