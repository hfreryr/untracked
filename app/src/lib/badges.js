// Badges à collectionner (maquette du 31/10/2026, validée le 01/11) : comptés sur le téléphone à partir de mes avis
// (reviewer.js), comme les niveaux (contrib.js). Rien n'est envoyé, aucun classement entre personnes.
// Chaque avis garde, en plus de la note : le genre de lieu, sa position, sa commune et son code postal (reviewmeta.js).

/** Genre d'un lieu pour les badges, d'après sa sous-catégorie OSM (amenity=restaurant → « restaurant »). */
const KINDS = {
  restaurant: 'restaurant', fast_food: 'restaurant', food_court: 'restaurant', biergarten: 'restaurant',
  cafe: 'cafe', tea: 'cafe', coffee: 'cafe',
  bar: 'bar', pub: 'bar', nightclub: 'bar',
  museum: 'culture', gallery: 'culture', theatre: 'culture', arts_centre: 'culture', cinema: 'culture'
};
export const kindOf = (subclass) => KINDS[subclass] || null;

const GOAL = 5;
export const BADGES = [
  { id: 'gourmet', goal: 10, count: (m) => m.filter((r) => r.kind === 'restaurant').length },
  { id: 'explorateur', goal: GOAL, count: (m) => new Set(m.map((r) => r.city).filter(Boolean)).size },
  { id: 'quartier', goal: GOAL, count: (m) => Math.max(0, ...Object.values(byArea(m))) },
  { id: 'culture', goal: GOAL, count: (m) => m.filter((r) => r.kind === 'culture').length },
  { id: 'cafe', goal: GOAL, count: (m) => m.filter((r) => r.kind === 'cafe').length },
  { id: 'nuit', goal: GOAL, count: (m) => m.filter((r) => r.kind === 'bar').length }
];

/** Quartier d'un avis : l'arrondissement à Paris, Lyon et Marseille (code postal), ailleurs la commune. */
export function areaOf(r) {
  if (/^(750\d\d|75116|6900\d|130\d\d)$/.test(r.pc || '') && /^(Paris|Lyon|Marseille)/.test(r.city || '')) return r.pc;
  return r.city || null;
}
function byArea(mine) {
  const out = {};
  for (const r of mine) { const a = areaOf(r); if (a) out[a] = (out[a] || 0) + 1; }
  return out;
}
/** Quartier le plus noté, pour l'afficher (« 6e arr. », « Rennes »). */
export function topArea(mine) {
  const e = Object.entries(byArea(mine)).sort((a, b) => b[1] - a[1])[0];
  if (!e) return null;
  const [a] = e;
  if (!/^\d{5}$/.test(a)) return { city: a };
  return { arr: a === '75116' ? 16 : +a.slice(3) };
}

/** Avancement de chaque badge : { id, n (plafonné au but), goal, done }. */
export const badgeProgress = (mine) => BADGES.map((b) => {
  const n = b.count(mine);
  return { id: b.id, n: Math.min(n, b.goal), goal: b.goal, done: n >= b.goal };
});

const KEY = 'badges-annonces';
const read = (store) => { try { return JSON.parse(store.getItem(KEY) || 'null'); } catch { return null; } };
const write = (v, store) => { try { store.setItem(KEY, JSON.stringify(v)); } catch { /* navigation privée */ } };

/** Badges obtenus mais jamais annoncés. */
export function badgesNotAnnounced(mine, store = globalThis.localStorage) {
  const seen = read(store) || [];
  return badgeProgress(mine).filter((b) => b.done && !seen.includes(b.id)).map((b) => b.id);
}
/** Les badges obtenus sont annoncés (ou vus dans « Mes contributions »). */
export function markBadges(mine, store = globalThis.localStorage) {
  const seen = new Set(read(store) || []);
  for (const b of badgeProgress(mine)) if (b.done) seen.add(b.id);
  write([...seen], store);
}
