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

test('adresse : numéro et rue, seulement si le lieu porte la sienne ; envoi en addr:housenumber / addr:street', () => {
  const A = F('address');
  assert.deepEqual(current(A, { 'addr:housenumber': '83', 'addr:street': 'Avenue de Ségur' }), { value: '83|Avenue de Ségur', outside: false });
  assert.deepEqual(current(A, { 'addr:street': 'Rue X', _src: { 'addr:street': 'overture' } }), { value: '|Rue X', outside: true });
  assert.deepEqual(current(A, { name: 'Sans adresse' }), { value: '', outside: false });
  assert.equal(shown(A, '83|Avenue de Ségur'), '83 Avenue de Ségur');
  assert.equal(shown(A, '|Rue X'), 'Rue X');
  assert.deepEqual(cleanValue(A, ' 12  bis |  rue   de Rennes '), { value: '12 bis|rue de Rennes' });
  assert.deepEqual(cleanValue(A, '12B|Rue de Rennes'), { value: '12B|Rue de Rennes' });
  assert.ok(cleanValue(A, '12|').error);
  assert.ok(cleanValue(A, 'douze|Rue de Rennes').error);
  assert.deepEqual(tagsFor({ address: '85|Avenue de Ségur' }, {}), { 'addr:housenumber': '85', 'addr:street': 'Avenue de Ségur' });
  assert.deepEqual(tagsFor({ address: '|Avenue de Ségur' }, {}), { 'addr:street': 'Avenue de Ségur' });
  assert.match(noteText('position', 'Café X', 'Il est au 12, pas au 40'), /position fausse sur la carte pour « Café X »/);
  assert.match(noteText('adresse', 'Café X', 'C’est au 12 rue Y'), /adresse fausse pour « Café X »/);
});
