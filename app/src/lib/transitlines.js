// Lignes de la carte « Transports » : Île-de-France (build_overlays.py) et grandes villes françaises
// (build_transit_cities.py), réunies en une seule couche. Un fichier absent ou illisible n'empêche pas l'autre.
export const TRANSIT_FILES = ['data/transit-lines.geojson', 'data/transit-cities.geojson'];

/** Réunit plusieurs FeatureCollection (null = fichier manquant). */
export function mergeLines(collections) {
  return { type: 'FeatureCollection', features: collections.flatMap((c) => c?.features || []) };
}

/** Charge et réunit les fichiers de lignes. */
export async function loadTransitLines(base = location.href, get = fetch) {
  const one = (f) => get(new URL(f, base).href).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return mergeLines(await Promise.all(TRANSIT_FILES.map(one)));
}
