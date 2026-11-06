// Lieu enregistré dont le nom a changé (favname.js, 06/11/2026)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renameSaved, withoutSaved } from '../../src/lib/favname.js';

const favs = [{ name: 'Sésame', osmType: 'node', osmId: 12, lists: ['fav'] }, { name: 'Autre', osmType: 'way', osmId: 3 }, { name: 'Point', lat: 1, lon: 2 }];

test('nom corrigé : repris dans Mes lieux ; rien à faire s’il est déjà à jour', () => {
  const out = renameSaved(favs, 'node', '12', 'Alétinetine');
  assert.equal(out[0].name, 'Alétinetine');
  assert.deepEqual(out[0].lists, ['fav']);
  assert.equal(out[1], favs[1]);
  assert.equal(renameSaved(favs, 'node', 12, 'Sésame'), null);
  assert.equal(renameSaved(favs, 'node', 99, 'X'), null);
});

test('lieux mis en avant : sans ceux de Mes lieux (pas de nom en double)', () => {
  const f = ['<=', ['get', 'z'], 14];
  assert.deepEqual(withoutSaved(f, favs), ['all', f, ['!', ['in', ['get', 'osm'], ['literal', ['node/12', 'way/3']]]]]);
  assert.equal(withoutSaved(f, [{ name: 'Point' }]), f);
});
