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
  assert.equal(pick('Franprix', [{ name: 'Franprix', lat: 1, lon: 2 }, { name: 'Franprix', lat: 2, lon: 2 }]).sure, false);
  // même nom, à quelques dizaines de mètres (bâtiment et musée) : même lieu, retenu sans réserve
  assert.equal(pick('Es Baluard', [{ name: 'Es Baluard', lat: 39.5703, lon: 2.6409 }, { name: 'Es Baluard', lat: 39.5705, lon: 2.6412 }]).sure, true);
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
  assert.deepEqual(r, { place: lyon, sure: true, remote: true });
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

// Bug du 31/10 : 5 lieux sur 137 importés — Photon refusait la moitié des demandes envoyées 4 par 4
import { eachPaced } from '#lib/importresolve.js';
import { searchForImport } from '#lib/geocode.js';
test('moteur de recherche indisponible : erreur remontée (lieu gardé pour « Réessayer »), pas « introuvable »', async () => {
  await assert.rejects(resolvePlace({ name: 'Es Baluard' }, at, { local: async () => [], remote: async () => { throw new Error('Photon 503'); } }));
});
test('import : un lieu par seconde au plus', async () => {
  let t = 0; const starts = []; const waits = [];
  await eachPaced([1, 2, 3], 1000, async () => { starts.push(t); t += 200; }, () => t, async (ms) => { waits.push(ms); t += ms; });
  assert.deepEqual(starts, [0, 1000, 2000]);
  assert.deepEqual(waits, [800, 800]);
});
test('import : Photon refuse puis répond — nouvel essai après 2 s, 4 s', async () => {
  let n = 0; const waits = [];
  const r = await searchForImport('Es Baluard', at, { call: async () => { if (++n < 3) throw new Error('Photon 503'); return [{ name: 'Es Baluard' }]; }, wait: async (ms) => waits.push(ms) });
  assert.equal(r[0].name, 'Es Baluard');
  assert.deepEqual(waits, [2000, 4000]);
  n = 0;
  await assert.rejects(searchForImport('X', at, { tries: 2, call: async () => { throw new Error('503'); }, wait: async () => {} }));
});

test('import : l’annuaire national avant Photon ; l’adresse par le géocodeur de l’État', async () => {
  const at = { lat: 48.85, lon: 2.35 };
  let remote = 0;
  const gordes = { name: 'Gordes', lat: 43.91, lon: 5.2, osmType: 'relation', osmId: 1 };
  const r = await resolvePlace({ name: 'Gordes' }, at, { local: async () => [], directory: async () => [gordes], remote: async () => { remote++; return []; } });
  assert.equal(r.place, gordes); assert.equal(r.sure, true); assert.equal(remote, 0);
  // adresse : position du géocodeur, et le lieu OSM du même nom s'il est tout près
  const cafe = { name: 'Le Pick-Clops', lat: 48.8571, lon: 2.3555, osmType: 'node', osmId: 7 };
  const a = await resolvePlace({ name: 'Le Pick-Clops', address: '16 Rue Vieille du Temple, 75004 Paris' }, at,
    { local: async () => [cafe], address: async () => ({ lat: 48.8572, lon: 2.3556 }), remote: async () => { remote++; return []; } });
  assert.equal(a.place, cafe); assert.equal(remote, 0);
  const b = await resolvePlace({ name: 'Chez Moi', address: '3 rue X, 35000 Rennes' }, at,
    { local: async () => [], address: async () => ({ lat: 48.11, lon: -1.68 }), remote: async () => { remote++; return []; } });
  assert.equal(b.place.lat, 48.11); assert.equal(b.sure, true); assert.equal(remote, 0);
  // rien chez nous : Photon, marqué comme tel (l'import attend alors ≈ 1 s avant le suivant)
  const c = await resolvePlace({ name: 'Es Baluard' }, at, { local: async () => [], directory: async () => [], remote: async () => [{ name: 'Es Baluard', lat: 39.57, lon: 2.64 }] });
  assert.equal(c.remote, true);
});

test('import : pas d’attente quand le lieu a été trouvé dans nos données', async () => {
  let t = 0; const waits = [];
  await eachPaced([1, 2, 3], 1000, async (i) => { t += 10; return i === 2; }, () => t, async (ms) => { waits.push(ms); t += ms; });
  assert.deepEqual(waits, [990]);
});

test('lieu à l’étranger placé par sa position : sa fiche OSM retrouvée par son nom, tout près seulement', async () => {
  const { linkByName } = await import('#lib/importresolve.js');
  const p = { name: 'Es Baluard', lat: 39.5707, lon: 2.642 };
  const ok = await linkByName(p, async () => [{ name: 'Es Baluard', lat: 39.5708, lon: 2.6421, osmType: 'way', osmId: 9 }]);
  assert.equal(ok.osmId, 9);
  assert.equal(await linkByName(p, async () => [{ name: 'Es Baluard', lat: 41.4, lon: 2.1, osmType: 'way', osmId: 8 }]), null);   // homonyme lointain
});
