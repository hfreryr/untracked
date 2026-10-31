// Bordure entre deux jeux de tuiles (Île-de-France et une région voisine, ou deux régions) : un même carré peut être
// dans les deux ; ses lieux sont réunis, sans doublon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

const lon = -1.68, lat = 48.11;   // Rennes (cadre de la Bretagne)
test('carré présent dans deux jeux de tuiles : lieux réunis, sans doublon', async () => {
  globalThis.location = { href: 'https://exemple.test/' };
  const { tileXY } = await import('#lib/placestore.js');
  const [x, y] = tileXY(lon, lat, 14);
  const gz = (t) => new Uint8Array(gzipSync(JSON.stringify({ v: 1, t }))).buffer;
  const a = [[11, lon, lat, { name: 'Commun' }], [21, lon, lat, { name: 'Seulement IDF' }]];
  const b = [[11, lon, lat, { name: 'Commun' }], [31, lon, lat, { name: 'Seulement Bretagne' }]];
  const files = {
    'https://exemple.test/data/places/index.json': { v: 2, zooms: [14], tiles: [`14/${x}/${y}`] },
    'https://exemple.test/data/zones/bretagne/places/index.json': { v: 2, zooms: [14], tiles: [`14/${x}/${y}`] },
    [`https://exemple.test/data/places/14/${x}/${y}.json.gz`]: gz(a),
    [`https://exemple.test/data/zones/bretagne/places/14/${x}/${y}.json.gz`]: gz(b),
  };
  globalThis.fetch = async (u) => {
    const v = files[u];
    if (!v) return { ok: false };
    return v instanceof ArrayBuffer ? { ok: true, arrayBuffer: async () => v } : { ok: true, json: async () => v };
  };
  const { placesInBounds } = await import('#lib/placestore.js');
  const got = await placesInBounds({ west: lon - 0.001, south: lat - 0.001, east: lon + 0.001, north: lat + 0.001 });
  assert.deepEqual(got.map((p) => p.id).sort(), [11, 21, 31]);
});
