// Filtres des listes de lieux (décision du 21/10) : on ne cache pas les lieux sans information, on les met à part.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableFilters, splitByFilters } from '#lib/filters.js';

const cafe = (t) => ({ sub: 'cafe', t });
test('filtres proposés : seulement ceux qui servent', () => {
  assert.deepEqual(availableFilters([cafe({ outdoor_seating: 'yes' }), cafe({})]), ['terrasse']);
  // des banques : pas de terrasse ni de végétarien, même si une étiquette traîne
  assert.deepEqual(availableFilters([{ sub: 'bank', t: { wheelchair: 'yes', outdoor_seating: 'no' } }]), ['fauteuil']);
  assert.deepEqual(availableFilters([{ sub: 'bank', t: {} }]), []);
  assert.deepEqual(availableFilters([cafe({ 'diet:vegan': 'only', takeaway: 'yes', wheelchair: 'no' })]), ['vegetarien', 'emporter', 'fauteuil']);
});

test('lieux triés : oui / non / sans information', () => {
  const a = cafe({ outdoor_seating: 'yes' }), b = cafe({ outdoor_seating: 'no' }), c = cafe({}), d = { sub: 'cafe', t: null };
  const r = splitByFilters([a, b, c, d], ['terrasse']);
  assert.deepEqual(r.match, [a]);
  assert.deepEqual(r.unknown, [c, d]);
  assert.equal(r.out, 1);
});

test('plusieurs filtres et « ouvert » se combinent ; un « non » suffit à écarter', () => {
  const a = { ...cafe({ outdoor_seating: 'yes', 'diet:vegetarian': 'yes' }), st: { open: true } };
  const b = { ...cafe({ outdoor_seating: 'yes', 'diet:vegetarian': 'yes' }), st: { open: false } };
  const c = { ...cafe({ outdoor_seating: 'yes' }), st: { open: true } };
  const r = splitByFilters([a, b, c], ['terrasse', 'vegetarien'], true);
  assert.deepEqual(r.match, [a]);
  assert.deepEqual(r.unknown, [c]);
  assert.equal(r.out, 1);
});

test('fauteuil roulant : « limité » ne compte pas comme accessible', () => {
  const r = splitByFilters([{ sub: 'bank', t: { wheelchair: 'limited' } }], ['fauteuil']);
  assert.equal(r.out, 1);
});
