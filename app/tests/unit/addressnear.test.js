import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeStreet, matchesQuery, rankAddresses, townAt, withTown } from '#lib/addressnear.js';

test('la commune de la carte est ajoutée, sauf si elle est déjà écrite', () => {
  assert.equal(withTown('10 rue de la République', 'Lyon'), '10 rue de la République Lyon');
  assert.equal(withTown('10 rue de la République lyon', 'Lyon'), null);
  assert.equal(withTown('3 rue de Lyonnais', 'Lyon'), '3 rue de Lyonnais Lyon');   // mot entier seulement
  assert.equal(withTown('10 rue X', null), null);
});

// réponses réelles du géocodeur de l'État, relevées le 31/10/2026 (scripts : voir docs/recherche.md)
const r = (id, score, city, name, lon = 0, lat = 0) => ({ id, score, city, name: `${name}, ${city}`, lon, lat });

test('une adresse ambiguë : celle de la commune où l\'on est d\'abord (Lyon)', () => {
  const plain = [r('decines', 0.97, 'Décines-Charpieu', '10 Rue de la République 69150'), r('lyon1', 0.97, 'Lyon', '10 Rue de la République 69001')];
  const inTown = [r('lyon1', 0.97, 'Lyon', '10 Rue de la République 69001'), r('vx', 0.81, 'Lyon', 'Rue de la République 69002')];
  assert.deepEqual(rankAddresses('10 rue de la République', plain, inTown, 'Lyon').map((x) => x.id), ['lyon1', 'vx', 'decines']);
});

test('une adresse nommée ailleurs passe devant celles de la commune où l\'on est (Gordes vu de Marseille, Brest vu de Rennes)', () => {
  const gordes = [r('gordes', 0.74, 'Gordes', 'Place du Château 84220'), r('ingr', 0.42, 'Ingrandes', '2 Château de la Borde 86220')];
  const inMars = [r('m1', 0.45, 'Marseille', '2 Place du Château 13013')];
  assert.equal(rankAddresses('2 place du château Gordes', gordes, inMars, 'Marseille')[0].id, 'gordes');
  const siam = [r('siam', 0.9, 'Brest', 'Rue de Siam 29200')];
  const inRennes = [r('rn', 0.74, 'Rennes', 'Rue de Brest 35000')];
  assert.equal(rankAddresses('rue de Siam Brest', siam, inRennes, 'Rennes')[0].id, 'siam');
});

test('à note égale, la plus proche ; une note nettement meilleure l\'emporte sur la distance', () => {
  const at = { lat: 48.11, lon: -1.68 };   // Rennes
  const plain = [r('toulouse', 0.9, 'Toulouse', 'x', 1.44, 43.6), r('nantes', 0.9, 'Nantes', 'x', -1.55, 47.21), r('loin', 0.98, 'Lille', 'x', 3.06, 50.63)];
  assert.deepEqual(rankAddresses('q', plain, [], null, at).map((x) => x.id), ['loin', 'toulouse', 'nantes']);
  const close = [r('toulouse', 0.9, 'Toulouse', 'x', 1.44, 43.6), r('nantes', 0.89, 'Nantes', 'x', -1.55, 47.21)];
  assert.deepEqual(rankAddresses('q', close, [], null, at).map((x) => x.id), ['nantes', 'toulouse']);
});

test('tout ce qui a été tapé doit se retrouver dans la réponse (sauf le numéro, et le mot en cours de frappe)', () => {
  const lyon = { name: '10 Rue de la République, 69001 Lyon', city: 'Lyon' };
  assert.ok(matchesQuery('10 rue de la république', lyon));
  assert.ok(matchesQuery('12 rue de la Rép', lyon));
  assert.ok(matchesQuery('bd de la croisette cannes', { name: 'Boulevard de la Croisette, 06400 Cannes', city: 'Cannes' }));
  assert.ok(!matchesQuery('2 place du château gordes', { name: '2 Place du Château, 13013 Marseille', city: 'Marseille' }));
  assert.ok(!matchesQuery('rue paradis 13006', { name: 'Rue Paradis, 13001 Marseille', city: 'Marseille' }));   // code postal
  assert.ok(!matchesQuery('café de la place', { name: 'Place de la Mairie, 75000 Paris', city: 'Paris' }));
});

test('reconnaître une rue sans numéro', () => {
  for (const q of ['rue paradis marseille', 'Boulevard de la Croisette Cannes', 'bd Haussmann', 'place des Vosges', 'allée des Cygnes']) assert.ok(looksLikeStreet(q), q);
  for (const q of ['tour eiffel', 'gare de lyon', 'musée Cocteau Menton', 'Gordes', 'ruelles']) assert.ok(!looksLikeStreet(q), q);
});

test('une seule question par quartier pour connaître la commune', async () => {
  let n = 0;
  const rev = async () => { n++; return 'Lyon'; };
  assert.equal(await townAt({ lat: 45.7601, lon: 4.8312 }, rev), 'Lyon');
  assert.equal(await townAt({ lat: 45.7598, lon: 4.8288 }, rev), 'Lyon');
  assert.equal(n, 1);
});
