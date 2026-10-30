import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourcesFor, tileXY } from '#lib/placestore.js';
import ZONES from '#lib/cities/zones.json' with { type: 'json' };

const ids = (lon, lat) => sourcesFor(...tileXY(lon, lat, 14)).map((s) => s.id);

test('chaque ville n’est consultée que dans son cadre', () => {
  assert.deepEqual(ids(2.347, 48.857), ['idf']);             // Paris : l'Île-de-France seulement
  assert.deepEqual(ids(4.835, 45.76), ['idf', 'lyon']);      // Lyon : son jeu de tuiles en plus
  assert.deepEqual(ids(4.89, 52.37), ['idf']);               // Amsterdam : rien de plus
});

test('zones.json : chaque ville a un extrait, un cadre et un jour de mise à jour', () => {
  for (const z of ZONES) {
    assert.match(z.id, /^[a-z-]+$/);
    assert.match(z.extract, /^[a-z_]+\/[a-z_]+$/);
    const [w, s, e, n] = z.bbox;
    assert.ok(w < e && s < n && e - w < 1 && n - s < 1, `${z.id} : cadre invalide ou trop grand`);
    assert.ok(Number.isInteger(z.day) && z.day >= 1 && z.day <= 7, `${z.id} : jour 1 à 7`);
  }
});
