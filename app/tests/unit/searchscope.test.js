import { test } from 'node:test';
import assert from 'node:assert/strict';
import { covered, inFrance } from '#lib/searchscope.js';

test('zone couverte : Île-de-France oui, Lyon et Amsterdam non', () => {
  assert.equal(covered({ lat: 48.8566, lon: 2.347 }), true);
  assert.equal(covered({ lat: 45.76, lon: 4.835 }), false);
  assert.equal(covered({ lat: 52.37, lon: 4.89 }), false);
  assert.equal(covered(null), false);
});

test('géocodeur d’adresses de l’État : France seulement', () => {
  assert.equal(inFrance({ lat: 45.76, lon: 4.835 }), true);
  assert.equal(inFrance({ lat: 43.7, lon: 7.27 }), true);      // Nice
  assert.equal(inFrance({ lat: 52.37, lon: 4.89 }), false);    // Amsterdam
});

test('« RER » seulement en Île-de-France ; ailleurs, un train (P8 à Amsterdam)', async () => {
  const { modeHere } = await import('#lib/routing.js');
  assert.equal(modeHere('SUBURBAN', { lat: 48.85, lon: 2.35 }), 'SUBURBAN');
  assert.equal(modeHere('REGIONAL_RAIL', { lat: 52.37, lon: 4.9 }), 'RAIL');
  assert.equal(modeHere('TRAM', { lat: 52.37, lon: 4.9 }), 'TRAM');
});

test('adresse dans l’ordre du pays : « 4 rue X » en France, « Amstelzijde 4 » aux Pays-Bas', async () => {
  const { streetLine } = await import('#lib/searchscope.js');
  const t = { 'addr:housenumber': '4', 'addr:street': 'Amstelzijde' };
  assert.equal(streetLine(t, { lat: 52.296, lon: 4.899 }), 'Amstelzijde 4');
  assert.equal(streetLine({ 'addr:housenumber': '4', 'addr:street': 'Rue Gentil' }, { lat: 45.76, lon: 4.835 }), '4 Rue Gentil');
  assert.equal(streetLine({ 'addr:housenumber': '4', 'addr:street': 'Rue X' }, null), '4 Rue X');
});
