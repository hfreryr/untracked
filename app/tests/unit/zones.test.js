// Données découpées par zone : quelles tuiles charger autour de l'utilisateur ou de la vue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileOf, zonesAround } from '../../src/lib/searchzones.js';
import { tilesIn } from '../../src/lib/biketiles.js';

test('tuile de zoom 11 : Notre-Dame de Paris', () => {
  assert.deepEqual(tileOf(2.3499, 48.853, 11), [1037, 704]);
});

test('recherche : la zone de l’utilisateur et ses voisines à moins de 4 km, seulement celles qui existent', () => {
  const avail = ['2074/1408', '2074/1409', '2075/1408', '2075/1409', '2080/1400'];
  const z = zonesAround({ lat: 48.853, lon: 2.3499 }, 12, avail);
  assert.ok(z.includes('2074/1409'));
  assert.ok(!z.includes('2080/1400'));
  assert.ok(z.every((k) => avail.includes(k)));
});

test('carte vélo : les tuiles qui touchent la vue', () => {
  const avail = ['1037/704', '1038/704', '1040/710'];
  assert.deepEqual(tilesIn({ west: 2.33, south: 48.84, east: 2.36, north: 48.86 }, 11, avail), ['1037/704']);
});
