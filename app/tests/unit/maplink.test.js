// Liens de lieux reçus de Google Maps ou de Plans (maplink.js, maplinkopen.js, sharedopen.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMapLink, isMapLink } from '../../src/lib/maplink.js';
import { linkResults } from '../../src/lib/maplinkopen.js';
import { sharedText } from '../../src/lib/sharedopen.js';

test('lien Google long : nom et position du lieu (pas du centre de la carte)', () => {
  const l = parseMapLink('https://www.google.com/maps/place/Caf%C3%A9+de+Flore/@48.8541,2.3325,17z/data=!3m1!4b1!4m6!3m5!1s0x47e671d7c3d0c8c1:0x2b9d1e3c!8m2!3d48.854165!4d2.332525!16s');
  assert.equal(l.name, 'Café de Flore');
  assert.deepEqual([l.lat, l.lon], [48.854165, 2.332525]);
});

test('lien Google avec adresse dans le nom, ?q=, et coordonnées seules', () => {
  const a = parseMapLink('https://www.google.fr/maps/place/Le+Procope,+13+Rue+de+l\'Ancienne+Com%C3%A9die,+75006+Paris/@48.853,2.338,17z');
  assert.equal(a.name, 'Le Procope');
  assert.match(a.address, /75006 Paris/);
  assert.equal(parseMapLink('https://maps.google.com/?q=Rijksmuseum+Amsterdam').name, 'Rijksmuseum Amsterdam');
  const c = parseMapLink('https://maps.google.com/?q=48.8584,2.2945');
  assert.deepEqual([c.lat, c.lon, c.name], [48.8584, 2.2945, undefined]);
  assert.equal(parseMapLink('https://www.google.com/maps/search/?api=1&query=Mus%C3%A9e+d%27Orsay').name, 'Musée d\'Orsay');
});

test('lien Plans : nouveau format, ancien format, recherche', () => {
  const n = parseMapLink('https://maps.apple.com/place?address=1%20Apple%20Park%20Way,%20Cupertino&coordinate=37.334859,-122.009040&name=Apple%20Park&place-id=I7C250D2CDCB364A&map=explore');
  assert.deepEqual([n.name, n.lat, n.lon], ['Apple Park', 37.334859, -122.00904]);
  assert.match(n.address, /Cupertino/);
  const o = parseMapLink('https://maps.apple.com/?q=Louvre&ll=48.8606,2.3376&address=Rue+de+Rivoli');
  assert.deepEqual([o.name, o.lat], ['Louvre', 48.8606]);
  assert.equal(parseMapLink('https://maps.apple.com/search?query=Jardin%20du%20Luxembourg').name, 'Jardin du Luxembourg');
});

test('liens courts : reconnus, et le texte qui les accompagne gardé', () => {
  for (const u of ['https://maps.app.goo.gl/4gHJgbnyEX2ZYE2f8?g_st=ic', 'https://goo.gl/maps/abc', 'https://maps.apple/p/U8rE9v8n8iVZjr']) {
    assert.ok(isMapLink(u), u);
    assert.equal(parseMapLink(u).short, true, u);
  }
  assert.equal(parseMapLink('Café de Flore\nhttps://maps.app.goo.gl/xyz').rest, 'Café de Flore');
  assert.equal(parseMapLink('https://example.com/maps/place/x'), null);
  assert.equal(isMapLink('café de flore'), false);
});

const deps = (over = {}) => ({ search: async () => [], snap: async () => null, resolve: async () => null, ...over });

test('lien long → le lieu de nos données, sinon un repère à sa position', async () => {
  const flore = { name: 'Café de Flore', osmType: 'node', osmId: 1, lat: 48.85416, lon: 2.33253 };
  const u = 'https://www.google.com/maps/place/Caf%C3%A9+de+Flore/@48.854,2.332,17z/data=!3d48.854165!4d2.332525';
  assert.deepEqual(await linkResults(u, null, deps({ snap: async () => flore })), [flore]);
  const [p] = await linkResults(u, null, deps());
  assert.deepEqual([p.name, p.lat, p.lon], ['Café de Flore', 48.854165, 2.332525]);
});

test('lien court : le texte partagé avec lui est cherché, sinon on demande le nom', async () => {
  const seen = [];
  await linkResults('Café de Flore https://maps.app.goo.gl/xyz', null, deps({ search: async (q) => { seen.push(q); return []; } }));
  assert.deepEqual(seen, ['Café de Flore']);
  await assert.rejects(linkResults('https://maps.app.goo.gl/4gHJgbnyEX2ZYE2f8?g_st=ic', null, deps()), (e) => /lien court/.test(e.say));
});

test('partage vers l\'app : le lien d\'abord, le texte s\'il ne le répète pas', () => {
  assert.equal(sharedText('?titre=Caf%C3%A9+de+Flore&texte=https%3A%2F%2Fmaps.app.goo.gl%2Fxyz'), 'https://maps.app.goo.gl/xyz Café de Flore');
  assert.equal(sharedText('?lien=https%3A%2F%2Fx.fr&texte=Voir+https%3A%2F%2Fx.fr'), 'https://x.fr Voir https://x.fr');
  assert.equal(sharedText(''), null);
});
