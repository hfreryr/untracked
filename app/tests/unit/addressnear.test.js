import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeAddresses, townAt, withTown } from '#lib/addressnear.js';

test('la commune de la carte est ajoutée, sauf si elle est déjà écrite', () => {
  assert.equal(withTown('10 rue de la République', 'Lyon'), '10 rue de la République Lyon');
  assert.equal(withTown('10 rue de la République lyon', 'Lyon'), null);
  assert.equal(withTown('3 rue de Lyonnais', 'Lyon'), '3 rue de Lyonnais Lyon');   // mot entier seulement
  assert.equal(withTown('10 rue X', null), null);
});

test('les adresses de la commune regardée passent devant, sans doublon', () => {
  const a = (id, city) => ({ id, city });
  const r = mergeAddresses([a('lyon1', 'Lyon'), a('vx', 'Villeurbanne')], [a('decines', 'Décines-Charpieu'), a('lyon1', 'Lyon')], 'Lyon');
  assert.deepEqual(r.map((x) => x.id), ['lyon1', 'decines', 'vx']);
});

test('une seule question par quartier pour connaître la commune', async () => {
  let n = 0;
  const rev = async () => { n++; return 'Lyon'; };
  assert.equal(await townAt({ lat: 45.7601, lon: 4.8312 }, rev), 'Lyon');
  assert.equal(await townAt({ lat: 45.7598, lon: 4.8288 }, rev), 'Lyon');
  assert.equal(n, 1);
});
