// Nouvelle version de l'app (versioncheck.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestVersion, isNewer, freshUrl, withoutV, reloadNow } from '../../src/lib/versioncheck.js';

test('fichier de version lu sans cache, à une adresse unique', async () => {
  let seen;
  const v = await latestVersion('', async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ version: '123' }) }; }, 42);
  assert.equal(v, '123');
  assert.equal(seen.url, '/_app/version.json?t=42');
  assert.equal(seen.opts.cache, 'no-store');
  assert.equal(await latestVersion('', async () => ({ ok: false })), null);
});

test('rechargement sur une adresse nouvelle, puis remise au propre ; à l’ouverture seulement sans rien d’ouvert', () => {
  assert.ok(isNewer('2', '1')); assert.ok(!isNewer('1', '1')); assert.ok(!isNewer(null, '1'));
  assert.equal(freshUrl('https://untrackedmaps.app/#carte=12/48.8/2.3', '9'), 'https://untrackedmaps.app/?v=9#carte=12/48.8/2.3');
  assert.equal(withoutV('https://untrackedmaps.app/?v=9#carte=1/2/3'), '/#carte=1/2/3');
  assert.equal(withoutV('https://untrackedmaps.app/?titre=x&v=9'), '/?titre=x');
  assert.equal(withoutV('https://untrackedmaps.app/'), null);
  assert.ok(reloadNow(3000, false));
  assert.ok(!reloadNow(3000, true));
  assert.ok(!reloadNow(60000, false));
});
