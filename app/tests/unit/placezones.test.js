import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourcesFor, tileXY } from '#lib/placestore.js';
import ZONES from '#lib/cities/zones.json' with { type: 'json' };

const ids = (lon, lat) => sourcesFor(...tileXY(lon, lat, 14)).map((s) => s.id);

test('chaque région n’est consultée que dans son cadre', () => {
  assert.equal(ids(2.347, 48.857)[0], 'idf');                                        // Paris : l'Île-de-France d'abord (les cadres du Centre et de la Picardie l'englobent aussi)
  assert.deepEqual(ids(4.835, 45.76), ['idf', 'rhone-alpes']);                       // Lyon
  assert.deepEqual(ids(5.37, 43.296), ['idf', 'provence-alpes-cote-d-azur']);        // Marseille
  assert.ok(ids(-1.68, 48.11).includes('bretagne'));                                  // Rennes (et le cadre, rectangulaire, des Pays de la Loire)
  assert.deepEqual(ids(1.94, 47.9), ['idf', 'centre']);                              // Orléans
  assert.deepEqual(ids(9.45, 42.70), ['idf', 'corse']);                              // Bastia
  assert.deepEqual(ids(4.89, 52.37), ['idf', 'amsterdam']);                          // Amsterdam
  assert.deepEqual(ids(13.4, 52.52), ['idf']);                                       // Berlin : rien
});

test('toute la France métropolitaine : chaque préfecture de région est couverte', () => {
  // (une bordure peut toucher deux régions : leurs lieux sont alors réunis, voir placestore.js)
  for (const [lon, lat] of [[7.75, 48.58], [-0.58, 44.84], [3.08, 45.78], [-0.36, 49.18], [5.04, 47.32], [1.90, 47.90],
    [4.03, 48.30], [8.74, 41.93], [6.02, 47.24], [1.10, 49.44], [3.88, 43.61], [1.26, 45.83], [6.18, 48.69], [1.44, 43.60],
    [3.06, 50.63], [-1.55, 47.22], [2.30, 49.89], [0.34, 46.58], [5.37, 43.30], [4.84, 45.76], [-1.68, 48.11]]) {
    assert.ok(ids(lon, lat).some((id) => id !== 'idf'), `${lon},${lat} non couvert`);
  }
});

test('zones.json : pas plus de 4 zones par jour (une tâche par jour, ≈ 1 h ; réparties par taille d’extrait)', () => {
  for (let d = 1; d <= 7; d++) assert.ok(ZONES.filter((z) => z.day === d).length <= 4, `jour ${d}`);
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
