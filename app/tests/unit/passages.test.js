// Autres passages d'une étape et trajet recousu avec celui qu'on choisit (passages.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPassages, readyAt, stitch, sameLine } from '../../src/lib/passages.js';

const T = (hm) => new Date(`2026-10-29T${hm}:00+01:00`);
const st = (line, dir, hm, extra = {}) => ({ mode: 'BUS', routeShortName: line, directionId: dir, place: { departure: T(hm).toISOString() }, tripId: `${line}${hm}`, ...extra });
const bus91 = { mode: 'BUS', line: '91', directionId: '0', headsign: 'Montparnasse 2 - Gare TGV', tripId: '9100:18', start: T('00:18'), end: T('00:40') };

test('même ligne, même direction, à partir du moment où l’on est à l’arrêt ; terminus différent signalé', () => {
  const list = [st('38', '1', '00:11'), st('91', '1', '00:18'), st('91', '0', '00:18', { tripId: '9100:18', tripTo: { name: 'Gare Montparnasse' } }),
    st('91', '0', '00:28', { tripTo: { name: 'Les Gobelins' }, realTime: true }), st('91', '0', '00:10'), st('91', '0', '00:38', { cancelled: true })];
  const p = pickPassages(list, bus91, T('00:15'));
  assert.deepEqual(p.map((x) => [x.time.toISOString().slice(11, 16), x.current, x.dest, x.realTime]),
    [['23:18', true, 'Gare Montparnasse', false], ['23:28', false, 'Les Gobelins', true]]);
});

test('à partir de quand : l’arrivée à l’arrêt pour une correspondance ; maintenant + la marche pour le premier véhicule', () => {
  const it = { legs: [{ mode: 'WALK', start: T('00:00'), end: T('00:10') }, { mode: 'SUBWAY', end: T('00:20') }, { mode: 'WALK', end: T('00:24') }, bus91] };
  assert.equal(+readyAt(it, 3), +T('00:24'));
  assert.equal(+readyAt(it, 1, T('00:05')), +T('00:15'));   // 10 min de marche jusqu'à l'arrêt
  assert.equal(+readyAt({ legs: [bus91] }, 0, T('00:05')), +T('00:05'));
});

const walk = (a, b) => ({ mode: 'WALK', start: T(a), end: T(b), duration: (T(b) - T(a)) / 1000 });
const ride = (line, a, b) => ({ mode: 'SUBWAY', line, start: T(a), end: T(b) });

test('premier véhicule plus tard : la marche jusqu’à l’arrêt est décalée d’autant', () => {
  const it = { legs: [walk('00:00', '00:05'), ride('4', '00:06', '00:16'), walk('00:16', '00:20')] };
  const fresh = { legs: [walk('00:12', '00:12'), ride('4', '00:12', '00:22'), walk('00:22', '00:26')] };
  const r = stitch(it, 1, fresh);
  assert.deepEqual(r.legs.map((l) => `${l.mode}${l.start.toISOString().slice(14, 16)}`), ['WALK06', 'SUBWAY12', 'WALK22']);
  assert.equal(+r.start, +T('00:06'));
  assert.equal(r.duration, 20 * 60);
  assert.equal(r.board.line, '4');
});

test('correspondance plus tard : les étapes d’avant restent, la suite est recalculée', () => {
  const it = { legs: [walk('00:00', '00:05'), ride('4', '00:06', '00:16'), walk('00:16', '00:19'), ride('14', '00:20', '00:30')] };
  const fresh = { legs: [ride('14', '00:26', '00:36'), walk('00:36', '00:40')] };
  const r = stitch(it, 3, fresh);
  assert.deepEqual(r.legs.map((l) => `${l.mode}${l.start.toISOString().slice(14, 16)}`), ['WALK00', 'SUBWAY06', 'WALK16', 'SUBWAY26', 'WALK36']);
  assert.equal(+r.end, +T('00:40'));
});

test('parmi les trajets depuis l’arrêt : celui qui prend la ligne au passage choisi', () => {
  const a = { legs: [ride('5', '00:38', '00:50')] }, b = { legs: [ride('4', '00:40', '00:52')] };
  assert.equal(sameLine([a, b], { mode: 'SUBWAY', line: '4' }, T('00:40')), b);
  assert.equal(sameLine([a], { mode: 'SUBWAY', line: '4' }, T('00:40')), a);
});
