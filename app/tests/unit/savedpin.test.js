// Pastille des lieux de vos listes (savedpin.js) : nom d'image distinct de celui des catégories, plus grande
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { savedIcon, SAVED } from '../../src/lib/savedpin.js';

test('image propre aux listes, plus grande que les catégories (18 px)', () => {
  assert.equal(savedIcon({ icon: 'star', color: '#1E8E3E' }), 'fav|star|#1E8E3E');
  assert.ok(SAVED.px > 18 && SAVED.ring >= 3);
});
