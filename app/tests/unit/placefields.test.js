// « Corriger » un lieu (placefields.js) : clé OSM à modifier, origine de l'info, saisie nettoyée, étiquettes envoyées
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, tagOf, current, cleanValue, shown, tagsFor, noteText } from '../../src/lib/placefields.js';

const F = (k) => FIELDS.find((f) => f.key === k);

test('site venu d\'Overture : signalé « hors OSM », la correction l\'ajoute à OSM (website)', () => {
  const tags = { name: 'Café aux Ministères', website: 'https://cafe-ministeres.com', _src: { website: 'overture' } };
  assert.deepEqual(current(F('website'), tags), { value: 'https://cafe-ministeres.com', outside: true });
  assert.equal(tagOf(F('website'), tags), 'website');
  assert.deepEqual(tagsFor({ website: 'https://cafeauxministeres.fr' }, tags), { website: 'https://cafeauxministeres.fr' });
});

test('OSM utilise contact:website pour ce lieu : c\'est elle qu\'on corrige', () => {
  assert.deepEqual(tagsFor({ website: 'https://a.fr' }, { 'contact:website': 'https://b.fr' }), { 'contact:website': 'https://a.fr' });
});

test('saisie nettoyée : site complété en https, téléphone français au format international, choix', () => {
  assert.deepEqual(cleanValue(F('website'), 'cafeauxministeres.fr'), { value: 'https://cafeauxministeres.fr' });
  assert.ok(cleanValue(F('website'), 'pas un site').error);
  assert.deepEqual(cleanValue(F('phone'), '01 45 51 00 00'), { value: '+33 1 45 51 00 00' });
  assert.ok(cleanValue(F('phone'), '12').error);
  assert.deepEqual(cleanValue(F('outdoor_seating'), 'no'), { value: 'no' });
  assert.ok(cleanValue(F('name'), '  ').error);
});

test('affichage : site sans https, oui/non en français, horaires en clair ; date de vérification avec les horaires', () => {
  assert.equal(shown(F('website'), 'https://www.cafe.fr/'), 'cafe.fr');
  assert.equal(shown(F('wheelchair'), 'limited'), 'Partiel');
  assert.equal(shown(F('opening_hours'), 'Mo-Sa 07:00-20:00; Su off'), 'Lun–Sam 7 h–20 h · Dim fermé');
  assert.deepEqual(tagsFor({ opening_hours: 'Mo off' }, {}, '2026-11-02'), { opening_hours: 'Mo off', 'check_date:opening_hours': '2026-11-02' });
});

test('message aux bénévoles : précis, signé', () => {
  const t = noteText('ferme', 'Café X', 'Local vide, panneau « à louer »');
  assert.match(t, /fermé définitivement « Café X »/);
  assert.match(t, /à louer/);
  assert.match(t, /Untracked Maps/);
});
