import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeProgress, badgesNotAnnounced, markBadges, kindOf, areaOf, topArea } from '#lib/badges.js';
import { earnedBy, levelToAnnounce } from '#lib/contrib.js';
import { reviewMeta, missingMeta } from '#lib/reviewmeta.js';
import { locateOld } from '#lib/reviewbackfill.js';
import { reviewPlaces } from '#lib/reviewsmap.js';
import { cleanReviewer } from '#lib/reviewer.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const rv = (i, o = {}) => ({ id: `node/${i}`, name: `Lieu ${i}`, stars: 4, ...o });

test('badges : genre de lieu, villes, quartier (arrondissement à Paris)', () => {
  assert.equal(kindOf('restaurant'), 'restaurant'); assert.equal(kindOf('pub'), 'bar'); assert.equal(kindOf('museum'), 'culture'); assert.equal(kindOf('bench'), null);
  const mine = [...Array(5)].map((_, i) => rv(i, { kind: 'cafe', city: 'Paris', pc: '75006' })).concat([rv(9, { kind: 'restaurant', city: 'Rennes', pc: '35000' })]);
  const p = Object.fromEntries(badgeProgress(mine).map((b) => [b.id, b]));
  assert.equal(p.cafe.done, true); assert.equal(p.gourmet.n, 1); assert.equal(p.gourmet.goal, 10);
  assert.equal(p.explorateur.n, 2); assert.equal(p.quartier.done, true);
  assert.equal(areaOf({ city: 'Paris', pc: '75006' }), '75006'); assert.equal(areaOf({ city: 'Rennes', pc: '35000' }), 'Rennes');
  assert.deepEqual(topArea(mine), { arr: 6 });
  assert.deepEqual(topArea([rv(1, { city: 'Paris', pc: '75116' })]), { arr: 16 });
});

test('annonce : seulement ce que cet avis fait gagner ; le reste attend « Nouveau » dans Mes contributions', () => {
  const four = [...Array(4)].map((_, i) => rv(i, { kind: 'cafe' }));
  const e = earnedBy(four, [rv(9, { kind: 'cafe' }), ...four], badgeProgress);
  assert.equal(e.level.id, 'passeur'); assert.deepEqual(e.badges, ['cafe']);
  assert.deepEqual(earnedBy(four, [...four], badgeProgress), { level: null, badges: [] });   // avis modifié : rien de nouveau
  const store = mem(), five = [rv(9, { kind: 'cafe' }), ...four];
  assert.deepEqual(badgesNotAnnounced(five, store), ['cafe']);
  markBadges(five, store);
  assert.deepEqual(badgesNotAnnounced(five, store), []);
  assert.equal(levelToAnnounce(5, store).id, 'passeur');
});

test('informations d’un avis : fiche d’abord, commune du géocodeur de l’État sinon (France seulement)', async () => {
  let calls = 0;
  const get = async () => { calls++; return { ok: true, json: async () => ({ features: [{ properties: { city: 'Paris', postcode: '75006' } }] }) }; };
  const a = await reviewMeta({ lat: 48.85, lon: 2.33, subclass: 'cafe' }, { city: 'Paris', postcode: '75006', subclass: 'cafe' }, get);
  assert.deepEqual(a, { lat: 48.85, lon: 2.33, kind: 'cafe', city: 'Paris', pc: '75006' }); assert.equal(calls, 0);
  const b = await reviewMeta({ lat: 48.85, lon: 2.33, subclass: 'bar', address: '3 Rue X, 75006' }, null, get);
  assert.deepEqual(b, { lat: 48.85, lon: 2.33, kind: 'bar', city: 'Paris', pc: '75006' }); assert.equal(calls, 1);
  const c = await reviewMeta({ lat: 52.37, lon: 4.89, subclass: 'cafe' }, null, get);       // Amsterdam : rien demandé
  assert.deepEqual(c, { lat: 52.37, lon: 4.89, kind: 'cafe' }); assert.equal(calls, 1);
});

test('avis anciens : retrouvés dans l’index, gardés une fois rechargés', async () => {
  const me = { jwk: null, nick: '', mine: [rv(1), rv(2, { lat: 1, lon: 2, kind: 'cafe' })] };
  assert.equal(missingMeta(me.mine).length, 1);
  const r = await locateOld(me, { lat: 48.8, lon: 2.3 }, { find: async () => ({ lat: 48.85, lon: 2.33, subclass: 'restaurant' }), meta: async (h) => ({ lat: h.lat, lon: h.lon, kind: 'restaurant', city: 'Paris' }) });
  assert.equal(r.mine[0].kind, 'restaurant');
  assert.equal(await locateOld(me, { lat: 48.8, lon: 2.3 }, { find: async () => null }), null);
  const back = cleanReviewer(JSON.parse(JSON.stringify(r)));
  assert.equal(back.mine[0].city, 'Paris'); assert.equal(back.mine[0].lat, 48.85);
  assert.equal(cleanReviewer({ mine: [rv(3)] }).mine[0].lat, undefined);
  const pl = reviewPlaces(back.mine);
  assert.equal(pl.length, 2); assert.equal(pl[0].osmType, 'node'); assert.equal(pl[0].osmId, 1); assert.match(pl[0].type, /4 sur 5/);
});

test('photo d’avis : taille réduite, envoi à Mangrove, adresse jointe à l’avis signé', async () => {
  const { fitSize, uploadPhoto } = await import('#lib/photoupload.js');
  const { payloadOf } = await import('#lib/mangrove.js');
  assert.deepEqual(fitSize(4000, 3000), [1600, 1200]); assert.deepEqual(fitSize(800, 600), [800, 600]);
  let sent = null;
  const url = await uploadPhoto(new Blob(['x']), async (u, o) => { sent = [u, o.method]; return { ok: true, json: async () => ['AbCdEfGhIjKl_123'] }; });
  assert.deepEqual(sent, ['https://upload.mangrove.reviews', 'PUT']);
  assert.equal(url, 'https://files.mangrove.reviews/AbCdEfGhIjKl_123');
  await assert.rejects(uploadPhoto(new Blob(['x']), async () => ({ ok: true, json: async () => ['../../x'] })));
  const p = payloadOf({ place: { lat: 48.85, lon: 2.35, name: 'A', osmType: 'node', osmId: 1 }, stars: 4, text: '', nick: '', images: [url, 'https://evil.test/x'] });
  assert.deepEqual(p.images, [{ src: url, label: null }]);
});

test('photos du lieu : un commerce montre d’abord ses photos d’avis et de site, un monument d’abord Wikimedia', async () => {
  const { placePhotos } = await import('#lib/placephotos.js');
  const wiki = { photos: [{ src: 'w.jpg', full: 'W.jpg', page: 'p', credit: 'X' }] };
  const info = { expectsHours: true, sitePhoto: 'https://cdn.resto.fr/s.jpg', website: 'https://www.resto.fr',
    reviews: { photos: [{ thumb: 'd/photos/a.t.jpg', full: 'd/photos/a.jpg', nick: 'Lou' }] } };
  const c = placePhotos(wiki, info);
  assert.deepEqual(c.map((p) => p.src), ['d/photos/a.t.jpg', 'https://cdn.resto.fr/s.jpg', 'w.jpg']);
  assert.equal(c[1].referrer, 'origin'); assert.equal(c[1].cors, false); assert.equal(c[1].source, 'resto.fr');
  assert.match(c[0].credit, /Lou.*CC BY 4\.0/);
  assert.deepEqual(placePhotos(wiki, { ...info, expectsHours: false }).map((p) => p.src)[0], 'w.jpg');
});
