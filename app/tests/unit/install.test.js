// Invitation à installer l'app (21/10) : quand l'afficher
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOffer } from '#lib/install.js';

const base = { standalone: false, saved: true, dismissed: null, now: Date.now(), installable: true };
test('après le premier lieu enregistré, dans le navigateur, si l’installation est possible', () => {
  assert.ok(canOffer(base));
  assert.ok(!canOffer({ ...base, saved: false }));          // rien d'enregistré : trop tôt
  assert.ok(!canOffer({ ...base, standalone: true }));      // déjà installée
  assert.ok(!canOffer({ ...base, installable: false }));    // navigateur qui ne sait pas installer
});
test('« Plus tard » : une seule fois de nouveau, deux semaines après', () => {
  const day = 864e5;
  assert.ok(!canOffer({ ...base, dismissed: { n: 1, at: base.now - 3 * day } }));
  assert.ok(canOffer({ ...base, dismissed: { n: 1, at: base.now - 15 * day } }));
  assert.ok(!canOffer({ ...base, dismissed: { n: 2, at: base.now - 60 * day } }));
});
