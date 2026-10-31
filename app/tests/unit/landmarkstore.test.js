// Lieux mis en avant chargés par carré de chaque zone (landmarkstore.js) : seulement les carrés à l'écran,
// sans doublon à la bordure de deux zones, avec un identifiant unique pour masquer le lieu choisi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

test('carrés à l’écran seulement, bordure sans doublon, identifiant OSM unique', async () => {
  globalThis.location = { href: 'https://exemple.test/' };
  const { tileXY } = await import('#lib/placestore.js');
  const [x, y] = tileXY(-1.68, 48.11, 10);
  const gz = (rows) => new Uint8Array(gzipSync(JSON.stringify(rows))).buffer;
  const row = (osm, name) => [-1.68, 48.11, name, 'food', 'restaurant', 15, 1, osm];
  const asked = [];
  const files = {
    'https://exemple.test/data/places/landmarks/index.json': { v: 1, zoom: 10, tiles: [] },
    'https://exemple.test/data/zones/bretagne/places/landmarks/index.json': { v: 1, zoom: 10, tiles: [`10/${x}/${y}`, '10/1/1'] },
    'https://exemple.test/data/zones/pays-de-la-loire/places/landmarks/index.json': { v: 1, zoom: 10, tiles: [`10/${x}/${y}`] },
    [`https://exemple.test/data/zones/bretagne/places/landmarks/10/${x}/${y}.json.gz`]: gz([row('node/5', 'Crêperie'), row('way/7', 'Halles')]),
    [`https://exemple.test/data/zones/pays-de-la-loire/places/landmarks/10/${x}/${y}.json.gz`]: gz([row('node/5', 'Crêperie')]),
  };
  globalThis.fetch = async (u) => {
    asked.push(u);
    const v = files[u];
    if (!v) return { ok: false };
    return v instanceof ArrayBuffer ? { ok: true, arrayBuffer: async () => v } : { ok: true, json: async () => v };
  };
  const { landmarksIn } = await import('#lib/landmarkstore.js');
  const got = await landmarksIn({ west: -1.70, south: 48.10, east: -1.66, north: 48.12 });
  assert.deepEqual(got.map((f) => f.properties.name).sort(), ['Crêperie', 'Halles']);
  assert.deepEqual(got.map((f) => f.id).sort((a, b) => a - b), [51, 72]);
  assert.ok(!asked.some((u) => u.includes('10/1/1')), 'carré hors de l’écran téléchargé');
});
