// Geste sur une fiche : la fiche ne bouge pas quand on fait défiler les photos de côté (sheetintent.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetIntent } from '../../src/lib/sheetintent.js';

test('trop court : on attend', () => assert.equal(sheetIntent(2, 3, false), 'wait'));
test('vertical : la fiche suit', () => assert.equal(sheetIntent(3, 40, false), 'sheet'));
test('plutôt horizontal : jamais la fiche', () => assert.equal(sheetIntent(30, 20, false), 'other'));
test('sur les photos, un glissement de côté un peu penché ne bouge pas la fiche', () => {
  assert.equal(sheetIntent(30, 40, true), 'other');   // 53° : penché, mais on fait défiler les photos
  assert.equal(sheetIntent(10, 40, true), 'sheet');   // nettement vertical : la fiche
});
