// Recherche instantanée sur le téléphone, dans l'index des lieux préparé chaque nuit (scripts/build_search.py).
// Rien n'est envoyé : le texte tapé ne quitte pas l'appareil. Remplace l'attente de Photon (12 s le soir du 15/10/2026)
// et corrige ses classements (« élysée » → un salon de massage) : notoriété Wikidata (QRank), fautes de frappe tolérées,
// doublons fusionnés (une gare = un résultat), lieux utiles avant les arrêts et les parkings.
import { typeLabel } from './places.js';
import { tx } from './i18n/index.js';

export const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// mots qui ne distinguent pas un lieu (on les tolère dans la recherche sans les exiger)
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'et', 'en', 'sur', 'paris', 'the', 'and', 'of']);
// une ligne de l'index : [nom, lon, lat, id, type, notoriété, autres noms, extra, adresse]
const TYPE_BONUS = {
  'railway=station': 10, 'public_transport=station': 8, 'tourism=museum': 8, 'tourism=attraction': 8, 'historic=monument': 6,
  'leisure=park': 6, 'amenity=place_of_worship': 4, 'amenity=theatre': 4, 'amenity=university': 4, 'amenity=hospital': 4,
  'leisure=stadium': 6, 'tourism=gallery': 3, 'amenity=cinema': 3, 'shop=department_store': 4, 'leisure=garden': 3,
  'amenity=parking': -12, 'highway=bus_stop': -10, 'office=company': -6, 'office=yes': -6
};
const TYPE_LETTER = { 1: ['node', 'N'], 2: ['way', 'W'], 3: ['relation', 'R'] };

/** Distance d'édition (Damerau, transpositions comprises), arrêtée dès qu'elle dépasse max. */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}

/** Mots d'un nom, plus les formes collées des élisions (« d orsay » → « dorsay », « l est » → « lest »). */
function wordsOf(text) {
  const w = norm(text).split(' ').filter(Boolean);
  const out = new Set(w);
  for (let i = 0; i + 1 < w.length; i++) if (w[i].length === 1) out.add(w[i] + w[i + 1]);
  return [...out];
}

/** Prépare l'index chargé (search.json) : mots de chaque lieu et table mot → lieux. */
export function prepare(raw) {
  const items = raw.items;
  const byWord = new Map();
  const words = new Array(items.length);
  const sig = new Array(items.length);     // nombre de mots qui comptent dans le nom principal
  for (let i = 0; i < items.length; i++) {
    const [name, , , , , , alts = ''] = items[i];
    const ws = new Set(wordsOf(name));
    for (const a of alts ? alts.split(';') : []) for (const w of wordsOf(a)) ws.add(w);
    words[i] = [...ws];
    sig[i] = norm(name).split(' ').filter((w) => w && !STOP.has(w)).length || 1;
    for (const w of ws) { let l = byWord.get(w); if (!l) byWord.set(w, (l = [])); l.push(i); }
  }
  return { raw, items, words, sig, byWord, vocab: [...byWord.keys()] };
}

/** Pour un mot tapé : les mots de l'index qui lui correspondent, avec la qualité de la correspondance (1 = exact). */
function matchesOf(idx, q, last) {
  const out = new Map();
  const exact = idx.byWord.get(q);
  if (exact) out.set(q, 1);
  const maxEd = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
  for (const w of idx.vocab) {
    if (w === q) continue;
    // début de mot : seulement pour le dernier mot tapé (on est en train de l'écrire) ou un mot déjà long
    if (w.startsWith(q) && (last || q.length >= 4) && q.length >= 2) { out.set(w, 0.85 - Math.min(0.15, (w.length - q.length) * 0.02)); continue; }
    if (!maxEd || Math.abs(w.length - q.length) > maxEd || w[0] !== q[0] && q.length < 6) continue;
    const d = editDistance(q, w, maxEd);
    if (d <= maxEd) out.set(w, d === 1 ? 0.72 : 0.55);
    // un mot tapé sans sa fin, avec une faute (« palai » → « palais » via « palai » ≈ début de « palais »)
    else if (last && w.length > q.length && editDistance(q, w.slice(0, q.length), 1) <= 1 && q.length >= 4) out.set(w, 0.6);
  }
  return out;
}

