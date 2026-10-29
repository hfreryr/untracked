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

test('signes d’usage : lieu, raccourci, geste (catégories, import, guidage) ou 3e jour d’utilisation', async () => {
  const { isEngaged } = await import('../../src/lib/install.js');
  assert.equal(isEngaged({ signs: {} }), false);
  assert.equal(isEngaged({ saved: 1, signs: {} }), true);
  assert.equal(isEngaged({ shortcuts: 1, signs: {} }), true);            // Maison, Travail ou raccourci personnel
  assert.equal(isEngaged({ signs: { acts: true } }), true);
  assert.equal(isEngaged({ signs: { days: ['2026-10-26', '2026-10-27'] } }), false);
  assert.equal(isEngaged({ signs: { days: ['2026-10-26', '2026-10-27', '2026-10-28'] } }), true);
});

test('navigateur reconnu d’après son nom annoncé : la bonne façon d’installer (29/10)', async () => {
  const { browserOf } = await import('../../src/lib/install.js');
  const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';
  const FIREFOX_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15';
  const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0';
  const DDG_ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile DuckDuckGo/5 Safari/537.36';
  const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  assert.equal(browserOf(SAFARI, { ios: true }), 'ios');
  assert.equal(browserOf(SAFARI, { ios: true, brave: true }), 'ios-brave');        // Brave sur iPhone se présente comme Safari
  assert.equal(browserOf(CHROME_IOS, { ios: true }), 'ios-other');
  assert.equal(browserOf(FIREFOX_IOS, { ios: true }), 'ios-other');
  assert.equal(browserOf(FIREFOX_ANDROID), 'firefox');
  assert.equal(browserOf(DDG_ANDROID), 'elsewhere');
  assert.equal(browserOf(CHROME_ANDROID), null);         // Chrome : sa propre fenêtre d'installation (ou déjà installée)
  assert.equal(browserOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/132.0'), null);   // ordinateur : rien
});
