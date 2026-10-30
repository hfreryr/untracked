import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bikeOptions, readBikeKind, saveBikeKind } from '#lib/bikekind.js';

test('vélo électrique : plus rapide, les côtes comptent peu ; vélo classique inchangé', () => {
  assert.deepEqual(bikeOptions('classic'), { bicycle_type: 'City', use_roads: 0.25 });
  const e = bikeOptions('electric');
  assert.equal(e.cycling_speed, 22);
  assert.ok(e.use_hills > 0.5);
});

test('choix gardé sur le téléphone ; valeur inconnue = vélo classique', () => {
  const m = new Map(), store = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  assert.equal(readBikeKind(store), 'classic');
  saveBikeKind('electric', store);
  assert.equal(readBikeKind(store), 'electric');
  m.set('velo-type', 'trottinette');
  assert.equal(readBikeKind(store), 'classic');
});
