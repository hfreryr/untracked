// Grands lieux (stade, parc, hôpital…) : l'itinéraire vise l'accès le plus proche du départ, pas le milieu du terrain.
// Les accès sont préparés chaque nuit (build_places.py, étiquette « _acc ») : entrées dessinées dans OSM, sinon points
// où un chemin touche le contour, sinon bord de rue. Exemple qui a motivé le changement (28/10/2026) : stade
// Maurice-Baquet, visé en son centre → 18 min de marche depuis la gare de Gentilly, option écartée ; par la rue
// d'Arcueil → 12 min, Gentilly redevient le meilleur trajet.
import { details } from '#lib/places.js';

const d2 = (a, b) => { const k = Math.cos((a.lat * Math.PI) / 180); return ((a.lon - b.lon) * k) ** 2 + (a.lat - b.lat) ** 2; };

/** Le point à viser pour `pt` (départ ou arrivée) quand on vient de `other` : son accès le plus proche, sinon lui-même. */
export function accessPoint(pt, other) {
  if (!pt?.access?.length || !other) return pt;
  const best = pt.access.map(([lon, lat]) => ({ lon, lat })).sort((a, b) => d2(a, other) - d2(b, other))[0];
  return { ...pt, lat: best.lat, lon: best.lon };
}

/** Complète un point avec les accès de son lieu (lus dans la tuile du lieu ; déjà lus : rien à faire). */
export async function withAccess(pt, info = null) {
  if (!pt || pt.access !== undefined || !pt.osmType) return pt;
  const i = info || (await details(pt).catch(() => ({})));
  return { ...pt, access: i?.access || null };
}
