// Angles arrondis du tracé : courbe douce, extrémités intactes, écart au coin de quelques mètres seulement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundCorners } from '../../src/lib/roundline.js';

const M = 111320, k = Math.cos((48.85 * Math.PI) / 180);
const pt = (x, y) => [2.35 + x / (M * k), 48.85 + y / M];      // mètres → [lon, lat]
const dist = (p, q) => Math.hypot((p[0] - q[0]) * M * k, (p[1] - q[1]) * M);

test('un virage à angle droit devient une petite courbe, les extrémités restent', () => {
  const l = [pt(0, 0), pt(0, 50), pt(50, 50)];
  const r = roundCorners(l);
  assert.ok(r.length > 3);
  assert.deepEqual(r[0], l[0]);
  assert.deepEqual(r.at(-1), l.at(-1));
  // le point le plus proche du coin en reste à ~3,5 m : le tracé ne quitte pas la rue
  const gap = Math.min(...r.map((p) => dist(p, l[1])));
  assert.ok(gap > 2 && gap < 4.5, `écart ${gap}`);
});

test('ligne droite et tronçons très courts : presque rien ne change', () => {
  const straight = [pt(0, 0), pt(0, 50), pt(1, 100)];
  assert.ok(roundCorners(straight).length <= 3);
  // crochet de 1 m sur une ligne de 60 m : effacé (invisible sur le terrain)
  const jog = [pt(0, 0), pt(0, 30), pt(1, 30), pt(1, 60)];
  assert.ok(roundCorners(jog).length <= 3);
  assert.equal(roundCorners([pt(0, 0), pt(1, 1)]).length, 2);
});
