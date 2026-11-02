// Retour de la page de connexion d'OpenStreetMap (osmauth.js) : on rouvre la fiche du lieu et l'écran des horaires
// à l'étape de confirmation, avec ce qui avait été saisi (gardé sur le téléphone pendant l'aller-retour).
import { tx } from '#lib/i18n/index.js';
import { osmReturn } from '#lib/osmauth.js';
import { openHoursEdit } from '#lib/hourseditstate.svelte.js';
import { openPlaceEdit } from '#lib/placeeditstate.svelte.js';

export async function resumeOsm(app, ret = osmReturn) {
  const r = await ret().catch(() => ({ error: 'reseau' }));
  if (!r) return;
  const p = r.resume?.place;
  if (p) {
    app.openPlace({ id: `${p.osmType}${p.osmId}`, osmType: p.osmType, osmId: p.osmId, name: p.name, type: '', address: '', lat: p.lat, lon: p.lon });
    if (r.resume.changes) openPlaceEdit(p, r.resume.changes, 'confirm');   // page « Corriger » (PlaceEditor.svelte)
    else openHoursEdit(p, r.resume.oh || '', 'confirm');
  }
  if (r.error) app.say(r.error === 'access_denied' ? tx('horaires_edit.connexion_refusee') : tx('horaires_edit.connexion_echouee'));
}
