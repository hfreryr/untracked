// État de l'écran « Modifier les horaires » (HoursEditor.svelte) : ouvert depuis la fiche, ou repris au retour de la
// connexion à OpenStreetMap (osmresume.js). Hors du bloc « app » de la page, qui ne doit plus grossir.
export const hoursEdit = $state({ open: false, place: null, oh: '', step: 'edit' });

/** Ouvre l'écran pour un lieu ; `oh` : horaires de départ (texte OSM, vide pour en ajouter). */
export function openHoursEdit(place, oh = '', step = 'edit') {
  Object.assign(hoursEdit, { open: true, place: { osmType: place.osmType, osmId: place.osmId, name: place.name, lat: place.lat, lon: place.lon }, oh, step });
}
export const closeHoursEdit = () => { hoursEdit.open = false; };
