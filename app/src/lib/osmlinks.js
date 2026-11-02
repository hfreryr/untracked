// Liens « contribuer à OpenStreetMap » depuis une fiche (porteur, 02/11/2026 : « c'était infernal depuis un téléphone ») :
// l'éditeur d'OSM (iD) est fait pour l'ordinateur ; sur un écran tactile, on ouvre plutôt une note (un message laissé
// sur la carte, lu par les bénévoles, sans compte). Ordinateur : l'éditeur, comme avant.
// Étape suivante (après l'annonce au forum OSM France, docs/contribution-osm.md) : modifier les horaires dans l'app.

/** Note OSM à l'endroit du lieu (zoom 18 : la rue et ses voisins, pas seulement le bâtiment). */
export const noteUrl = (p) => (p ? `https://www.openstreetmap.org/note/new#map=18/${(+p.lat).toFixed(6)}/${(+p.lon).toFixed(6)}` : '');

/** Lien pour compléter un lieu : l'éditeur sur ordinateur, une note sur écran tactile. */
export function contributeUrl(p, touch) {
  if (!p) return '';
  if (touch || !p.osmType) return noteUrl(p);
  return `https://www.openstreetmap.org/edit?${p.osmType}=${p.osmId}`;
}

/** Écran tactile (téléphone, tablette) ? */
export const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
