import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelOf, unlockedArrows, readArrow, saveArrow, withArrival, dueAsk, asked, setIntent, takeIntent } from '#lib/contrib.js';
import { emptyReviewer, withMine } from '#lib/reviewer.js';

test('niveaux : Éclaireur 1, Passeur 5, Vigie 20, Phare 50', () => {
  assert.equal(levelOf(0).level, null);
  assert.equal(levelOf(0).next.id, 'eclaireur');
  assert.equal(levelOf(1).level.id, 'eclaireur');
  assert.deepEqual([levelOf(12).level.id, levelOf(12).next.id, levelOf(12).remaining], ['passeur', 'vigie', 8]);
  assert.equal(levelOf(60).level.id, 'phare');
  assert.equal(levelOf(60).next, null);
  assert.deepEqual(unlockedArrows(5), ['classique', 'eclaireur', 'passeur']);
});

test('flèche choisie : gardée, mais seulement si débloquée', () => {
  const m = new Map(), store = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  saveArrow('vigie', store);
  assert.equal(readArrow(25, store), 'vigie');
  assert.equal(readArrow(3, store), 'classique');
});

test('« Comment était X ? » : une fois, entre 1 h et 2 jours, jamais si déjà noté', () => {
  const place = { osmType: 'node', osmId: 1, name: 'Café', lat: 48.8, lon: 2.3 };
  const t0 = Date.UTC(2026, 9, 30, 18);
  let asks = withArrival([], place, t0);
  asks = withArrival(asks, place, t0 + 5000);                      // pas deux fois le même lieu
  assert.equal(asks.length, 1);
  const r = emptyReviewer();
  assert.equal(dueAsk(asks, r, t0 + 30 * 60e3), null);            // trop tôt
  assert.equal(dueAsk(asks, r, t0 + 2 * 3600e3).name, 'Café');
  assert.equal(dueAsk(asks, r, t0 + 50 * 3600e3), null);          // trop tard
  assert.equal(dueAsk(asked(asks, 'node/1'), r, t0 + 2 * 3600e3), null);
  const noted = withMine(r, { id: 'node/1', stars: 4, t: 1 });
  assert.equal(dueAsk(asks, noted, t0 + 2 * 3600e3), null);
  assert.equal(withArrival([], { lat: 1, lon: 2 }).length, 0);       // une adresse, pas un lieu : rien
});

test('note touchée sur la carte : reprise une seule fois par la fiche du bon lieu', () => {
  setIntent('node/1', 4);
  assert.equal(takeIntent('node/2'), null);
  assert.equal(takeIntent('node/1').stars, 4);
  assert.equal(takeIntent('node/1'), null);
});
