// Corrections affichées tout de suite chez leur auteur (porteur, 04/11/2026) : nos données sont refaites chaque nuit,
// mais le téléphone sait ce qu'il vient d'envoyer à OpenStreetMap. Pendant 7 jours, ces valeurs remplacent celles de nos
// données quand elles diffèrent ; dès que nos données les ont reprises, rien à faire. Rien ne quitte le téléphone :
// on relit les modifications retenues par osmcontrib.js. Les signalements (notes) ne changent pas la carte : la fiche
// dit seulement « Signalé le… » pendant 30 jours.
import { osmEdits } from '#lib/osmcontrib.js';

const DAY = 86400;
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
const mine = (ref, s) => (s ? osmEdits(s).filter((e) => e.ref === ref) : []);

/** Étiquettes du lieu avec les corrections récentes envoyées depuis ce téléphone. */
export function withPending(ref, tags = {}, s = store(), now = Date.now() / 1000) {
  const out = { ...tags };
  let src = tags._src;
  for (const e of mine(ref, s)) {
    if (!e.tags || now - e.t > 7 * DAY) continue;
    for (const [k, v] of Object.entries(e.tags)) {
      if (out[k] === v) continue;
      out[k] = v;
      if (src && k in src) { src = { ...src }; delete src[k]; }
    }
  }
  if (src !== tags._src) out._src = src;
  return out;
}

/** Date (secondes) du dernier signalement fait depuis ce téléphone pour ce lieu, s'il a moins de 30 jours. */
export function reportedAt(ref, s = store(), now = Date.now() / 1000) {
  const r = mine(ref, s).filter((e) => e.kind === 'signalement' && now - e.t <= 30 * DAY).at(-1);
  return r ? r.t : null;
}

export const refOf = (place) => (place?.osmType && place?.osmId ? `${place.osmType}/${place.osmId}` : null);
