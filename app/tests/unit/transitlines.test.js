import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLines, loadTransitLines } from '#lib/transitlines.js';

const fc = (...refs) => ({ type: 'FeatureCollection', features: refs.map((ref) => ({ type: 'Feature', properties: { ref } })) });

test('les lignes d’Île-de-France et des grandes villes sont réunies', () => {
  assert.deepEqual(mergeLines([fc('1', 'A'), fc('T1')]).features.map((f) => f.properties.ref), ['1', 'A', 'T1']);
});

test('un fichier manquant n’empêche pas l’autre', async () => {
  const get = async (url) => (url.endsWith('transit-cities.geojson') ? { ok: false } : { ok: true, json: async () => fc('14') });
  const d = await loadTransitLines('https://exemple.org/', get);
  assert.deepEqual(d.features.map((f) => f.properties.ref), ['14']);
  const bad = await loadTransitLines('https://exemple.org/', async () => { throw new Error('hors ligne'); });
  assert.equal(bad.features.length, 0);
});
