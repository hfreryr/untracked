// Points de contribution (points.js, maquette du 04/11/2026)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POINTS, editPoints, editsPoints, pointsOf, tally, isOnSite, DAILY_CAP } from '../../src/lib/points.js';
import { badgeProgress } from '../../src/lib/badges.js';

const DAY = 86400;
test('barème : avis 1, signalement 2, correction 3, horaires 5 ; doublés sur place', () => {
  assert.deepEqual(POINTS, { avis: 1, signalement: 2, corrections: 3, horaires: 5 });
  assert.equal(editPoints({ kind: 'horaires', near: true }), 10);
  assert.equal(editPoints({ kind: 'corrections' }), 3);
  assert.equal(editPoints({ kind: 'inconnu' }), 0);
  assert.equal(pointsOf([{}, {}], [{ kind: 'signalement', t: 0 }, { kind: 'horaires', t: 0, near: true }]), 2 + 2 + 10);
});

test('plafond discret : au plus 20 modifications comptées par jour', () => {
  const many = Array.from({ length: 30 }, () => ({ kind: 'corrections', t: 5 * DAY + 10 }));
  assert.equal(editsPoints(many), DAILY_CAP * 3);
  assert.equal(editsPoints([...many, { kind: 'corrections', t: 6 * DAY }]), DAILY_CAP * 3 + 3);   // le lendemain compte
});

test('avis seulement : même total qu\'avant (niveaux inchangés) ; détail par genre', () => {
  assert.equal(pointsOf(new Array(20).fill({}), []), 20);
  assert.deepEqual(tally([{}], [{ kind: 'corrections' }, { kind: 'horaires' }, { kind: 'horaires' }, { kind: 'signalement' }]),
    { avis: 1, corrections: 1, horaires: 2, signalements: 1 });
});

test('sur place : à moins de 100 m ; position inconnue : non', () => {
  const place = { lat: 48.85, lon: 2.35 };
  assert.ok(isOnSite({ lat: 48.8505, lon: 2.35 }, place));        // ~56 m
  assert.ok(!isOnSite({ lat: 48.852, lon: 2.35 }, place));        // ~220 m
  assert.ok(!isOnSite(null, place));
});

test('badges des corrections : horaires, signalements, lieux différents corrigés', () => {
  const ed = [...Array(10).fill(0).map((_, i) => ({ kind: 'horaires', ref: `node/${i}` })), { kind: 'signalement', ref: 'node/1' }];
  const b = Object.fromEntries(badgeProgress([], ed).map((x) => [x.id, x]));
  assert.ok(b.gardien.done);
  assert.equal(b.sentinelle.n, 1);
  assert.equal(b.cartographe.n, 10);
  assert.ok(b.cartographe.done);
});
