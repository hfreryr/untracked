// Là où une zone a vraiment des lieux (placestore.coverRects) : rangées de carrés de zoom 13 → rectangles (06/11/2026)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverRects } from '../../src/lib/placestore.js';

test('rangées de carrés habités → rectangles ; index ancien : null', () => {
  const r = coverRects({ cover: { z: 13, rows: [[2867, 4237, 4239]] } });   // Genève et alentours
  assert.equal(r.length, 1);
  const [w, s, e, n] = r[0];
  assert.ok(w < e && s < n);
  assert.ok(Math.abs((e - w) - 3 * 360 / 2 ** 13) < 1e-9);                  // trois carrés de large
  assert.equal(coverRects({ tiles: [] }), null);
  assert.equal(coverRects(null), null);
});
