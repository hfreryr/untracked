// État de la page « Corriger » (PlaceEditor.svelte) : ouverte depuis la fiche, ou reprise au retour de la connexion à
// OpenStreetMap (osmresume.js) avec les corrections déjà saisies. Hors du bloc « app » de la page.
export const placeEdit = $state({ open: false, place: null, changes: {}, step: 'list' });

export function openPlaceEdit(place, changes = {}, step = 'list') {
  Object.assign(placeEdit, { open: true, place: { osmType: place.osmType, osmId: place.osmId, name: place.name, lat: place.lat, lon: place.lon }, changes: { ...changes }, step });
}
export const closePlaceEdit = () => { placeEdit.open = false; };
