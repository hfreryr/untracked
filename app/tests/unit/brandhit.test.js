// Ligne « enseigne » en tête des résultats (comme Google Maps, 21/10)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandOf } from '#lib/brandhit.js';

const shop = (name, subclass = 'supermarket') => ({ name, subclass });
test('plusieurs magasins du même nom et du même type : une enseigne', () => {
  assert.deepEqual(brandOf([shop('Monoprix'), shop('MONOPRIX'), shop('Monoprix'), shop('Monoprix Saint-Paul')]), { name: 'Monoprix' });
});
test('un seul lieu de ce nom : pas de ligne', () => {
  assert.equal(brandOf([shop('Café de Flore', 'cafe'), shop('Flora Caffe', 'bar')]), null);
});
test('même nom, lieux sans rapport : pas de ligne', () => {
  assert.equal(brandOf([shop('Saint-Germain', 'place_of_worship'), shop('Saint-Germain', 'cafe'), shop('Saint-Germain', 'bakery')]), null);
});
test('zones et adresses ignorées', () => {
  assert.equal(brandOf([{ name: '8e Arrondissement', subclass: 'suburb', area: true }, { name: '8e Arrondissement', subclass: 'suburb', area: true }]), null);
});
test('l\'enseigne n\'est proposée que si elle est la meilleure réponse (31/10)', () => {
  const street = { name: 'Rue paradis, 13001 Marseille', subclass: null };
  assert.equal(brandOf([street, shop('Rue de Marseille', 'bus_stop'), shop('Rue de Marseille', 'bus_stop')]), null);
  assert.deepEqual(brandOf([shop('Rue de Marseille', 'bus_stop'), street, shop('Rue de Marseille', 'bus_stop')]), { name: 'Rue de Marseille' });
});
