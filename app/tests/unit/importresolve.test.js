// Retrouver un lieu importé dont on n'a que le nom (listes Google sans coordonnées).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pick, resolvePlace, eachLimited } from '#lib/importresolve.js';

const at = { lat: 48.8566, lon: 2.3522 };
const flore = { name: 'Café de Flore', lat: 48.854, lon: 2.3326 };

test('un seul lieu porte exactement ce nom : retenu sans réserve', () => {
  assert.deepEqual(pick('cafe de flore', [{ name: 'Flore en l’Île' }, flore]), { place: flore, sure: true });
});
test('plusieurs homonymes ou aucun nom exact : le premier, à vérifier', () => {
  assert.equal(pick('Franprix', [{ name: 'Franprix', lat: 1 }, { name: 'Franprix', lat: 2 }]).sure, false);
  assert.equal(pick('Chez Lulu', [{ name: 'Lulu bistrot' }]).sure, false);
  assert.equal(pick('X', []), null);
});
test('nos données d’abord : rien n’est envoyé si le nom est unique chez nous', async () => {
  let remote = 0;
  const r = await resolvePlace({ name: 'Café de Flore' }, at, { local: async () => [flore], remote: async () => { remote++; return []; } });
  assert.equal(r.place, flore);
  assert.equal(remote, 0);
});
test('absent de nos données (lieu hors de Paris) : le moteur de recherche, sans limite de zone', async () => {
  const lyon = { name: 'Les Halles de Lyon Paul Bocuse', lat: 45.76, lon: 4.85 };
  const r = await resolvePlace({ name: lyon.name }, at, { local: async () => [], remote: async () => [lyon] });
  assert.deepEqual(r, { place: lyon, sure: true });
});
test('quelques recherches à la fois, toutes faites', async () => {
  let live = 0, max = 0;
  const seen = [];
  await eachLimited([1, 2, 3, 4, 5, 6, 7], 3, async (x) => { live++; max = Math.max(max, live); await new Promise((r) => setTimeout(r, 5)); seen.push(x); live--; });
  assert.equal(seen.length, 7);
  assert.equal(max, 3);
});

// Bug du 20/10 : un lieu Google avec position doit retrouver son identifiant OSM, sinon sa fiche ignore ses listes
import { snapToOsm } from '#lib/importresolve.js';
test('lieu Google avec position : identifiant OSM retrouvé dans nos données (même nom, tout près)', async () => {
  const local = async () => [
    { name: 'Café de Flore', lat: 48.8542, lon: 2.3327, osmType: 'node', osmId: 7 },
    { name: 'Café de Flore', lat: 48.8700, lon: 2.3327, osmType: 'node', osmId: 8 }
  ];
  assert.equal((await snapToOsm({ name: 'Café de Flore', lat: 48.8541, lon: 2.3326 }, { local }))?.osmId, 7);
  assert.equal(await snapToOsm({ name: 'Autre café', lat: 48.8541, lon: 2.3326 }, { local }), null);
});
