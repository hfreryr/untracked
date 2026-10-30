import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newKeyJwk, keysFrom, payloadOf, signReview, subjectOf, submit, CLIENT_ID } from '#lib/mangrove.js';

const un64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const place = { osmType: 'node', osmId: 3194013327, lat: 48.861574, lon: 2.370638, name: 'Deux Fois Plus de Piment' };

test('sujet et contenu de l’avis (format des autres apps)', () => {
  assert.equal(subjectOf(place), 'geo:48.8615740,2.3706380?q=Deux%20Fois%20Plus%20de%20Piment&u=30');
  const p = payloadOf({ place, stars: 4, text: '  Très bon  ', nick: ' Héron du canal ', now: 1767225600000 });
  assert.equal(p.rating, 80);
  assert.equal(p.opinion, 'Très bon');
  assert.equal(p.iat, 1767225600);
  assert.deepEqual(p.metadata, { client_id: CLIENT_ID, is_personal_experience: true, nickname: 'Héron du canal', osm_id: 'node/3194013327' });
  const q = payloadOf({ place, stars: 5, text: '', nick: '' });
  assert.equal(q.opinion, undefined);                       // texte facultatif
  assert.equal(q.metadata.nickname, undefined);             // pseudo facultatif
});

test('avis signé : en-tête ES256 avec la clé publique, signature vérifiable', async () => {
  const jwk = await newKeyJwk();
  const jwt = await signReview(jwk, payloadOf({ place, stars: 3, now: 1767225600000 }));
  const [h, p, s] = jwt.split('.');
  const header = JSON.parse(new TextDecoder().decode(un64(h)));
  assert.equal(header.alg, 'ES256');
  assert.match(header.kid, /^-----BEGIN PUBLIC KEY-----[A-Za-z0-9+/=]+-----END PUBLIC KEY-----$/);
  assert.equal(JSON.parse(header.jwk).d, undefined);        // jamais la clé privée dans l'avis
  assert.equal(JSON.parse(new TextDecoder().decode(un64(p))).rating, 60);
  const { pub } = await keysFrom(jwk);
  assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, un64(s), new TextEncoder().encode(`${h}.${p}`)), true);
});

test('envoi : PUT /submit/{jwt}, erreur si Mangrove refuse', async () => {
  let seen;
  assert.equal(await submit('a.b.SIG', async (url, o) => { seen = [url, o.method]; return { ok: true }; }), 'SIG');
  assert.deepEqual(seen, ['https://api.mangrove.reviews/submit/a.b.SIG', 'PUT']);
  await assert.rejects(submit('a.b.c', async () => ({ ok: false, status: 400 })), /mangrove-400/);
});
