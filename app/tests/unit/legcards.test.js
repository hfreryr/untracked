// Découpage d'un trajet en cartes d'étapes (fiche itinéraire en transport).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legCards, nextDepartures } from '../../src/lib/legcards.js';

const walk = (from, to, duration = 240) => ({ mode: 'WALK', from, to, duration });
const ride = (from, to, line) => ({ mode: 'SUBWAY', from, to, line, duration: 600 });

test('marche, métro, marche : marcher jusqu’à la station, prendre la ligne, descendre, marcher jusqu’à l’arrivée', () => {
  const cards = legCards([walk('Départ', 'Odéon'), ride('Odéon', 'Gare du Nord', '4'), walk('Gare du Nord', 'Arrivée', 180)], 'Paris Gare du Nord');
  assert.deepEqual(cards.map((c) => c.kind), ['walk', 'ride', 'off', 'walk']);
  assert.equal(cards[0].target, 'Odéon');
  assert.equal(cards[0].toRide, true);
  assert.equal(cards[0].transfer, false);
  assert.equal(cards[1].first, true);
  assert.equal(cards[3].final, true);
  assert.equal(cards[3].target, 'Paris Gare du Nord');
});

test('correspondance à pied entre deux lignes ; quelques secondes sur le même quai : pas d’étape', () => {
  const cards = legCards([ride('Odéon', 'Châtelet', '4'), walk('Châtelet', 'Châtelet', 200), ride('Châtelet', 'Gare de Lyon', 'A'),
    walk('Gare de Lyon', 'Gare de Lyon', 10), ride('Gare de Lyon', 'Bercy', '14')], 'Bercy');
  assert.deepEqual(cards.map((c) => c.kind), ['ride', 'off', 'walk', 'ride', 'off', 'ride', 'off']);
  assert.equal(cards[2].transfer, true);
  assert.equal(cards[3].first, false);
});

test('prochains passages : en minutes, sans les passages déjà partis ni ceux de plus d’une heure', () => {
  const now = Date.UTC(2026, 9, 21, 18, 0);
  const at = (m) => new Date(now + m * 60000 + 5000);
  const it = { board: { start: at(0) }, next: [{ board: at(2) }, { board: at(4) }, { board: at(90) }] };
  assert.deepEqual(nextDepartures(it, now), [0, 2, 4]);
  assert.deepEqual(nextDepartures({ board: { start: at(-3) }, next: [{ board: at(5) }] }, now), [5]);
  assert.deepEqual(nextDepartures(null, now), []);
});
