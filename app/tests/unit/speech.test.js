// Voix du guidage : choix d'une voix française installée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVoice } from '../../src/lib/speech.js';

test('voix française : fr-FR sur le téléphone d’abord, sinon une autre voix française, sinon aucune', () => {
  const en = { lang: 'en-US', localService: true, name: 'Samantha' };
  const ca = { lang: 'fr-CA', localService: true, name: 'Amélie' };
  const frNet = { lang: 'fr-FR', localService: false, name: 'Google français' };
  const frLoc = { lang: 'fr-FR', localService: true, name: 'Thomas' };
  assert.equal(pickVoice([en, ca, frNet, frLoc]).name, 'Thomas');
  assert.equal(pickVoice([en, ca, frNet]).name, 'Google français');
  assert.equal(pickVoice([en, ca]).name, 'Amélie');
  assert.equal(pickVoice([en]), null);
  assert.equal(pickVoice(undefined), null);
});
