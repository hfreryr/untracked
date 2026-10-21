// Découpage d'un trajet en transport en cartes d'étapes (LegCards.svelte) : marcher jusqu'à la station,
// prendre la ligne, descendre, correspondance, marcher jusqu'à l'arrivée. Logique pure, testée (legcards.test.js).

const isRide = (l) => !!l && l.mode !== 'WALK' && l.mode !== 'STOP';

/**
 * @param {any[]} legs  étapes d'un trajet (routing.transitRoutes)
 * @param {string} destLabel  nom de l'arrivée (« Paris Gare du Nord »)
 * @returns {{ kind: 'walk'|'ride'|'off'|'stop', li: number, target?: string, toRide?: boolean, transfer?: boolean, final?: boolean, first?: boolean }[]}
 */
export function legCards(legs, destLabel) {
  const out = [];
  let seenRide = false;
  legs.forEach((leg, li) => {
    const prev = legs[li - 1], next = legs[li + 1];
    if (leg.mode === 'STOP') { out.push({ kind: 'stop', li }); return; }
    if (leg.mode === 'WALK') {
      const final = li === legs.length - 1;
      // quelques secondes à pied (même quai) : pas une étape
      if (!final && (leg.duration || 0) < 30) return;
      const toRide = isRide(next);
      out.push({ kind: 'walk', li, final, toRide, transfer: toRide && isRide(prev),
        target: final ? destLabel : next ? next.from : leg.to });
      return;
    }
    out.push({ kind: 'ride', li, first: !seenRide });
    out.push({ kind: 'off', li });
    seenRide = true;
  });
  return out;
}

/**
 * Prochains passages de la première ligne, en minutes à partir de maintenant : « 0, 2, 4 ».
 * Ce sont les départs du véhicule à la station (it.board et it.next), pas l'heure où partir de chez soi.
 * @returns {number[]}
 */
export function nextDepartures(it, now = Date.now()) {
  if (!it?.board?.start) return [];
  const times = [it.board.start, ...(it.next || []).map((n) => n.board)].filter(Boolean);
  return times.map((t) => Math.floor((+t - now) / 60000)).filter((m) => m >= 0 && m < 60).slice(0, 3);
}
