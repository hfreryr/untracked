// Recherche sur le téléphone : fautes de frappe, notoriété, doublons, types de lieux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, searchIndex, editDistance } from '#lib/searchindex.js';
import { intentOf, nearestOf } from '#lib/searchintent.js';

const at = { lat: 48.8566, lon: 2.3522 };
// [nom, lon, lat, id, type, notoriété, autres noms, extra, adresse]
const idx = prepare({
  types: ['tourism=museum', 'shop=beauty', 'railway=station', 'amenity=parking', 'office=company', 'tourism=attraction'],
  streets: ['Rue du Faubourg Saint-Honoré'],
  items: [
    ['Élysée', 2.35, 48.857, 11, 1, 0],                                  // salon de massage tout près
    ['Palais de l\'Élysée', 2.3167, 48.8704, 21, 5, 62, '', '', '55|0|75008'],
    ['Grand Palais', 2.3126, 48.8662, 31, 0, 60],
    ['Grand Palais (bureaux)', 2.313, 48.866, 41, 4, 0],
    ['Musée d\'Orsay', 2.3268, 48.8601, 51, 0, 66],
    ['Tour Eiffel', 2.2945, 48.8583, 61, 5, 72],
    ['Parking Tour Eiffel', 2.296, 48.857, 71, 3, 0],
    ['Gare de Lyon', 2.3737, 48.8447, 81, 2, 58, 'Paris Gare de Lyon']
  ]
});
const top = (q) => searchIndex(idx, q, at, 3).map((r) => r.name);

test('distance d’édition (avec inversion de lettres)', () => {
  assert.equal(editDistance('eifel', 'eiffel'), 1);
  assert.equal(editDistance('palias', 'palais'), 1);
  assert.equal(editDistance('abc', 'xyz', 1), 2);
});
test('la notoriété l’emporte sur un homonyme tout proche', () => {
  assert.equal(top('élysée')[0], 'Palais de l\'Élysée');
  assert.equal(top('elysee')[0], 'Palais de l\'Élysée');
  assert.equal(top('grand palais')[0], 'Grand Palais');
});
test('fautes de frappe et élisions', () => {
  assert.equal(top('tour eifel')[0], 'Tour Eiffel');
  assert.equal(top('grnd palai')[0], 'Grand Palais');
  assert.equal(top('musee dorsay')[0], 'Musée d\'Orsay');
});
test('un lieu avant son parking', () => {
  assert.deepEqual(top('tour eiffel').slice(0, 2), ['Tour Eiffel', 'Parking Tour Eiffel']);
});
test('format des résultats : identifiant OSM, type, adresse', () => {
  const r = searchIndex(idx, 'palais elysee', at, 1)[0];
  assert.equal(r.id, 'N2'); assert.equal(r.osmType, 'node');
  assert.equal(r.address, '55 Rue du Faubourg Saint-Honoré, 75008');
  assert.equal(r.strong, true);
  assert.equal(searchIndex(idx, 'paris gare de lyon', at, 1)[0].name, 'Gare de Lyon');
});
test('types de lieux : « pharmacies », « restaurant italien », « vegan »', () => {
  const places = [
    { id: 1, lon: 2.353, lat: 48.857, tags: { amenity: 'pharmacy', name: 'Pharmacie A' } },
    { id: 2, lon: 2.36, lat: 48.86, tags: { amenity: 'restaurant', cuisine: 'italian;pizza' } },
    { id: 3, lon: 2.34, lat: 48.85, tags: { amenity: 'restaurant', 'diet:vegan': 'yes' } },
    { id: 4, lon: 2.352, lat: 48.8567, tags: { shop: 'beauty', name: 'Pharmacie des Musées' } }
  ];
  const ids = (q) => nearestOf(places, intentOf(q), at).map((p) => p.id);
  assert.deepEqual(ids('pharmacies'), [1]);
  assert.deepEqual(ids('restaurant italien'), [2]);
  assert.deepEqual(ids('vegan'), [3]);
  assert.deepEqual(ids('restaurant végétarien'), [3]);
  assert.equal(intentOf('grand palais'), null);
  assert.equal(intentOf('café de flore'), null);
});

// Lieu sans adresse : la rue la plus proche est affichée « près de … » (build_search.py, numéro « ~ »)
import { toResult } from '#lib/searchindex.js';
test('adresse devinée affichée « près de », vraie adresse inchangée', () => {
  const idx = prepare({ v: 1, types: ['shop=supermarket'], streets: ['Rue du Départ', 'Rue de Rennes'],
    items: [['Monoprix', 2.32, 48.84, 11, 0, 0, '', '', '~|0'], ['Monoprix', 2.33, 48.85, 21, 0, 0, '', '', '50|1|75006']] });
  assert.equal(toResult(idx, 0).address, 'près de Rue du Départ');
  assert.equal(toResult(idx, 1).address, '50 Rue de Rennes, 75006');
});
