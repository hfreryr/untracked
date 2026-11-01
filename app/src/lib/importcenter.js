// Où chercher un lieu importé sans position ? Autour des autres lieux de SA liste (porteur, 01/11/2026 : partir de Paris
// plaçait des lieux de Bavière en Île-de-France ; les lieux d'une liste sont presque toujours dans la même région).
// Médiane des positions connues, et non moyenne : un lieu isolé ne déplace pas le centre.

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const centerOf = (pts) => (pts.length ? { lat: median(pts.map((p) => p.lat)), lon: median(pts.map((p) => p.lon)), n: pts.length } : null);

/** Centre de chaque liste (nom → { lat, lon, n }) et centre de tout l'export, d'après les lieux qui ont une position. */
export function listCenters(places) {
  const by = new Map();
  for (const p of places) if (p.lat && p.lon) { if (!by.has(p.listName)) by.set(p.listName, []); by.get(p.listName).push(p); }
  const centers = new Map([...by].map(([k, pts]) => [k, centerOf(pts)]));
  return { centers, all: centerOf(places.filter((p) => p.lat && p.lon)) };
}

/** Distance approximative en km. */
export const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lon - b.lon) * 111 * Math.cos((a.lat * Math.PI) / 180));

/** Un lieu retrouvé par son nom trop loin de sa liste (au moins 2 lieux placés, à plus de `max` km) : sans doute un homonyme. */
export const tooFar = (place, center, max = 150) => !!(center && center.n >= 2 && km(place, center) > max);
