// Modifier OSM : horaires saisis ↔ texte OSM (hoursedit.js), étiquettes dans le XML (osmedit.js), connexion (osmauth.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHours, formatHours, previewHours, checkWeek, emptyWeek } from '../../src/lib/hoursedit.js';
import { withTags, changesetXml, sendTags } from '../../src/lib/osmedit.js';
import { challengeOf } from '../../src/lib/osmauth.js';

test('horaires simples : lus, réécrits à l\'identique (jours regroupés), aperçu en clair', () => {
  const oh = 'Mo-Th 09:00-19:00; Fr 09:00-14:00,15:00-22:00; Sa 10:00-22:00; Su off';
  const w = parseHours(oh);
  assert.equal(formatHours(w), oh);
  assert.equal(previewHours(w), 'Lun–Jeu 9 h–19 h · Ven 9 h–14 h et 15 h–22 h · Sam 10 h–22 h · Dim fermé');
  assert.equal(formatHours(parseHours('Mo,We 08:30-12:00')), 'Mo 08:30-12:00; Tu off; We 08:30-12:00; Th-Su off');
  assert.equal(formatHours(parseHours('24/7')), '24/7');
});

test('jours fériés gardés tels quels ; horaires détaillés (saisons…) : pas réécrits', () => {
  assert.equal(formatHours(parseHours('Mo-Sa 10:00-19:00; PH off')), 'Mo-Sa 10:00-19:00; Su off; PH off');
  assert.equal(parseHours('Jan-Mar Mo-Fr 10:00-16:00'), null);
  assert.equal(parseHours('Mo-Fr sunrise-sunset'), null);
  assert.equal(parseHours('Mo-Fr 09:00-18:00 "sur rendez-vous"'), null);
});

test('saisie vérifiée : au moins un jour, heures complètes, plages qui ne se chevauchent pas', () => {
  assert.match(checkWeek(emptyWeek()), /jour/);
  const w = emptyWeek(); w.days[0] = [['09:00', '14:00'], ['13:00', '18:00']];
  assert.match(checkWeek(w), /chevauch/);
  w.days[0] = [['09:00', '']]; assert.match(checkWeek(w), /heure/);
  w.days[0] = [['18:00', '02:00']]; assert.equal(checkWeek(w), null);   // ouvert jusqu'à 2 h du matin
});

const NODE = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="openstreetmap-cgimap">
  <node id="42" visible="true" version="7" changeset="111" timestamp="2026-01-01T00:00:00Z" user="x" uid="1" lat="48.85" lon="2.33">
    <tag k="amenity" v="restaurant"/>
    <tag k="name" v="Le Procope"/>
    <tag k="opening_hours" v="Mo-Fr 09:00-18:00"/>
  </node>
</osm>`;

test('étiquettes : remplacée, ajoutée, échappée ; rattachée au groupe de modifications ; rien d\'autre ne bouge', () => {
  const out = withTags(NODE, { opening_hours: 'Mo-Sa 10:00-22:00', 'check_date:opening_hours': '2026-11-02', note: 'a "b" & $1' }, 999);
  assert.match(out, /changeset="999"/);
  assert.match(out, /version="7"/);
  assert.match(out, /<tag k="opening_hours" v="Mo-Sa 10:00-22:00"\/>/);
  assert.match(out, /<tag k="check_date:opening_hours" v="2026-11-02"\/>/);
  assert.match(out, /<tag k="note" v="a &quot;b&quot; &amp; \$1"\/>/);
  assert.equal((out.match(/k="opening_hours"/g) || []).length, 1);
  assert.match(out, /<tag k="name" v="Le Procope"\/>/);
});

test('groupe de modifications signé : app, #untrackedmaps, constaté sur place', () => {
  const x = changesetXml('Horaires de « Le Procope »', '0.2');
  assert.match(x, /created_by" v="Untracked Maps 0.2"/);
  assert.match(x, /hashtags" v="#untrackedmaps"/);
  assert.match(x, /source" v="survey"/);
});

test('envoi : relire, ouvrir, envoyer, fermer ; conflit signalé', async () => {
  const calls = [];
  const fetcher = async (url, o) => { calls.push(`${o.method} ${url.replace('https://api.test/api/0.6/', '')}`); return { ok: true, status: 200, text: async () => (o.method === 'GET' ? NODE : '999') }; };
  const r = await sendTags({ osmType: 'node', osmId: 42 }, { opening_hours: 'Mo off' }, 'c', { api: 'https://api.test', token: 't', fetcher });
  assert.equal(r.changeset, 999);
  assert.deepEqual(calls, ['GET node/42', 'PUT changeset/create', 'PUT node/42', 'PUT changeset/999/close']);
  const conflict = async (url, o) => (o.method === 'PUT' && /node\/42$/.test(url) ? { ok: false, status: 409, text: async () => '' } : { ok: true, status: 200, text: async () => (o.method === 'GET' ? NODE : '5') });
  await assert.rejects(sendTags({ osmType: 'node', osmId: 42 }, {}, 'c', { api: 'https://api.test', token: 't', fetcher: conflict }), (e) => e.code === 'conflit');
});

test('PKCE : défi = SHA-256 du vérificateur, en base64 « url » sans « = » (valeur calculée à part, en Python)', async () => {
  assert.equal(await challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW-gFWFAjcXk'), '7th48vMHIQSq2cYlqDqIizc42LQlYDUGtQYEfWWVLEQ');
});
