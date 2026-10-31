import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourcesFor, tileXY } from '#lib/placestore.js';
import ZONES from '#lib/cities/zones.json' with { type: 'json' };

const ids = (lon, lat) => sourcesFor(...tileXY(lon, lat, 14)).map((s) => s.id);

test('chaque ville n’est consultée que dans son cadre', () => {
  assert.deepEqual(ids(2.347, 48.857), ['idf']);             // Paris : l'Île-de-France seulement
  assert.deepEqual(ids(4.835, 45.76), ['idf', 'lyon']);      // Lyon : son jeu de tuiles en plus
  assert.deepEqual(ids(4.89, 52.37), ['idf', 'amsterdam']);  // Amsterdam : idem
  assert.deepEqual(ids(5.37, 43.296), ['idf', 'marseille']); // Marseille (Vieux-Port)
  assert.deepEqual(ids(5.447, 43.529), ['idf', 'marseille']); // Aix-en-Provence, dans le cadre de Marseille
  assert.deepEqual(ids(7.017, 43.551), ['idf', 'nice']);      // Cannes, dans le cadre de Nice
  assert.deepEqual(ids(-1.68, 48.11), ['idf', 'bretagne']);  // Rennes : dans la région Bretagne
  assert.deepEqual(ids(-4.49, 48.39), ['idf', 'bretagne']);  // Brest
  assert.deepEqual(ids(13.4, 52.52), ['idf']);               // Berlin : rien de plus
});

test('zones.json : pas plus de 2 villes par jour (une tâche par jour, ≈ 25 min par ville)', () => {
  for (let d = 1; d <= 7; d++) assert.ok(ZONES.filter((z) => z.day === d).length <= 2, `jour ${d}`);
  assert.equal(new Set(ZONES.map((z) => z.id)).size, ZONES.length);
});

test('zones.json : chaque ville a un extrait, un cadre et un jour de mise à jour', () => {
  for (const z of ZONES) {
    assert.match(z.id, /^[a-z-]+$/);
    assert.match(z.extract, z.region ? /^europe\/[a-z_]+\/[a-z_]+$/ : /^europe\/[a-z_]+(\/[a-z_]+)+$/);
    assert.match(z.country, /^[A-Z]{2}$/);
    const [w, s, e, n] = z.bbox;
    const max = z.region ? 6 : 1;   // une ville : moins d'1° de côté ; une région entière (« region »), moins de 6°
    assert.ok(w < e && s < n && e - w < max && n - s < max, `${z.id} : cadre invalide ou trop grand`);
    assert.ok(Number.isInteger(z.day) && z.day >= 1 && z.day <= 7, `${z.id} : jour 1 à 7`);
  }
});
