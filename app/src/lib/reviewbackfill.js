// Avis publiés avant le 01/11/2026 : on ne gardait que le nom et l'identifiant du lieu. Pour les badges et la carte de
// mes avis, on les retrouve dans notre index de recherche autour de soi (et l'annuaire national), sur le téléphone,
// sans rien demander à Mangrove. Ceux qui restent introuvables seront complétés en rouvrant leur fiche (Reviews.svelte).
import { indexesAt, searchMany } from './searchzones.js';
import { directoryFor } from './directory.js';
import { dataBase } from './config.js';
import { reviewMeta, missingMeta } from './reviewmeta.js';

/** Lieu de l'index qui porte l'identifiant de l'avis (« node/123 »), cherché par son nom. */
async function findInIndex(r, at) {
  const idx = (await Promise.all([indexesAt(dataBase(), at), directoryFor(dataBase(), r.name)])).flat();
  return searchMany(idx, r.name, at, 30).find((x) => `${x.osmType}/${x.osmId}` === r.id) || null;
}

/**
 * Complète les avis sans position. `find` et `meta` remplaçables pour les tests.
 * @returns {Promise<object|null>} l'auteur mis à jour, ou null si rien n'a changé
 */
export async function locateOld(me, at, { find = findInIndex, meta = reviewMeta } = {}) {
  const todo = missingMeta(me.mine);
  if (!todo.length || !at) return null;
  const mine = [...me.mine];
  let changed = false;
  for (const r of todo) {
    const hit = r.lat != null ? { lat: r.lat, lon: r.lon } : await find(r, at).catch(() => null);
    if (!hit) continue;
    const m = await meta(hit).catch(() => null);
    if (!m) continue;
    mine[mine.indexOf(r)] = { ...r, ...m };
    changed = true;
  }
  return changed ? { ...me, mine } : null;
}