const meters = (a, b) => Math.hypot((a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * 110540);

/** Résultat au format des autres moteurs (geocode.js). */
export function toResult(idx, i) {
  const [name, lon, lat, id, ti, , , , addr = ''] = idx.items[i];
  const [k, v] = (idx.raw.types[ti] || '').split('=');
  const [osmType, letter] = TYPE_LETTER[id % 10] || TYPE_LETTER[1];
  const osmId = Math.floor(id / 10);
  const [num, si, pc] = addr ? addr.split('|') : [];
  const street = si != null && si !== '' ? idx.raw.streets[+si] : '';
  // un quartier, un arrondissement : une zone (la carte s'y cadre), pas un lieu
  const area = k === 'place' || (k === 'boundary' && v === 'administrative') || undefined;
  return { id: `${letter}${osmId}`, osmType, osmId, name, type: (k && typeLabel(k, v)) || '', subclass: v || null, area,
    // « ~ » : pas d'adresse connue, rue la plus proche (build_search.py) → « près de Rue X »
    address: num === '~' ? (street ? tx('resultats.pres_de', { rue: street }) : '') : [[num, street].filter(Boolean).join(' '), pc].filter(Boolean).join(', '), lat, lon };
}

/**
 * Lieux dont le nom correspond au texte tapé, les plus pertinents d'abord.
 * Pertinence = correspondance du texte (fautes tolérées) + notoriété (QRank) + type de lieu − éloignement.
 */
export function searchIndex(idx, query, at, limit = 7) {
  const all = norm(query).split(' ').filter(Boolean);
  if (!all.length) return [];
  const qs = all.filter((w) => !STOP.has(w)).length ? all.filter((w) => !STOP.has(w)) : all;
  // pour chaque mot tapé : les lieux qui le contiennent (ou presque) et la meilleure qualité
  let cand = null;
  const perWord = qs.map((q, n) => {
    const m = matchesOf(idx, q, n === qs.length - 1);
    const score = new Map();
    for (const [w, s] of m) for (const i of idx.byWord.get(w)) if (!(score.get(i) >= s)) score.set(i, s);
    return score;
  });
  perWord.sort((a, b) => a.size - b.size);
  for (const s of perWord) {
    if (!cand) { cand = [...s.keys()]; continue; }
    cand = cand.filter((i) => s.has(i));
    if (!cand.length) break;
  }
  if (!cand?.length) return [];
  const qn = norm(query);
  const scored = cand.map((i) => {
    const it = idx.items[i];
    const text = perWord.reduce((t, s) => t + s.get(i), 0) / perWord.length;
    const cover = Math.min(1, qs.length / idx.sig[i]);
    const nn = norm(it[0]);
    const start = nn === qn ? 0.15 : nn.startsWith(qn) ? 0.08 : 0;
    const rank = it[5] || 0;
    const type = TYPE_BONUS[idx.raw.types[it[4]]] || 0;
    const km = meters(at, { lon: it[1], lat: it[2] }) / 1000;
    const far = Math.min(25, km * 3) * (1 - Math.min(1, rank / 70));
    return { i, s: 100 * text * (0.6 + 0.4 * cover) + 100 * start + 0.6 * rank + type - far, strong: text >= 0.7 && cover >= 0.5 };
  });
  scored.sort((a, b) => b.s - a.s);
  // « strong » : le texte correspond nettement (pas seulement un mot approché dans un long nom)
  return scored.slice(0, limit).map(({ i, s, strong }) => ({ ...toResult(idx, i), strong, score: s }));
}
