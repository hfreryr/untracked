// Mise en forme des itinéraires, place dans la rame, tuiles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badge, altTag, exitPhrase, streetOpts, inMinutes } from '#lib/routeview.js';
import { routeTags } from '#lib/maplayers.js';
import { tileXY } from '#lib/placestore.js';

test('pastilles de lignes', () => {
  assert.equal(badge({ mode: 'SUBWAY', line: '4' }), 'M 4');
  assert.equal(badge({ mode: 'REGIONAL_RAIL', line: 'B' }), 'RER B');
  assert.equal(badge({ mode: 'BUS', line: '84' }), 'Bus 84');
  assert.equal(badge({ mode: 'FERRY', line: 'X' }), 'X');
});
test('écart entre itinéraires', () => {
  const best = { duration: 600, distance: 1000 };
  assert.equal(altTag({ duration: 780, distance: 1100 }, best), '3 min de plus');
  assert.equal(altTag({ duration: 610, distance: 1300 }, best), 'Même durée · 300 m de plus');
  assert.equal(altTag({ duration: 610, distance: 1010 }, best), 'Autre itinéraire, même durée');
});
test('phrase de sortie de métro', () => {
  assert.equal(exitPhrase({ ref: '2', name: 'Rue de Rennes' }), 'prenez la sortie 2 · Rue de Rennes');
  assert.equal(exitPhrase({ ref: null, name: 'Rue de Rennes' }), 'prenez la sortie Rue de Rennes');
  assert.equal(exitPhrase({ ref: null, name: 'Entrée / Sortie' }), '');
});
test('variantes et départs', () => {
  assert.deepEqual(streetOpts(null), []);
  assert.equal(streetOpts({ alts: [{}, {}] }).length, 3);
  assert.equal(inMinutes(new Date(Date.now() - 1000)), 'maintenant');
  assert.equal(inMinutes(new Date(Date.now() + 5 * 60000)), 'dans 5 min');
});
test('étiquettes de tracés : durée sur le choisi, écart sur les autres', () => {
  const line = (dx) => Array.from({ length: 40 }, (_, i) => [2.33 + i * 0.001, 48.85 + dx * Math.sin(i / 6)]);
  const r = { duration: 600, distance: 1000, coords: line(0), alts: [{ duration: 780, distance: 1200, coords: line(0.003) }] };
  const f = routeTags(r, 0, 15).features;
  assert.equal(f.length, 2);
  assert.deepEqual(f.map((x) => x.properties.label).sort(), ['+3 min', '10 min']);
  assert.equal(routeTags(null, 0, 15).features.length, 0);
});
test('tuile de Paris au zoom 14', () => {
  assert.deepEqual(tileXY(2.3488, 48.8534, 14), [8298, 5636]);
});

test('transports : « Arrivée la plus tôt » et « Le plus simple » ; « Le plus rapide » en « Arriver à »', async () => {
  const { transitTags } = await import('#lib/routeview.js');
  const ride = (line) => ({ mode: 'SUBWAY', line });
  const a = { end: new Date(1000), legs: [ride('10'), ride('4')] };
  const b = { end: new Date(1300), legs: [ride('10')] };
  const c = { end: new Date(1500), legs: [ride('12'), ride('4')] };
  assert.deepEqual(transitTags([a, b, c]), ['Arrivée la plus tôt', 'Le plus simple', '']);
  assert.deepEqual(transitTags([b, a]), ['Le plus simple', 'Arrivée la plus tôt']);
  assert.deepEqual(transitTags([{ end: new Date(1), legs: [ride('1')] }, { end: new Date(2), legs: [ride('2')] }]), ['Arrivée la plus tôt', '']);
  // « Arriver à » : toutes arrivent à l'heure, le plus court est « Le plus rapide »
  assert.deepEqual(transitTags([{ start: new Date(0), end: new Date(10), legs: [ride('1')] }, { start: new Date(5), end: new Date(10), legs: [ride('2')] }], true), ['', 'Le plus rapide']);
});

