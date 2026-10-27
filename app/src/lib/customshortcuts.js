// Raccourcis personnels (« Foot », « Salle », « Chez maman ») à côté de Maison et Travail : un nom, une icône
// (shortcuticons.js), et une adresse qu'on peut donner plus tard. Logique pure, testée (customshortcuts.test.js).
// Ils remplacent les « lieux épinglés » (27/10/2026) : les épinglés existants deviennent des raccourcis.
import { ICON_IDS } from '#lib/shortcuticons.js';

export const MAX_CUSTOM = 30;
export const NAME_MAX = 30;
export const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Ce qu'on garde d'un lieu pour y aller (mêmes champs que Maison et Travail). */
export const placeData = (p) => (p ? { id: p.id, name: p.name, type: p.type, address: p.address || '', lat: p.lat, lon: p.lon,
  osmType: p.osmType, osmId: p.osmId, subclass: p.subclass, pin: p.pin } : null);

const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
const cleanIcon = (i) => (ICON_IDS.includes(i) ? i : 'autre');

/** Raccourcis lus sur l'appareil (données abîmées ou anciennes écartées). */
export function cleanCustoms(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((c) => c && typeof c === 'object' && cleanName(c.name))
    .map((c) => ({ id: typeof c.id === 'string' ? c.id : newId(), name: cleanName(c.name), icon: cleanIcon(c.icon),
      place: c.place && Number.isFinite(+c.place.lat) && Number.isFinite(+c.place.lon) ? c.place : null }))
    .slice(0, MAX_CUSTOM);
}

/** Anciens « lieux épinglés » → raccourcis (nom du lieu, icône « Autre »). */
export function fromPins(pins, favorites, placeKey) {
  return (pins || []).map((k) => favorites.find((f) => placeKey(f) === k)).filter(Boolean)
    .map((f) => ({ id: newId(), name: cleanName(f.name) || cleanName(f.address) || '?', icon: 'autre', place: placeData(f) }));
}

export function addCustom(list, { name, icon, place = null }) {
  const c = { id: newId(), name: cleanName(name), icon: cleanIcon(icon), place: placeData(place) };
  if (!c.name || list.length >= MAX_CUSTOM) return { list, id: null };
  return { list: [...list, c], id: c.id };
}
export const updateCustom = (list, id, patch) => list.map((c) => (c.id !== id ? c : {
  ...c,
  ...('name' in patch && cleanName(patch.name) ? { name: cleanName(patch.name) } : {}),
  ...('icon' in patch ? { icon: cleanIcon(patch.icon) } : {}),
  ...('place' in patch ? { place: placeData(patch.place) } : {})
}));
export const removeCustom = (list, id) => list.filter((c) => c.id !== id);

/** Le raccourci qui mène à ce lieu (fiche d'un lieu : « Raccourci » allumé). */
export const customOf = (list, place, sameSpot) => (place ? list.find((c) => c.place && sameSpot(c.place, place)) || null : null);

/** Ajout de raccourcis reçus (transfert, sauvegarde) : on ne double pas un même nom au même endroit. */
export function mergeCustoms(mine, incoming, sameSpot) {
  const out = [...mine];
  for (const c of incoming) {
    const dup = out.some((m) => m.name === c.name && (m.place && c.place ? sameSpot(m.place, c.place) : !m.place && !c.place));
    if (!dup && out.length < MAX_CUSTOM) out.push({ ...c, id: newId() });
  }
  return out;
}
