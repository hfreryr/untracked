import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keysFor, keysForWord } from '#lib/directory.js';

const keys = { go: 400, pa: 1300, papes: 20, chat: 30, chateau: 9000, chatel: 40, saint: 6600, mal: 300, ro: 900 };

test('annuaire : le fichier du début de mot, et ceux qui le prolongent pendant la frappe', () => {
  assert.deepEqual(keysForWord('gordes', keys).keys, ['go']);
  assert.deepEqual(keysForWord('papes', keys).keys, ['papes']);
  assert.deepEqual(keysForWord('chat', keys).keys.sort(), ['chat', 'chateau', 'chatel']);
  assert.deepEqual(keysForWord('xyz', keys).keys, []);
  assert.deepEqual(keysForWord('chat', keys, false).keys, ['chat']);      // mot complet (suivi d'un autre)
});

test('annuaire : les deux mots les plus rares, rien sous 3 lettres ni pour les petits mots', () => {
  assert.deepEqual(keysFor('palais des papes', keys), ['papes', 'pa']);
  assert.deepEqual(keysFor('saint malo', keys), ['mal', 'saint']);
  assert.deepEqual(keysFor('chat noir', { ...keys, no: 50 }), ['chat', 'no']);
  assert.deepEqual(keysFor('go', keys), []);
  assert.deepEqual(keysFor('de la', keys), []);
});

test('annuaire : un lieu lointain trouvé avec une faute de frappe ne passe pas devant Photon', async () => {
  const { prepare, searchIndex } = await import('#lib/searchindex.js');
  const raw = { types: ['amenity=place_of_worship', 'place=village'], streets: [], items: [
    ['Cathédrale Notre-Dame-du-Puy', 3.88, 45.04, 11, 0, 50], ['Gordes', 5.2, 43.91, 21, 1, 40]] };
  const at = { lat: 48.85, lon: 2.35 };
  const strict = { ...prepare(raw), strict: true };
  assert.equal(searchIndex(strict, 'puy de dome', at)[0].strong, false);     // « dome » ≈ « dame »
  assert.equal(searchIndex(prepare(raw), 'puy de dome', at)[0].strong, true);  // index de sa région : inchangé
  assert.equal(searchIndex(strict, 'gordes', at)[0].strong, true);
  assert.equal(searchIndex(strict, 'gord', at)[0].strong, true);             // en cours de frappe
  const archives = { ...prepare({ types: ['office=government'], streets: [], items: [['Archives départementales du Puy-de-Dôme', 3.1, 45.8, 31, 0, 30]] }), strict: true };
  assert.equal(searchIndex(archives, 'puy de dome', at)[0].strong, false);   // la moitié du nom seulement
});
