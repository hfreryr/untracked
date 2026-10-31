import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glanceItems, isNear, meters } from '#lib/glance.js';

const place = { lat: 48.8500, lon: 2.3400 };
test('infos clés : horaires coupés en état + détail, note seulement à partir de 3 avis, distance', () => {
  const g = glanceItems({ status: { open: false, label: 'Fermé · ouvre lundi à 8 h 30' }, reviews: { count: 4, average: 4.3, showAverage: true },
    me: { lat: 48.8509, lon: 2.3400 }, place, info: { wheelchair: 'yes', fee: 'no' } });
  assert.deepEqual(g.map((x) => x.key), ['hours', 'rating', 'distance', 'wheelchair']);   // 4 au plus
  assert.equal(g[0].value, 'Fermé'); assert.equal(g[0].sub, 'ouvre lundi à\u00a08\u00a0h\u00a030'); assert.equal(g[0].tone, 'closed');
  assert.equal(g[1].value, '★ 4,3'); assert.equal(g[1].label, '4 avis');
  assert.match(g[2].value, /100 m/);
  const few = glanceItems({ status: { open: true, label: 'Ouvert' }, reviews: { count: 2, average: 5, showAverage: false }, place, info: {} });
  assert.deepEqual(few.map((x) => [x.key, x.value, x.sub]), [['hours', 'Ouvert', undefined]]);
  assert.equal(glanceItems({ status: { open: null, label: 'Horaires incertains' }, place })[0].value, 'Incertains');
});

test('« Vous êtes à proximité » : à moins de 100 m', () => {
  assert.ok(isNear({ lat: 48.8508, lon: 2.3400 }, place));        // ≈ 90 m
  assert.ok(!isNear({ lat: 48.8510, lon: 2.3400 }, place));       // ≈ 110 m
  assert.ok(!isNear(null, place));
  assert.ok(Math.abs(meters({ lat: 48.85, lon: 2.34 }, { lat: 48.86, lon: 2.34 }) - 1112) < 5);
});
