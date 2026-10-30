import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanReviewer, emptyReviewer, mergeReviewer, mineFor, placeId, withMine } from '#lib/reviewer.js';
import { makePseudo } from '#lib/pseudo.js';

test('mes avis : un par lieu, le dernier remplace', () => {
  let r = emptyReviewer();
  r = withMine(r, { id: 'node/1', name: 'A', stars: 4, text: '', nick: '', t: 1, sig: 'x' });
  r = withMine(r, { id: 'node/1', name: 'A', stars: 2, text: 'bof', nick: '', t: 2, sig: 'y' });
  assert.equal(r.mine.length, 1);
  assert.equal(mineFor(r, { osmType: 'node', osmId: 1 }).stars, 2);
  assert.equal(placeId({ lat: 1, lon: 2 }), null);
});

test('sauvegarde : données nettoyées, sa propre clé gardée, avis réunis', () => {
  const bad = cleanReviewer({ jwk: { kty: 'RSA' }, mine: [{ id: 'node/2', stars: 9 }, { id: 'node/3', stars: 5, name: 'B' }] });
  assert.equal(bad.jwk, null);
  assert.deepEqual(bad.mine.map((m) => m.id), ['node/3']);
  const mine = { jwk: { kty: 'EC', crv: 'P-256', x: 'X', y: 'Y', d: 'D' }, nick: 'Moi', mine: [{ id: 'node/1', stars: 4 }] };
  const m = mergeReviewer(cleanReviewer(mine), { jwk: { kty: 'EC', crv: 'P-256', x: 'X2', y: 'Y2', d: 'D2' }, mine: [{ id: 'node/3', stars: 5 }] });
  assert.equal(m.jwk.d, 'D');
  assert.deepEqual(m.mine.map((x) => x.id), ['node/1', 'node/3']);
  assert.equal(mergeReviewer(emptyReviewer(), mine).jwk.d, 'D');
});

test('pseudo généré : un animal et un lieu', () => {
  assert.equal(makePseudo(() => 0), 'Héron du canal');
  assert.match(makePseudo(), /^\S+(-\S+)? (du|des|de la) /);
});

test('sauvegarde et transfert : la clé et les avis suivent', async () => {
  const { snapshot, restore } = await import('#lib/myplaces.js');
  const reviewer = { jwk: { kty: 'EC', crv: 'P-256', x: 'X', y: 'Y', d: 'D' }, nick: 'Héron du canal', mine: [{ id: 'node/1', name: 'A', stars: 4, text: 'top', t: 1, sig: 's' }] };
  const back = restore(JSON.parse(JSON.stringify(snapshot({ lists: [], places: [], shortcuts: {}, pins: [], chips: [], customs: [], reviewer }))));
  assert.equal(back.reviewer.jwk.d, 'D');
  assert.equal(back.reviewer.mine[0].stars, 4);
  assert.equal(restore({ p: [] }).reviewer, null);                       // ancienne sauvegarde : rien
  assert.equal('r' in snapshot({ lists: [], places: [], customs: [], reviewer: { jwk: null, mine: [] } }), false);   // pas d'auteur, rien d'écrit
});
