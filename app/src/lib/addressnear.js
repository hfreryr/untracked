// Adresses autour de la carte, hors Île-de-France (porteur, 30/10/2026 : « 10 rue de la République » vu de Lyon
// proposait Décines, Genas… et pas Lyon). Le géocodeur de l'État ne tient presque pas compte du point regardé ;
// il trouve en revanche la bonne rue quand on lui donne la commune. On cherche donc aussi « texte + commune de la
// carte », et ces résultats-là passent devant.
import { norm } from '#lib/searchindex.js';

/** Texte à envoyer avec la commune, ou null si l'utilisateur l'a déjà écrite. */
export function withTown(query, town) {
  if (!town) return null;
  const q = norm(query), t = norm(town);
  return t && !` ${q} `.includes(` ${t} `) ? `${query} ${town}` : null;
}

/** Résultats dans la commune regardée d'abord, puis les autres ; sans doublon. */
export function mergeAddresses(inTown, plain, town) {
  const t = norm(town || '');
  const first = inTown.filter((r) => r.city && norm(r.city) === t);
  const out = [];
  for (const r of [...first, ...plain, ...inTown]) if (!out.some((o) => o.id === r.id)) out.push(r);
  return out;
}

// commune du centre de la carte, mise de côté par carré d'environ 2 km (une seule question par quartier)
const towns = new Map();
/** Commune au point `at` (reverse : (lat, lon) → nom ou null). */
export function townAt(at, reverse) {
  const key = `${at.lat.toFixed(2)},${at.lon.toFixed(2)}`;
  if (!towns.has(key)) towns.set(key, reverse(at.lat, at.lon).catch(() => null));
  return towns.get(key);
}
