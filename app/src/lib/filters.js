// Filtres d'une liste de lieux (catégorie ou résultats de recherche) : terrasse, végétarien, à emporter, fauteuil roulant.
// Décision du porteur (21/10) : un filtre n'apparaît que s'il sert, et un lieu sans l'information n'est jamais
// présenté comme « non » : il va dans « sans information », qu'on peut afficher.
// Chaque test renvoie true (oui), false (non) ou null (on ne sait pas).

const yes = (v) => (v == null ? null : /^(yes|only|designated)$/.test(v) ? true : v === 'no' ? false : null);

/** Lieux où l'on mange ou boit : les filtres de table n'ont de sens que pour eux. */
export const FOOD = new Set(['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream', 'food_court', 'biergarten', 'bakery', 'pastry']);

export const FILTERS = [
  { key: 'terrasse', food: true, test: (t) => yes(t.outdoor_seating) },
  { key: 'vegetarien', food: true, test: (t) => {
    const a = yes(t['diet:vegetarian']), b = yes(t['diet:vegan']);
    return a || b ? true : a === false && b !== true ? false : null;
  } },
  { key: 'emporter', food: true, test: (t) => yes(t.takeaway) },
  { key: 'fauteuil', food: false, test: (t) => (t.wheelchair == null ? null : t.wheelchair === 'yes' ? true : t.wheelchair === 'no' || t.wheelchair === 'limited' ? false : null) }
];
const byKey = Object.fromEntries(FILTERS.map((f) => [f.key, f]));

/** Les filtres utiles pour ces lieux ({ t: étiquettes, sub: type }) : au moins un lieu a l'information. */
export function availableFilters(items) {
  const food = items.some((n) => FOOD.has(n.sub));
  return FILTERS.filter((f) => (!f.food || food) && items.some((n) => n.t && f.test(n.t) != null)).map((f) => f.key);
}

/**
 * Trie les lieux selon les filtres actifs (et l'état d'ouverture déjà calculé, `open` : true / false / null si demandé).
 * @returns {{ match: any[], unknown: any[], out: number }}
 */
export function splitByFilters(items, active, needOpen = false) {
  const match = [], unknown = [];
  let out = 0;
  for (const n of items) {
    const answers = active.map((k) => (n.t ? byKey[k].test(n.t) : null));
    if (needOpen) answers.push(n.st?.open ?? null);
    if (answers.some((a) => a === false)) out++;
    else if (answers.every((a) => a === true)) match.push(n);
    else unknown.push(n);
  }
  return { match, unknown, out };
}
