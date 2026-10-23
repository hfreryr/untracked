// Mesure de la qualité de la recherche sur les recherches de référence (reference.json).
//   node tests/search/eval.mjs                 → recherche locale (nos tuiles) et Photon
//   node tests/search/eval.mjs --only local    → un seul moteur
//   node tests/search/eval.mjs --json out.json → résultats détaillés
// Réussite « top 1 » : le bon lieu en premier ; « top 3 » : dans les trois premiers.
// Le lieu attendu est reconnu à son identifiant Wikidata (via nos tuiles), ou à moins de 300 m avec un nom proche.
// Pour une catégorie (« pharmacie »), il faut un lieu de ce type, à moins de 3 km du point de départ.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { matchPlaces } from '#lib/localsearch.js';
import { prepare, searchIndex } from '#lib/searchindex.js';
import { zonesAround, searchMany } from '#lib/searchzones.js';
import { intentOf, nearestOf } from '#lib/searchintent.js';

const here = new URL('.', import.meta.url).pathname;
const ref = JSON.parse(readFileSync(`${here}reference.json`, 'utf8'));
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
// index de recherche (build_search.py) : par défaut celui des tuiles, sinon --index chemin/search.json
const indexPath = args.includes('--index') ? args[args.indexOf('--index') + 1] : null;

