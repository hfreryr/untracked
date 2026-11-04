// Modifications envoyées à OpenStreetMap depuis l'app : gardées sur le téléphone (rien n'est envoyé ailleurs) pour
// qu'elles comptent dans « Mes contributions » comme les avis (porteur, 02/11/2026) : niveaux et couleurs débloquées.
import { loadReviewer } from '#lib/reviewer.js';
import { pointsOf } from '#lib/points.js';

const KEY = 'modifs-osm';
const read = (store) => { try { const v = JSON.parse(store.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

/** Modifications envoyées : [{ t, name, kind, changeset, server }]. */
export const osmEdits = (store = globalThis.localStorage) => read(store);

/** Retient une modification envoyée (les 500 dernières). */
export function recordEdit(e, store = globalThis.localStorage) {
  try { store.setItem(KEY, JSON.stringify([...read(store), { t: Math.floor(Date.now() / 1000), ...e }].slice(-500))); } catch { /* navigation privée */ }
}

/** Points qui comptent pour les niveaux : avis publiés + modifications OSM, pondérées (points.js, 04/11/2026). */
export const contribCount = (mine = loadReviewer().mine, store = globalThis.localStorage) => pointsOf(mine, read(store));
