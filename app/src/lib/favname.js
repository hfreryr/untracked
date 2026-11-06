// Lieu enregistré dont le nom a changé (porteur, 06/11/2026 : nom corrigé, mais l'ancien restait dans Mes lieux et sur
// l'épingle tant qu'on ne le retirait pas de la liste ; puis le nom apparaissait deux fois sur la carte).

/** Mes lieux avec le nouveau nom de ce lieu OSM, ou null si rien ne change. Pure. */
export function renameSaved(favorites, osmType, osmId, name) {
  if (!name || !osmType || osmId == null) return null;
  let changed = false;
  const out = favorites.map((f) => {
    if (f.osmType !== osmType || String(f.osmId) !== String(osmId) || f.name === name) return f;
    changed = true;
    return { ...f, name };
  });
  return changed ? out : null;
}

/**
 * Filtre des lieux mis en avant (calque « landmark ») : sans ceux qui sont dans Mes lieux, déjà sur la carte avec leur
 * propre épingle et leur nom (sinon le nom s'affichait deux fois, de part et d'autre de l'épingle). Pure.
 */
export function withoutSaved(filter, favorites) {
  const refs = favorites.filter((f) => f.osmType && f.osmId != null).map((f) => `${f.osmType}/${f.osmId}`);
  return refs.length ? ['all', filter, ['!', ['in', ['get', 'osm'], ['literal', refs]]]] : filter;
}

/** Nom à jour dans Mes lieux (et enregistré), après une correction ou à l'ouverture de la fiche. */
export function syncSavedName(app, place, name) {
  const next = renameSaved(app.favorites, place.osmType, place.osmId, name);
  if (!next) return;
  app.favorites = next;
  app.saveFavorites();
}
