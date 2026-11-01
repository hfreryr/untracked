// Ordre des listes de « Mes lieux » (porteur, 02/11/2026) : Favoris toujours en tête, les autres de la plus récemment
// utilisée à la plus ancienne (ouverte, ou un lieu ajouté), comme Google Maps. Une liste jamais utilisée depuis garde
// sa place d'origine, après les autres. Chaque liste retient sa dernière utilisation : used = [horodatage, 'o' | 'a'].
import { tx } from '#lib/i18n/index.js';

/** Listes dans l'ordre d'affichage (sans modifier l'ordre enregistré). */
export function sortLists(lists) {
  const t = (l) => (Array.isArray(l.used) ? Number(l.used[0]) || 0 : 0);
  return lists.map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.id === 'fav' ? -1 : b.l.id === 'fav' ? 1 : t(b.l) - t(a.l) || a.i - b.i))
    .map(({ l }) => l);
}

/** La liste `id` vient d'être ouverte ('o') ou a reçu un lieu ('a'). */
export const markUsed = (lists, id, kind, now = Date.now()) => lists.map((l) => (l.id === id ? { ...l, used: [now, kind] } : l));

/** « Ouverte aujourd'hui », « Lieu ajouté hier », « Ouverte il y a 5 jours »… ; null au-delà de 30 jours ou sans date. */
export function usedLabel(l, now = Date.now()) {
  if (!Array.isArray(l.used)) return null;
  const day = (ms) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / 86400000);
  const n = day(now) - day(Number(l.used[0]));
  if (!(n >= 0) || n > 30) return null;
  const quand = n === 0 ? tx('liste.aujourd_hui') : n === 1 ? tx('liste.hier') : tx('liste.il_y_a_n_jours', { n });
  return l.used[1] === 'a' ? tx('liste.lieu_ajoute_quand', { quand }) : tx('liste.ouverte_quand', { quand });
}

/** « À tester », ancienne liste par défaut (supprimée le 02/11/2026) : retirée si elle est vide, gardée sinon. */
export function dropEmptyTodo(lists, favorites) {
  return lists.filter((l) => l.id !== 'todo' || favorites.some((f) => f.lists?.includes('todo')));
}
