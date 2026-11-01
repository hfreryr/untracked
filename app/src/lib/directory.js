// Annuaire national des lieux par nom (01/11/2026, scripts/build_directory.py) : « Gordes », « Palais des Papes »,
// le Rijksmuseum, trouvés depuis n'importe où, sans service tiers (règle du porteur : la bonne réponse quelle que soit
// la distance). Communes, gares, musées, châteaux et lieux connus de toutes nos régions, découpés par début de mot :
// le téléphone ne charge qu'un ou deux petits fichiers par recherche. Rien n'est envoyé : la recherche se fait ici.
import { norm, prepare, STOP } from './searchindex.js';
import { readJson } from './gzjson.js';

let meta = null;                 // promesse de l'index de l'annuaire ({ keys: { "go": 412, … } }) ou null
const cache = new Map();         // url → promesse de l'index préparé

/**
 * Fichiers à lire pour un mot tapé : le plus long début de mot qui le précède (« gordes » → « go »), plus ceux qui le
 * prolongent quand il est en cours de frappe (« chat » → « chateau » aussi).
 * @returns {{keys: string[], n: number}} clés et nombre de lieux qu'elles contiennent
 */
export function keysForWord(w, keys, typing = true) {
  const out = new Set();
  for (let k = w.length; k >= 2; k--) if (keys[w.slice(0, k)] != null) { out.add(w.slice(0, k)); break; }
  // un mot déjà suivi d'un autre est complet : « mont » de « mont saint michel » ne charge pas « montagne », « montpellier »…
  if (typing) for (const k of Object.keys(keys)) if (k.length > w.length && k.startsWith(w)) out.add(k);
  const list = [...out];
  return { keys: list, n: list.reduce((s, k) => s + keys[k], 0) };
}

/**
 * Fichiers à lire pour une recherche : ceux des deux mots les plus rares (un lieu figure sous chacun de ses mots,
 * deux mots couvrent une faute de frappe dans les premières lettres de l'un). Rien sous 3 lettres tapées.
 */
export function keysFor(query, keys) {
  const all = norm(query).split(' ').filter(Boolean);
  const last = all[all.length - 1];
  const words = [...new Set(all.filter((w) => w.length >= 3 && !STOP.has(w)))];
  const per = words.map((w) => keysForWord(w, keys, w === last)).filter((x) => x.keys.length).sort((a, b) => a.n - b.n);
  return [...new Set(per.slice(0, 2).flatMap((x) => x.keys))];
}

function load(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => (r.ok ? readJson(r) : null)).then((raw) => (raw?.items ? { ...prepare(raw), strict: true } : null))
      .catch(() => { cache.delete(url); return null; }));
  }
  return cache.get(url);
}

/** Index de l'annuaire à interroger pour `query` (préparés, mis en cache) ; vide si l'annuaire n'est pas publié. */
export async function directoryFor(base, query) {
  const dir = `${base}directory/`;
  if (!meta) meta = fetch(`${dir}index.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const m = await meta;
  if (!m?.keys) { meta = null; return []; }        // pas (encore) publié, ou hors ligne : on réessaiera
  const ext = m.ext || '.json.gz';
  return (await Promise.all(keysFor(query, m.keys).map((k) => load(`${dir}${k}${ext}`)))).filter(Boolean);
}
