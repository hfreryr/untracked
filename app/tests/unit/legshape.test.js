// Tracé d'une étape en transport vérifié arrêt par arrêt (legshape.js) : ligne 13 en zigzag, 05/11/2026
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trustedShape } from '../../src/lib/legshape.js';

const A = [2.30, 48.88], B = [2.30, 48.87], C = [2.30, 48.86];   // trois arrêts, ~1,1 km entre chacun

test('tracé plausible (légère courbe) : gardé tel quel', () => {
  const shape = [A, [2.301, 48.875], B, [2.299, 48.865], C];
  assert.deepEqual(trustedShape(shape, [A, B, C]), shape);
});

test('détour aberrant entre deux arrêts : ligne droite à cet endroit seulement', () => {
  const detour = [A, [2.33, 48.875], [2.36, 48.873], [2.33, 48.871], B, [2.299, 48.865], C];   // ~9 km pour 1,1
  const out = trustedShape(detour, [A, B, C]);
  assert.deepEqual(out.slice(0, 2), [A, B]);                // A → B tout droit
  assert.deepEqual(out.slice(1), [B, [2.299, 48.865], C]);  // B → C : le tracé d'origine
});

test('sans tracé ou sans arrêts', () => {
  assert.deepEqual(trustedShape([], [A, C]), [A, C]);
  assert.deepEqual(trustedShape([A, C], []), [A, C]);
});