test('départs comme Citymapper : partir dans 1, 4, 7 min ; trains à l’heure ou retardés', async () => {
  const { departInfo, departText } = await import('#lib/routeview.js');
  const now = Date.parse('2026-10-16T10:25:00+02:00');
  const at = (hm) => new Date(`2026-10-16T${hm}:00+02:00`);
  // métro : on doit partir à 10:26, 10:29, 10:32 (10 min de marche jusqu'à Château Rouge)
  const metro = { start: at('10:26'), board: { mode: 'SUBWAY', from: 'Château Rouge', start: at('10:36'), realTime: true },
    next: [{ board: at('10:39'), leave: at('10:29') }, { board: at('10:42'), leave: at('10:32') }] };
  const d = departInfo(metro, null, now);
  assert.equal(departText(d), 'Depuis Château Rouge : dans 1, 4 et 7 min');
  assert.equal(d.live, true);
  // un départ déjà manqué disparaît
  assert.equal(departText(departInfo(metro, null, Date.parse('2026-10-16T10:27:30+02:00'))), 'Depuis Château Rouge : dans 1 et 4 min');
  assert.equal(departText({ kind: 'countdown', mins: [0, 4], from: 'Abbesses' }), 'Depuis Abbesses : maintenant, puis dans 4 min');
  assert.equal(departText({ kind: 'countdown', mins: [0], from: 'Abbesses' }), 'Depuis Abbesses : maintenant');
  assert.equal(departText({ kind: 'countdown', mins: [5, 9], from: 'Anvers' }), 'Depuis Anvers : dans 5 et 9 min');
  // heure choisie, comme Citymapper : « Partir à » → l'arrivée ; « Arriver à » → l'heure où partir
  const trip = { ...metro, end: at('11:02') };
  assert.equal(departText(departInfo(trip, { t: +at('10:20'), arrive: false }, now)), 'Arrivée 11:02');
  assert.equal(departText(departInfo(trip, { t: +at('11:05'), arrive: true }, now)), 'Départ 10:26');
  // RER : heure prévue, état, destination, gare
  const rer = (start, scheduled) => ({ start: at('10:20'), next: [], board: { mode: 'SUBURBAN', from: 'Gare du Nord', headsign: 'Saint-Rémy-lès-Chevreuse', start: at(start), scheduled: at(scheduled), realTime: true } });
  assert.equal(departText(departInfo(rer('10:43', '10:35'), null, now)), 'Depuis Gare du Nord : 10:35 (retardé 10:43), direction Saint-Rémy-lès-Chevreuse');
  assert.equal(departText(departInfo(rer('10:50', '10:50'), null, now)), 'Depuis Gare du Nord : 10:50 (à l\'heure), direction Saint-Rémy-lès-Chevreuse');
  // code de mission du RER (« PIER ») → terminus du train ; une vraie destination est gardée
  const { mapLeg } = await import('#lib/routing.js');
  const leg = (headsign) => mapLeg({ mode: 'SUBWAY', headsign, tripTo: { name: 'Saint-Rémy-lès-Chevreuse' }, startTime: 0, endTime: 0 });
  assert.equal(leg('PIER').headsign, 'Saint-Rémy-lès-Chevreuse');
  assert.equal(leg('Porte de Clignancourt').headsign, 'Porte de Clignancourt');
});

test('modes de transport : on retire ce qu’on ne veut pas (P5 « pas de bus »)', async () => {
  const { transitModesFor } = await import('#lib/routing.js');
  assert.equal(transitModesFor(['metro', 'rail', 'tram', 'bus']), null);
  assert.deepEqual(transitModesFor(['metro', 'rail', 'tram']), ['SUBWAY', 'FUNICULAR', 'RAIL', 'TRAM']);
  assert.deepEqual(transitModesFor(['bus']), ['BUS']);
});