// ——— Nos lieux (tuiles préparées) ———
const root = `${here}../../static/data/places`;
if (!existsSync(`${root}/index.json`)) { console.error('Tuiles de lieux absentes : lancer scripts/build_places.py'); process.exit(1); }
const z = JSON.parse(readFileSync(`${root}/index.json`, 'utf8')).zoom;
const places = [];
for (const x of readdirSync(`${root}/${z}`)) for (const f of readdirSync(`${root}/${z}/${x}`)) {
  for (const [id, lon, lat, tags] of JSON.parse(readFileSync(`${root}/${z}/${x}/${f}`, 'utf8')).t) places.push({ id, lon, lat, tags });
}
const LETTER = { 1: 'N', 2: 'W', 3: 'R' };
const byId = new Map(places.map((p) => [`${LETTER[p.id % 10]}${Math.floor(p.id / 10)}`, p]));
const byWd = new Map();
for (const p of places) if (p.tags.wikidata) (byWd.get(p.tags.wikidata) || byWd.set(p.tags.wikidata, []).get(p.tags.wikidata)).push(p);

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const GENERIC = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'paris', 'gare', 'musee', 'place', 'parc', 'jardin', 'cafe', 'restaurant', 'saint', 'sainte']);
const words = (s) => norm(s).split(' ').filter((w) => w.length > 1 && !GENERIC.has(w));
const meters = (a, b) => Math.hypot((a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * 110540);

/** Ce résultat est-il ce qu'on attendait ? */
function isHit(q, r, at) {
  const tags = byId.get(r.id)?.tags || {};
  if (q.wd) {
    if (tags.wikidata === q.wd) return true;
    const targets = byWd.get(q.wd) || [];
    const close = targets.some((t) => meters(t, r) < 300);
    const names = new Set(targets.flatMap((t) => words(t.tags.name)));
    return close && words(r.name).some((w) => names.has(w));
  }
  if (q.name) return meters({ lon: q.near[0], lat: q.near[1] }, r) < 300 && norm(r.name).includes(norm(q.name));
  if (q.any) {
    if (meters(at, r) > 3000) return false;
    const { tag, diet, brand } = q.any;
    if (tag) { const [k, v] = tag.split('='); return (tags[k] || '').split(';').includes(v) || (r.osmKey === k && r.subclass === v); }
    if (diet) return /yes|only/.test(tags['diet:vegetarian'] || '') || /yes|only/.test(tags['diet:vegan'] || '');
    if (brand) return norm(tags.brand || r.name).includes(norm(brand));
  }
  return false;
}

// ——— Moteurs ———
const localBox = (at) => places.filter((p) => Math.abs(p.lat - at.lat) < 0.032 && Math.abs(p.lon - at.lon) < 0.048);
const idxFile = indexPath || `${root}/search.json`;
const idx = existsSync(idxFile) ? prepare(JSON.parse(readFileSync(idxFile, 'utf8'))) : null;
// index découpé par zone (Île-de-France, 23/10) : l'essentiel + les zones autour du point, comme l'app
const zdir = `${root}/search`;
const zmeta = existsSync(`${zdir}/index.json`) ? JSON.parse(readFileSync(`${zdir}/index.json`, 'utf8')) : null;
const zcache = new Map();
const zload = (p) => { if (!zcache.has(p)) zcache.set(p, prepare(JSON.parse(readFileSync(`${zdir}/${p}.json`, 'utf8')))); return zcache.get(p); };
const asResult = (p) => ({ id: `${LETTER[p.id % 10]}${Math.floor(p.id / 10)}`, name: p.tags.name || '', lon: p.lon, lat: p.lat });
const engines = {
  async local(q, at) { return matchPlaces(localBox(at), q, at, 7); },
  // nouvelle recherche sur le téléphone : type de lieu (« pharmacie ») ou index des noms
  ...(idx ? { async index(q, at) {
    const f = intentOf(q);
    return f ? nearestOf(localBox(at), f, at, 7).map(asResult) : searchIndex(idx, q, at, 7);
  } } : {}),
  ...(zmeta ? { async zones(q, at) {
    const f = intentOf(q);
    if (f) return nearestOf(localBox(at), f, at, 7).map(asResult);
    const idxs = ['core', ...zonesAround(at, zmeta.zoom, zmeta.zones).map((k) => `${zmeta.zoom}/${k}`)].map(zload);
    return searchMany(idxs, q, at, 7);
  } } : {}),
  // mêmes paramètres que l'app (src/lib/geocode.js) ; curl passe par le proxy de l'environnement
  async photon(q, at) {
    const u = new URL('https://photon.komoot.io/api/');
    u.search = new URLSearchParams({ q, lang: 'fr', limit: '7', lat: String(at.lat), lon: String(at.lon), location_bias_scale: '0.4', bbox: '2.15,48.75,2.55,48.95' });
    let out = '';
    try { out = execFileSync('curl', ['-sS', '--max-time', '20', '-A', 'UntrackedMapsBot/0.1 (+https://untrackedmaps.app/confidentialite)', u.href], { encoding: 'utf8' }); } catch { return null; }
    try {
      return JSON.parse(out).features.map((f) => ({ id: `${f.properties.osm_type}${f.properties.osm_id}`, name: f.properties.name || '', osmKey: f.properties.osm_key,
        subclass: f.properties.osm_value, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
    } catch { return null; }
  }
};

const report = {};
for (const [name, engine] of Object.entries(engines).filter(([n]) => !only || n === only)) {
  const rows = [];
  for (const q of ref.queries) {
    const at = q.at || ref.at;
    const t0 = Date.now();
    const res = await engine(q.q, at);
    const ms = Date.now() - t0;
    if (!res) { rows.push({ ...q, error: true, ms }); continue; }
    const rank = res.findIndex((r) => isHit(q, r, at));
    rows.push({ q: q.q, group: q.group, rank, ms, top: res.slice(0, 3).map((r) => r.name) });
    if (name === 'photon') await new Promise((r) => setTimeout(r, 300));   // service partagé : on reste poli
  }
  report[name] = rows;
  const groups = [...new Set(rows.map((r) => r.group)), 'TOTAL'];
  console.log(`\n=== ${name} (${rows.length} recherches${rows.some((r) => r.error) ? `, ${rows.filter((r) => r.error).length} sans réponse` : ''}) ===`);
  console.log('groupe'.padEnd(11), 'n'.padStart(3), 'top 1'.padStart(7), 'top 3'.padStart(7));
  for (const g of groups) {
    const rs = rows.filter((r) => !r.error && (g === 'TOTAL' || r.group === g));
    const pct = (f) => `${Math.round((100 * rs.filter(f).length) / rs.length)} %`.padStart(7);
    console.log(g.padEnd(11), String(rs.length).padStart(3), pct((r) => r.rank === 0), pct((r) => r.rank >= 0 && r.rank < 3));
  }
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`temps médian ${ms[Math.floor(ms.length / 2)]} ms, le plus long ${ms.at(-1)} ms`);
  console.log('ratés :', rows.filter((r) => !r.error && r.rank !== 0).map((r) => `« ${r.q} »${r.rank > 0 ? ` (${r.rank + 1}e)` : ''} → ${r.top[0] || '∅'}`).join(' ; '));
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
