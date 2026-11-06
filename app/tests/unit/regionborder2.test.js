// Bordure entre deux régions (06/11/2026) : à Jonzac (Charente-Maritime), le cadre de l'Aquitaine touche le carré et son
// grand fichier de campagne le couvre, mais ce carré y est vide ; ses lieux sont dans Poitou-Charentes. Le carré ne
// doit pas être écarté à cause de la première source regardée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

const lon = -0.434, lat = 45.446;   // Jonzac
test('carré vide dans une région voisine, plein dans la sienne : ses lieux sont affichés', async () => {
  globalThis.location = { href: 'https://exemple.test/' };
  const { tileXY } = await import('#lib/placestore.js');
  const [x, y] = tileXY(lon, lat, 14);
  const gz = (t) => new Uint8Array(gzipSync(JSON.stringify({ v: 1, t }))).buffer;
  const big = `10/${x >> 4}/${y >> 4}`;
  const files = {
    'https://exemple.test/data/places/index.json': { v: 2, zooms: [14], tiles: [] },
    'https://exemple.test/data/zones/aquitaine/places/index.json': { v: 2, zooms: [10], tiles: [big] },
    'https://exemple.test/data/zones/poitou-charentes/places/index.json': { v: 2, zooms: [14], tiles: [`14/${x}/${y}`] },
    // l'Aquitaine : un lieu en Gironde, dans le même grand carré, mais pas dans celui de Jonzac
    [`https://exemple.test/data/zones/aquitaine/places/${big}.json.gz`]: gz([[12, lon + 0.2, lat - 0.15, { name: 'Gironde' }]]),
    [`https://exemple.test/data/zones/poitou-charentes/places/14/${x}/${y}.json.gz`]: gz([[22, lon, lat, { name: 'Jonzac' }]]),
  };
  globalThis.fetch = async (u) => {
    const v = files[u];
    if (!v) return { ok: false };
    return v instanceof ArrayBuffer ? { ok: true, arrayBuffer: async () => v } : { ok: true, json: async () => v };
  };
  const { placesInBounds } = await import('#lib/placestore.js');
  const got = await placesInBounds({ west: lon - 0.001, south: lat - 0.001, east: lon + 0.001, north: lat + 0.001 });
  assert.deepEqual(got.map((p) => p.tags.name), ['Jonzac']);
});
