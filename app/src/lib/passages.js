// Autres passages d'une étape en transport, et trajet recalculé avec celui qu'on choisit, comme Citymapper
// (porteur, 29/10/2026 : « tout faire, avec recalcul en fonction des correspondances »).
//  - passages : la même ligne, dans la même direction, au même arrêt, à partir du moment où l'on y est (Transitous,
//    api/v5/stoptimes) ;
//  - recalcul : on garde les étapes d'avant, on repart de cet arrêt à l'heure du passage choisi (api/v5/plan, départ =
//    l'arrêt lui-même), puis les correspondances suivantes s'enchaînent. Pour le premier véhicule, la marche jusqu'à
//    l'arrêt est décalée d'autant (on part plus tard de chez soi).
// Logique pure testée dans passages.test.js ; les deux appels réseau sont en bas.
import { mapLeg } from '#lib/routing.js';

const API = 'https://api.transitous.org/api/v5';
const isRide = (l) => !!l && l.mode !== 'WALK' && l.mode !== 'STOP';

/**
 * Passages de la ligne de l'étape, dans sa direction, à partir de `after`.
 * @param {any[]} stopTimes  réponse de stoptimes  @param {any} leg  étape (routing.mapLeg)
 * @returns {{ time: Date, realTime: boolean, dest: string, tripId: string|null, current: boolean }[]}
 */
export function pickPassages(stopTimes, leg, after, max = 6) {
  const out = [];
  for (const s of stopTimes || []) {
    if (s.cancelled || s.tripCancelled || s.mode !== leg.mode || (s.routeShortName || '') !== leg.line) continue;
    if (leg.directionId != null && s.directionId != null && String(s.directionId) !== String(leg.directionId)) continue;
    const time = new Date(s.place?.departure || s.place?.arrival);
    if (Number.isNaN(+time) || time < after - 30000) continue;
    if (out.some((o) => Math.abs(o.time - time) < 30000)) continue;
    out.push({ time, realTime: !!s.realTime, dest: s.tripTo?.name || s.headsign || '', tripId: s.tripId || null,
      current: (!!leg.tripId && s.tripId === leg.tripId) || Math.abs(time - leg.start) < 30000 });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Moment à partir duquel on peut prendre ce véhicule : l'arrivée à l'arrêt (étape d'avant) pour une correspondance ;
 * pour le premier véhicule, maintenant plus la marche jusqu'à l'arrêt (un métro qui part avant qu'on y soit ne compte pas).
 */
export function readyAt(it, li, now = new Date()) {
  const prev = it.legs[li - 1];
  if (prev && it.legs.slice(0, li).some(isRide)) return prev.end;
  return new Date(+now + (prev ? Math.max(0, prev.end - it.legs[0].start) : 0));
}

/**
 * Trajet recousu : les étapes avant `li`, puis le nouveau trajet calculé depuis l'arrêt. Premier véhicule : les étapes
 * d'avant (la marche jusqu'à l'arrêt) sont décalées pour arriver au nouveau départ.
 * @param {any} it  trajet d'origine  @param {number} li  étape changée  @param {any} fresh  trajet depuis l'arrêt
 */
export function stitch(it, li, fresh) {
  const rest = fresh.legs.filter((l, i) => !(i === 0 && l.mode === 'WALK' && (l.duration || 0) < 60)); // départ = l'arrêt
  const firstRide = !it.legs.slice(0, li).some(isRide);
  const shift = firstRide ? +rest.find(isRide).start - +it.legs[li].start : 0;
  const move = (d) => (d ? new Date(+d + shift) : d);
  const before = it.legs.slice(0, li).map((l) => (shift ? { ...l, start: move(l.start), end: move(l.end) } : l));
  const legs = [...before, ...rest];
  const start = legs[0].start, end = legs[legs.length - 1].end;
  return { ...it, legs, start, end, duration: Math.round((end - start) / 1000), next: [], board: legs.find(isRide) || null, retimed: true };
}

/** Choisit, parmi les trajets depuis l'arrêt, celui qui prend la même ligne au passage choisi (sinon le premier). */
export function sameLine(itins, leg, time) {
  return itins.find((t) => { const r = t.legs.find(isRide); return r && r.line === leg.line && r.mode === leg.mode && Math.abs(r.start - time) < 90000; })
    || itins[0] || null;
}

// ——— Réseau (Transitous) ———

/** Autres passages de l'étape `li` du trajet. */
export async function legPassages(it, li, signal, now = new Date()) {
  const leg = it.legs[li];
  if (!leg?.fromStop) return [];
  const after = readyAt(it, li, now);
  const url = `${API}/stoptimes?stopId=${encodeURIComponent(leg.fromStop)}&time=${new Date(+after - 60000).toISOString()}&n=80`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`transitous-${res.status}`);
  return pickPassages((await res.json()).stopTimes, leg, after);
}

/** Le trajet recalculé en prenant, à l'étape `li`, le passage de `time`. to : point d'arrivée (accès compris). */
export async function retime(it, li, time, to, modes, signal) {
  const leg = it.legs[li];
  const url = new URL(`${API}/plan`);
  url.search = new URLSearchParams({
    fromPlace: leg.fromStop, toPlace: `${to.lat},${to.lon}`, time: new Date(+time - 30000).toISOString(), numItineraries: '5',
    maxPostTransitTime: '1800', ...(modes ? { transitModes: modes.join(',') } : {})
  });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`transitous-${res.status}`);
  const itins = ((await res.json()).itineraries || []).map((r) => ({ legs: r.legs.map(mapLeg) }));
  const fresh = sameLine(itins, leg, time);
  if (!fresh?.legs.some(isRide)) throw new Error('no-route');
  return stitch(it, li, fresh);
}
