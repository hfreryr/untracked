// Serveur d'itinéraires FOSSGIS : une demande par seconde au plus (conditions d'utilisation).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../../src/lib/ratelimit.js';

// horloge simulée : les attentes s'exécutent dans l'ordre, sans attendre vraiment
function fakeClock() {
  let t = 0; const timers = [];
  return {
    now: () => t,
    wait: (fn, ms) => { timers.push({ at: t + ms, fn }); timers.sort((a, b) => a.at - b.at); return 1; },
    async run() { await Promise.resolve(); while (timers.length) { const x = timers.shift(); t = x.at; x.fn(); await Promise.resolve(); await Promise.resolve(); } }
  };
}

test('trois demandes d’un coup partent à 1 s d’écart, la prioritaire d’abord', async () => {
  const c = fakeClock(); const turn = createLimiter(1000, c); const log = [];
  turn(1).then(() => log.push(['marche', c.now()]));
  turn(1).then(() => log.push(['vélo', c.now()]));
  turn(0).then(() => log.push(['voiture (affichée)', c.now()]));
  await c.run();
  // la première part tout de suite ; ensuite la prioritaire passe devant celles qui attendent
  assert.deepEqual(log, [['marche', 0], ['voiture (affichée)', 1000], ['vélo', 2000]]);
});

test('une demande annulée quitte la file sans partir', async () => {
  const c = fakeClock(); const turn = createLimiter(1000, c); const ctrl = new AbortController(); const log = [];
  turn(1).then(() => log.push('a'));
  turn(1, ctrl.signal).then(() => log.push('b'), (e) => log.push(e.name));
  turn(1).then(() => log.push(['c', c.now()]));
  ctrl.abort();
  await c.run();
  assert.deepEqual(log, ['a', 'AbortError', ['c', 1000]]);
});

test('pas d’attente si la dernière demande date de plus d’une seconde', async () => {
  const c = fakeClock(); const turn = createLimiter(1000, c); const log = [];
  turn().then(() => log.push(c.now())); await c.run();
  c.wait(() => turn().then(() => log.push(c.now())), 5000); await c.run();
  assert.deepEqual(log, [0, 5000]);
});
