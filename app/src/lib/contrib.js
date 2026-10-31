// Contributions et petits jeux, tout sur le téléphone (proposition Mangrove validée le 30/10/2026) :
//  - niveaux Éclaireur (1) → Passeur (5) → Vigie (20) → Phare (50), selon le nombre d'avis publiés ;
//  - chaque niveau débloque une couleur de flèche de guidage (décoratif : rien d'utile n'est réservé) ;
//  - « Comment était X ? » : après un guidage vers un lieu, la question revient une fois, entre 1 h et 2 jours après.
import { mineFor } from '#lib/reviewer.js';

export const LEVELS = [{ id: 'eclaireur', min: 1 }, { id: 'passeur', min: 5 }, { id: 'vigie', min: 20 }, { id: 'phare', min: 50 }];
export const ARROWS = { classique: 'rgb(122 150 212 / 0.78)', eclaireur: 'rgb(46 150 90 / 0.8)', passeur: 'rgb(214 140 30 / 0.82)',
  vigie: 'rgb(138 63 252 / 0.72)', phare: 'rgb(214 58 58 / 0.78)' };

/** Niveau atteint (null avant le premier avis), suivant, et combien il en manque. */
export function levelOf(n) {
  let i = -1;
  LEVELS.forEach((l, k) => { if (n >= l.min) i = k; });
  const next = LEVELS[i + 1] || null;
  return { level: i >= 0 ? LEVELS[i] : null, rank: i + 1, next, remaining: next ? next.min - n : 0, progress: next ? (n - (LEVELS[i]?.min || 0)) / (next.min - (LEVELS[i]?.min || 0)) : 1 };
}
/** Flèches disponibles : la classique, puis une par niveau atteint. */
export const unlockedArrows = (n) => ['classique', ...LEVELS.filter((l) => n >= l.min).map((l) => l.id)];

const ARROW_KEY = 'fleche-guidage', ASK_KEY = 'avis-a-demander', ANNOUNCED_KEY = 'niveau-annonce';
const read = (k, d, store) => { try { return JSON.parse(store.getItem(k) || 'null') ?? d; } catch { return d; } };
const write = (k, v, store) => { try { store.setItem(k, JSON.stringify(v)); } catch { /* navigation privée */ } };

export function readArrow(n, store = globalThis.localStorage) {
  const a = read(ARROW_KEY, 'classique', store);
  return unlockedArrows(n).includes(a) ? a : 'classique';
}
export const saveArrow = (a, store = globalThis.localStorage) => write(ARROW_KEY, a, store);

// ——— « Comment était X ? » ———
const HOUR = 3600e3;
export const readAsks = (store = globalThis.localStorage) => read(ASK_KEY, [], store);
export const saveAsks = (a, store = globalThis.localStorage) => write(ASK_KEY, a.slice(-30), store);

/** Guidage terminé à un lieu : on retient de demander plus tard (une seule fois par lieu). */
export function withArrival(asks, place, now = Date.now()) {
  if (!place?.osmType || !place?.osmId || !place?.name) return asks;
  const id = `${place.osmType}/${place.osmId}`;
  if (asks.some((a) => a.id === id)) return asks;
  return [...asks, { id, name: place.name, lat: place.lat, lon: place.lon, osmType: place.osmType, osmId: place.osmId, t: now, done: false }];
}
/** La question à poser maintenant : 1 h à 2 jours après l'arrivée, pas encore posée, pas encore d'avis. */
export function dueAsk(asks, reviewer, now = Date.now()) {
  return asks.find((a) => !a.done && now - a.t >= HOUR && now - a.t <= 48 * HOUR && !mineFor(reviewer, a)) || null;
}
export const asked = (asks, id) => asks.map((a) => (a.id === id ? { ...a, done: true } : a));

// note touchée sur la carte « Comment était X ? » : la fiche du lieu ouvre la fenêtre d'avis avec cette note
let intent = null;
export const setIntent = (id, stars) => { intent = { id, stars }; };
export function takeIntent(id) { const i = intent?.id === id ? intent : null; if (i) intent = null; return i; }

// ——— Nouveau niveau annoncé (porteur, 31/10/2026 : « je suis passé Passeur sans le savoir, ni que je pouvais changer la flèche ») ———
/** Niveau atteint mais pas encore annoncé (le plus haut s'il y en a plusieurs), ou null. */
export function levelToAnnounce(n, store = globalThis.localStorage) {
  const { level, rank } = levelOf(n);
  if (!level) return null;
  return read(ANNOUNCED_KEY, 0, store) < rank ? level : null;
}
export const markAnnounced = (n, store = globalThis.localStorage) => write(ANNOUNCED_KEY, levelOf(n).rank, store);
