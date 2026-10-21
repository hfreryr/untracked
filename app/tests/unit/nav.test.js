// Guidage : reste du tracé à parcourir (le tronçon fait disparaît de la carte).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, remaining } from '#lib/nav.js';

// trajet droit vers l'est, 3 points espacés d'environ 76 m (0,001° de longitude à Paris)
const nav = prepare([[2.340, 48.85], [2.341, 48.85], [2.342, 48.85]], [], 120);

test('au départ : tout le tracé', () => assert.deepEqual(remaining(nav, 0), nav.coords));

test('à mi-chemin du 1er tronçon : commence au point interpolé', () => {
  const r = remaining(nav, nav.cum[1] / 2);
  assert.equal(r.length, 3);
  assert.ok(Math.abs(r[0][0] - 2.3405) < 1e-6 && r[0][1] === 48.85);
  assert.deepEqual(r.slice(1), nav.coords.slice(1));
});

test('dans le 2e tronçon, puis au bout', () => {
  const r = remaining(nav, nav.cum[1] + 10);
  assert.equal(r.length, 2);
  assert.ok(r[0][0] > 2.341 && r[0][0] < 2.342);
  assert.deepEqual(remaining(nav, nav.total + 50), [nav.coords[2], nav.coords[2]]);
});

// ——— Guidage fluide et barre du bas (navglide.js) ———
import { lerpAngle, glideMs, etaParts } from '../../src/lib/navglide.js';

test('la flèche tourne par le plus court chemin (350° → 10° passe par 0°)', () => {
  assert.equal(Math.round(lerpAngle(350, 10, 0.5)), 0);
  assert.equal(Math.round(lerpAngle(10, 350, 0.5)), 0);
  assert.equal(Math.round(lerpAngle(0, 90, 0.5)), 45);
  assert.equal(Math.round(lerpAngle(90, 90, 0.3)), 90);
});

test('glissement : le temps entre deux positions, borné entre 0,3 et 2 s', () => {
  assert.equal(glideMs(1000), 1000);
  assert.equal(glideMs(50), 300);
  assert.equal(glideMs(9000), 2000);
  assert.equal(glideMs(0), 1000);
});

test('barre du bas : minutes puis heures, mètres puis kilomètres', () => {
  assert.deepEqual(etaParts(14 * 60, 1100), [{ v: '14', u: 'min' }, { v: '1,1', u: 'km' }]);
  assert.deepEqual(etaParts(75 * 60, 640), [{ v: '1:15', u: 'h' }, { v: '640', u: 'm' }]);
  assert.deepEqual(etaParts(10, 3), [{ v: '1', u: 'min' }, { v: '10', u: 'm' }]);
});
