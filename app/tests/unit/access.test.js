// Grands lieux : l'itinéraire vise l'accès le plus proche de l'autre bout (access.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessPoint, withAccess } from '../../src/lib/access.js';

// stade Maurice-Baquet : centre, et deux accès au bord de la rue d'Arcueil (build_places.py)
const stade = { label: 'Stade Maurice Baquet', lat: 48.81182, lon: 2.344, access: [[2.34314, 48.81167], [2.34435, 48.81246]] };
const barbes = { lat: 48.8826, lon: 2.3497 };
const sud = { lat: 48.80, lon: 2.343 };

test('l’accès le plus proche du départ : venant du nord, l’accès nord', () => {
  const p = accessPoint(stade, barbes);
  assert.deepEqual([p.lat, p.lon, p.label], [48.81246, 2.34435, 'Stade Maurice Baquet']);
  assert.deepEqual([accessPoint(stade, sud).lat, accessPoint(stade, sud).lon], [48.81167, 2.34314]);
});

test('sans accès connu, ou sans autre bout : le point lui-même', () => {
  assert.equal(accessPoint(barbes, stade), barbes);
  assert.equal(accessPoint({ ...stade, access: null }, barbes).lat, 48.81182);
  assert.equal(accessPoint(stade, null), stade);
});

test('accès déjà connus ou point sans lieu OSM : rien n’est relu', async () => {
  assert.equal(await withAccess(stade), stade);
  assert.equal(await withAccess(barbes), barbes);
  assert.equal(await withAccess(null), null);
  const lu = await withAccess({ lat: 1, lon: 2, osmType: 'way', osmId: 3 }, { access: [[2, 1]] });
  assert.deepEqual(lu.access, [[2, 1]]);
});
