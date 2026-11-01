import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellToLatLon, latLonFromGoogleUrl } from '#lib/s2cell.js';

// valeurs de référence calculées avec la bibliothèque S2 (s2sphere), sur des lieux d'un vrai export
const REF = [
  ['0x479165dff670c1cf', 48.083714, 7.35484],    // Colmar
  ['0x4791515d63594e71', 48.393689, 7.38748],    // Andlau
  ['0x4653a3fc03841865', 55.607909, 13.000309],  // Malmö
  ['0x12ca18e88920f9e5', 43.763451, 5.363377],   // Lourmarin
  ['0x4793dea6fef89459', 48.11255, 7.099872]
];

test('cellule S2 → position (à 1 m près)', () => {
  for (const [id, lat, lon] of REF) {
    const p = cellToLatLon(id);
    assert.ok(Math.abs(p.lat - lat) < 1e-5 && Math.abs(p.lon - lon) < 1e-5, `${id} : ${p.lat}, ${p.lon}`);
  }
  assert.equal(cellToLatLon('pas un nombre'), null);
  assert.equal(cellToLatLon('0xe000000000000001'), null);   // face 7 : invalide
});

test('lien de lieu Google → position ; autres liens : rien', () => {
  const p = latLonFromGoogleUrl('https://www.google.com/maps/place/Colmar/data=!4m2!3m1!1s0x479165dff670c1cf:0xd7a4b0d6c4f2a8c1');
  assert.ok(Math.abs(p.lat - 48.083714) < 1e-5);
  assert.equal(latLonFromGoogleUrl('https://www.google.com/maps/search/43.72,4.80'), null);
});
