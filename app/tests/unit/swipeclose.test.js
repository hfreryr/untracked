// Glisser une fenêtre vers le bas pour la fermer (21/10)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldClose } from '#lib/swipeclose.js';

test('fermer : assez loin, ou un coup rapide ; pas un petit glissement ni vers le haut', () => {
  assert.ok(shouldClose(120, 400));        // tiré loin, lentement
  assert.ok(shouldClose(50, 60));          // coup rapide
  assert.ok(!shouldClose(50, 400));        // petit glissement lent : la fenêtre revient
  assert.ok(!shouldClose(-80, 100));       // vers le haut
});
