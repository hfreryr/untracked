import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewsOf, starsText } from '#lib/reviews.js';

test('avis lus dans les étiquettes, notes sur 5', () => {
  const r = reviewsOf({ _rev: { n: 4, a: 85, l: [[100, 'Top', 'Armavica', 1767225600, 'sig', 0], [20, '', '', 1767225600, 's2', 1]] } });
  assert.equal(r.count, 4);
  assert.equal(r.average, 4.3);
  assert.equal(r.showAverage, true);
  assert.deepEqual(r.latest.map((x) => x.stars), [5, 1]);
  assert.equal(r.latest[0].nick, 'Armavica');
  assert.equal(r.latest[1].photos, 1);
  assert.equal(r.latest[0].date.getUTCFullYear(), 2026);
});

test('note affichée dès le premier avis (comme Google) ; classement seulement à partir de 3 avis ; rien sans avis', () => {
  const one = reviewsOf({ _rev: { n: 1, a: 100, l: [] } });
  assert.equal(one.showAverage, true); assert.equal(one.average, 5); assert.equal(one.rankable, false);
  assert.equal(reviewsOf({ _rev: { n: 3, a: 80, l: [] } }).rankable, true);
  assert.equal(reviewsOf({}), null);
  assert.equal(starsText(4), '★★★★☆');
});
