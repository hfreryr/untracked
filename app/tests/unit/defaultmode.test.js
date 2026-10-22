// Mode de déplacement proposé par défaut : le dernier choisi, sauf trajet déraisonnable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickMode, estimateMin, placeEta } from '../../src/lib/defaultmode.js';

test('sans historique : à pied si c’est court, sinon les transports', () => {
  assert.equal(pickMode(null, 800), 'walk');
  assert.equal(pickMode(null, 2500), 'transit');      // Place Vendôme à 2,5 km : plus de « 40 min à pied »
  assert.equal(pickMode(null, null), 'transit');
});

test('le dernier mode choisi est repris, sauf trajet déraisonnable', () => {
  assert.equal(pickMode('bike', 2500), 'bike');
  assert.equal(pickMode('car', 9000), 'car');
  assert.equal(pickMode('transit', 300), 'transit');
  assert.equal(pickMode('walk', 1000), 'walk');
  assert.equal(pickMode('walk', 2500), 'transit');    // plus de 25 min à pied
  assert.equal(pickMode('bike', 12000), 'transit');   // plus de 45 min à vélo
  assert.equal(pickMode('walk', null), 'walk');
});

test('bouton de la fiche : mode et temps, « ≈ » pour les estimations grossières', () => {
  assert.equal(estimateMin('walk', 800), 13);
  const near = placeEta(null, 800);
  assert.deepEqual([near.mode, near.text], ['walk', '13 min']);
  const far = placeEta(null, 2500);
  assert.equal(far.mode, 'transit');
  assert.match(far.text, /^≈ \d+ min$/);
  assert.match(far.label, /^Itinéraire en transports, ≈ \d+ min$/);
  assert.equal(placeEta(null, 30), null);
});
