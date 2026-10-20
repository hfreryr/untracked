// File d'attente pour un service qui limite le nombre de demandes (FOSSGIS, serveur d'itinéraires :
// « une demande par seconde au plus », conditions d'utilisation vérifiées le 19/10/2026).
// Les demandes partent une à une, espacées de `gap` ms ; la plus prioritaire d'abord (0 avant 1),
// à priorité égale dans l'ordre d'arrivée. Une demande annulée (signal) quitte la file sans partir.

/** @param {number} gap @param {{ now?: () => number, wait?: (fn: () => void, ms: number) => any }} [clock] */
export function createLimiter(gap, { now = () => Date.now(), wait = (fn, ms) => setTimeout(fn, ms) } = {}) {
  const queue = [];
  let last = -Infinity, timer = null;
  function pump() {
    timer = null;
    while (queue.length && queue[0].signal?.aborted) { const q = queue.shift(); q.reject(q.signal.reason); }   // « AbortError », comme fetch
    if (!queue.length) return;
    const left = last + gap - now();
    if (left > 0) { timer = wait(pump, left); return; }
    last = now();
    queue.shift().resolve();
    if (queue.length) timer = wait(pump, gap);
  }
  /** Attend son tour. @param {number} [priority] @param {AbortSignal} [signal] */
  return function turn(priority = 1, signal) {
    return new Promise((resolve, reject) => {
      const i = queue.findIndex((q) => q.priority > priority);
      const item = { priority, signal, resolve, reject };
      if (i < 0) queue.push(item); else queue.splice(i, 0, item);
      if (!timer) pump();
    });
  };
}
