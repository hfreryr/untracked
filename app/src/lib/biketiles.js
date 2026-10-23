// Réseau cyclable découpé par tuile (scripts/build_bikes.py, Île-de-France) : on ne charge que les tuiles visibles
// (≈ 13 km de côté), et on garde celles déjà vues. Ancien format (un seul bikes.geojson) accepté en secours.
import { tileOf } from './searchzones.js';

/** Tuiles (« x/y ») qui touchent la zone affichée (bornes ouest, sud, est, nord), parmi celles qui existent. */
export function tilesIn(b, z, available) {
  const [x0, y1] = tileOf(b.west, b.south, z), [x1, y0] = tileOf(b.east, b.north, z);
  const have = new Set(available), out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (have.has(`${x}/${y}`)) out.push(`${x}/${y}`);
  return out;
}

/** @param {string} base  adresse du dossier data/ */
export function createBikeTiles(base) {
  let meta = null;
  const tiles = new Map();          // « x/y » → promesse de ses tronçons
  let legacy = null;
  /**
   * Tous les tronçons chargés après avoir complété la zone `b`, et si cette zone est couverte par nos données
   * (hors Île-de-France, non : on montre alors les pistes du fond de carte). features null : aucune donnée.
   * @returns {Promise<{features: object[]|null, covered: boolean}>}
   */
  async function load(b) {
    meta ??= fetch(`${base}bikes/index.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const m = await meta;
    if (!m) {
      legacy ??= fetch(`${base}bikes.geojson`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const fs = (await legacy)?.features || null;
      return { features: fs, covered: !!fs };
    }
    const here = tilesIn(b, m.zoom, m.tiles);
    for (const k of here) {
      if (!tiles.has(k)) tiles.set(k, fetch(`${base}bikes/${m.zoom}/${k}.json`).then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.features || []).catch(() => { tiles.delete(k); return []; }));
    }
    return { features: (await Promise.all(tiles.values())).flat(), covered: here.length > 0 };
  }
  return { load };
}
