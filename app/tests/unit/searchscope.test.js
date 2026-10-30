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
