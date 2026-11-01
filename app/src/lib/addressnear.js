// Adresses autour de la carte, partout en France (porteur, 30/10/2026 : « 10 rue de la République » vu de Lyon
// proposait Décines, Genas… et pas Lyon). Le géocodeur de l'État ne tient presque pas compte du point regardé ;
// il trouve en revanche la bonne rue quand on lui donne la commune. On cherche donc aussi « texte + commune de la
// carte », et ces résultats-là passent devant.
import { norm } from '#lib/searchindex.js';

/** Texte à envoyer avec la commune, ou null si l'utilisateur l'a déjà écrite. */
export function withTown(query, town) {
  if (!town) return null;
  const q = norm(query), t = norm(town);
  return t && !` ${q} `.includes(` ${t} `) ? `${query} ${town}` : null;
}

// Règle (porteur, 31/10/2026) : où que l'on soit, la réponse la plus pertinente d'abord, même à 800 km
// (« 2 place du château Gordes » vu de Paris). La proximité ne départage que des réponses équivalentes
// (« 10 rue de la République » : celle de la ville où l'on est).
const STOP = new Set(['de', 'la', 'le', 'les', 'du', 'des', 'd', 'l', 'et', 'a', 'au', 'aux', 'en', 'sur', 'bis', 'ter']);
const ALIAS = { bd: 'boulevard', bld: 'boulevard', av: 'avenue', ave: 'avenue', pl: 'place', st: 'saint', ste: 'sainte',
  fbg: 'faubourg', imp: 'impasse', rte: 'route', chem: 'chemin', all: 'allee', sq: 'square', qu: 'quai' };
const words = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w)).map((w) => ALIAS[w] || w);
const isNumber = (w) => /^\d{1,4}[a-z]?$/.test(w);
const TIE = 0.03;   // notes du géocodeur aussi bonnes l'une que l'autre : la plus proche d'abord

/** Le résultat contient-il tout ce qui a été tapé ? Le numéro peut manquer (la rue seule), le code postal non ;
 *  le dernier mot peut être en cours de frappe. */
export function matchesQuery(query, r) {
  const have = words(`${r.name || ''} ${r.address || ''} ${r.city || ''}`), set = new Set(have);
  const q = words(query);
  return q.length > 0 && q.every((w, i) => isNumber(w) || set.has(w) || (i === q.length - 1 && have.some((h) => h.startsWith(w))));
}

const STREET = /(^| )(rue|avenue|boulevard|place|quai|cours|allee|impasse|chemin|route|square|passage|esplanade|promenade|faubourg|parvis|sentier|cite|villa|mail|rond point|ruelle|traverse|montee|voie)( |$)/;
/** Le texte désigne-t-il une rue (« rue Paradis Marseille », « bd de la Croisette ») ? */
export const looksLikeStreet = (query) => STREET.test(words(query).join(' '));

/**
 * Adresses dans l'ordre où les proposer.
 * plain : réponses au texte seul ; inTown : au texte suivi de la commune où l'on est (le géocodeur de l'État tient
 * presque pas compte du point regardé) ; town : cette commune ; at : le point regardé.
 * Une réponse de la commune passe devant seulement si elle contient tout ce qui a été tapé : « rue de Siam Brest »
 * vu de Rennes ne donne pas une rue de Rennes. Ensuite, la note du géocodeur ; à note égale, la plus proche.
 */
export function rankAddresses(query, plain, inTown = [], town = null, at = null) {
  const t = norm(town || '');
  const local = t ? inTown.filter((r) => r.city && norm(r.city) === t && matchesQuery(query, r)) : [];
  const best = Math.max(-1, ...plain.map((r) => r.score ?? 0));
  const d = (r) => (at ? Math.hypot((r.lon - at.lon) * Math.cos((at.lat * Math.PI) / 180), r.lat - at.lat) : 0);
  const top = plain.filter((r) => (r.score ?? 0) >= best - TIE).sort((a, b) => d(a) - d(b));
  const rest = plain.filter((r) => !top.includes(r));
  const out = [];
  for (const r of [...local, ...top, ...rest]) if (!out.some((o) => o.id === r.id)) out.push(r);
  return out;
}

// commune du centre de la carte, mise de côté par carré d'environ 2 km (une seule question par quartier)
const towns = new Map();
/** Commune au point `at` (reverse : (lat, lon) → nom ou null). */
export function townAt(at, reverse) {
  const key = `${at.lat.toFixed(2)},${at.lon.toFixed(2)}`;
  if (!towns.has(key)) towns.set(key, reverse(at.lat, at.lon).catch(() => null));
  return towns.get(key);
}
