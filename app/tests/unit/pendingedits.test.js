// Corrections visibles tout de suite chez leur auteur (pendingedits.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPending, reportedAt, refOf } from '../../src/lib/pendingedits.js';

const mem = (list) => ({ getItem: () => JSON.stringify(list), setItem() {} });
const NOW = 1_800_000_000, DAY = 86400;

test('correction envoyée : affichée tout de suite à la place de nos données, pendant 7 jours', () => {
  const s = mem([{ t: NOW - DAY, ref: 'node/1', kind: 'corrections', tags: { website: 'https://bon.fr', 'addr:housenumber': '42' } }]);
  const t = withPending('node/1', { name: 'Café', website: 'https://faux.fr', 'addr:housenumber': '40', _src: { website: 'overture' } }, s, NOW);
  assert.equal(t.website, 'https://bon.fr');
  assert.equal(t['addr:housenumber'], '42');
  assert.deepEqual(t._src, {});                                        // ce n'est plus une info « hors OSM »
  assert.equal(withPending('node/2', { website: 'x' }, s, NOW).website, 'x');                 // autre lieu
  assert.equal(withPending('node/1', { website: 'x' }, s, NOW + 8 * DAY).website, 'x');       // trop ancienne
  const same = { website: 'https://bon.fr', 'addr:housenumber': '42' };
  assert.deepEqual(withPending('node/1', same, s, NOW), same);        // nos données l'ont reprise
  assert.deepEqual(withPending('node/1', { a: 1 }, null, NOW), { a: 1 });                       // stockage indisponible
});

test('signalement : « Signalé le… » pendant 30 jours ; référence OSM du lieu', () => {
  const s = mem([{ t: NOW - 2 * DAY, ref: 'way/9', kind: 'signalement' }, { t: NOW, ref: 'way/9', kind: 'corrections', tags: {} }]);
  assert.equal(reportedAt('way/9', s, NOW), NOW - 2 * DAY);
  assert.equal(reportedAt('way/9', s, NOW + 31 * DAY), null);
  assert.equal(reportedAt('node/1', s, NOW), null);
  assert.equal(refOf({ osmType: 'node', osmId: 5 }), 'node/5');
  assert.equal(refOf({ name: 'x' }), null);
});
