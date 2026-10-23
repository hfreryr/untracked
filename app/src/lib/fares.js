// Prix estimé d'un trajet en transports, à partir des tickets à l'unité du profil de ville (city.fares).
// Prudent : un seul ticket Métro-Train-RER pour toutes les lignes ferrées dans sa durée de validité, un ticket Bus-Tram
// par groupe de bus/tram consécutifs ; rien (null) si un cas n'est pas couvert (aéroport, mode inconnu, ville sans tarifs).
import { city } from './cities/index.js';

/** @param {{mode:string, from?:string, to?:string, start:Date|number}[]} legs  @returns {number|null} prix en euros */
export function tripFare(legs, fares = city.fares, prefix = city.transit?.stopIdPrefix) {
  if (!fares) return null;
  const ride = legs.filter((l) => l.mode !== 'WALK' && l.mode !== 'STOP');
  if (!ride.length) return null;
  // hors du réseau de la ville (Lyon, un TER…) : ces tarifs ne s'appliquent pas, on n'affiche pas de prix (23/10/2026)
  if (prefix && ride.some((l) => l.fromStop && !String(l.fromStop).includes(prefix))) return null;
  let total = 0, railUntil = -Infinity, roadUntil = -Infinity, lastWasRoad = false;
  for (const l of ride) {
    if (fares.unsure.test(`${l.from || ''} ${l.to || ''}`)) return null;
    const t = +new Date(l.start);
    if (fares.rail.modes.includes(l.mode)) {
      if (t > railUntil) { total += fares.rail.price; railUntil = t + fares.rail.minutes * 60000; }
      lastWasRoad = false;
    } else if (fares.road.modes.includes(l.mode)) {
      // correspondance bus/tram dans la durée du ticket ; après un métro ou un RER, on compte un nouveau ticket (cas non documenté)
      if (!lastWasRoad || t > roadUntil) { total += fares.road.price; roadUntil = t + fares.road.minutes * 60000; }
      lastWasRoad = true;
    } else return null;
  }
  return Math.round(total * 100) / 100;
}

/** « 2,55 € » */
export const fmtEuros = (v) => `${v.toFixed(2).replace('.', ',')} €`;
