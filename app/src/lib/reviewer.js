// L'auteur des avis, sur ce téléphone seulement : sa clé de signature, son pseudo, et ses avis publiés (pour les
// afficher tout de suite, sans attendre la prochaine construction des données, et pour compter ses contributions).
// Inclus dans la sauvegarde et le transfert (myplaces.js) : la même clé permet de modifier ses avis ailleurs.
export const REVIEWER_KEY = 'avis-auteur';
const MAX = 500;

export function emptyReviewer() { return { jwk: null, nick: '', mine: [] }; }

/** Données lues (ou reçues d'une sauvegarde), nettoyées. */
export function cleanReviewer(o) {
  if (!o || typeof o !== 'object') return emptyReviewer();
  const jwk = o.jwk && o.jwk.kty === 'EC' && o.jwk.crv === 'P-256' && typeof o.jwk.d === 'string' ? { kty: 'EC', crv: 'P-256', x: o.jwk.x, y: o.jwk.y, d: o.jwk.d } : null;
  const mine = (Array.isArray(o.mine) ? o.mine : []).filter((m) => m && typeof m.id === 'string' && m.stars >= 1 && m.stars <= 5)
    .map((m) => ({ id: m.id, name: String(m.name || '').slice(0, 120), stars: Math.round(m.stars), text: String(m.text || '').slice(0, 1000),
      nick: String(m.nick || '').slice(0, 40), t: +m.t || 0, sig: String(m.sig || '') })).slice(0, MAX);
  return { jwk, nick: String(o.nick || '').slice(0, 40), mine };
}

export function loadReviewer(store = globalThis.localStorage) {
  try { return cleanReviewer(JSON.parse(store.getItem(REVIEWER_KEY) || 'null')); } catch { return emptyReviewer(); }
}
export function saveReviewer(r, store = globalThis.localStorage) {
  try { store.setItem(REVIEWER_KEY, JSON.stringify(r)); } catch { /* navigation privée */ }
}

/** Identifiant d'un lieu pour ses avis (« node/123 »). */
export const placeId = (p) => (p?.osmType && p?.osmId ? `${p.osmType}/${p.osmId}` : null);

/** Ajoute (ou remplace) mon avis sur un lieu. */
export function withMine(r, entry) {
  return { ...r, mine: [entry, ...r.mine.filter((m) => m.id !== entry.id)].slice(0, MAX) };
}
export const mineFor = (r, place) => r.mine.find((m) => m.id === placeId(place)) || null;

/** Réunit l'auteur d'une sauvegarde : on garde sa propre clé s'il en a une, et tous les avis connus. */
export function mergeReviewer(cur, inc) {
  const i = cleanReviewer(inc);
  const mine = [...cur.mine];
  for (const m of i.mine) if (!mine.some((x) => x.id === m.id)) mine.push(m);
  return { jwk: cur.jwk || i.jwk, nick: cur.nick || i.nick, mine };
}
