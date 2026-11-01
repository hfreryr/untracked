// « Mes lieux » : listes de lieux, transfert vers un autre appareil et sauvegarde.
// Tout reste sur l'appareil. Aucun serveur : le transfert passe par un lien dont les données sont
// après le « # » (jamais envoyé au site), la sauvegarde par un fichier que l'on range où l'on veut.
import { cleanReviewer } from '#lib/reviewer.js';
import { cleanCustoms, NAME_MAX } from '#lib/customshortcuts.js';
import { tx } from '#lib/i18n/index.js';

export const DEFAULT_LISTS = [
  { id: 'fav', name: tx('meslieux.favoris'), icon: 'heart', color: '#D63A7A' }
];   // (« À tester » retirée le 02/11/2026 : pas une liste par défaut de Plans ; listorder.js, dropEmptyTodo)
// Pictogrammes et couleurs proposés pour une nouvelle liste
export const LIST_ICONS = ['heart', 'flag', 'star', 'utensils', 'cup', 'bed', 'tree', 'bag', 'ticket', 'book'];
export const LIST_COLORS = ['#D63A7A', '#E0862F', '#2A5BD7', '#1E8E3E', '#7A4FC4', '#0E8A94', '#C7972B', '#5F6B7A'];

// Identifiant de liste unique, même pour plusieurs listes créées dans la même milliseconde.
// (Bug du 20/10 : l'import Google créait plusieurs listes au même identifiant, et l'écran « Mes lieux » plantait.)
let seq = 0;
export const newListId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
/** Répare des listes qui partagent un identifiant : la première le garde, les suivantes en reçoivent un nouveau. */
export function uniqueListIds(lists) {
  const seen = new Set();
  return lists.map((l) => {
    if (!seen.has(l.id)) { seen.add(l.id); return l; }
    let id = newListId();
    while (seen.has(id)) id = newListId();
    seen.add(id);
    return { ...l, id };
  });
}

/** Nom comparable : sans accents, majuscules, ponctuation ni article de tête (« Le Café de Flore » = « Café de Flore »). */
export function normName(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/^(le|la|les|l|the) /, '');
}
/**
 * Un même lieu : même identifiant OSM ; sinon (lieu importé de Google, sans identifiant), même nom à ~60 m près.
 * (Bug du 20/10 : un lieu importé n'apparaissait dans aucune liste sur la fiche du lieu OSM, faute d'identifiant.)
 */
export function sameSpot(a, b) {
  if (a.osmType && b.osmType) return a.osmType === b.osmType && String(a.osmId) === String(b.osmId);
  return normName(a.name) === normName(b.name) && Math.abs(a.lat - b.lat) < 0.00055 && Math.abs(a.lon - b.lon) < 0.0008;
}

/** Lieux enregistrés : chacun appartient à une ou plusieurs listes (anciens favoris → « Favoris »). */
export function migratePlaces(places) {
  return places.map((p) => (Array.isArray(p.lists) && p.lists.length ? p : { ...p, lists: ['fav'] }));
}

// ——— Encodage compact (lien) : JSON → deflate → base64url ———
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
export async function pack(obj) {
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream('deflate-raw'));
  // (btoa sur de gros tableaux : par morceaux)
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Garde-fous contre un lien ou un fichier piégé : tailles bornées, champs vérifiés un par un.
export const LIMITS = { link: 400_000, unpacked: 5_000_000, file: 10_000_000, places: 5000, lists: 200, text: 300 };
export async function unpack(str) {
  if (typeof str !== 'string' || str.length > LIMITS.link || !/^[\w-]+$/.test(str)) throw new Error('lien');
  const bytes = await pipe(unb64url(str), new DecompressionStream('deflate-raw'));
  if (bytes.length > LIMITS.unpacked) throw new Error('lien');
  return JSON.parse(new TextDecoder().decode(bytes));
}
const txt = (v, max = LIMITS.text) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
const color = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
const ICON = (v) => (typeof v === 'string' && /^[a-z]{2,12}$/.test(v) ? v : null);
const listId = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : null);
/** Un lieu reçu de l'extérieur, sous forme courte : null s'il est invalide. */
function cleanShort(a) {
  if (!Array.isArray(a)) return null;
  const lat = num(a[1], -90, 90), lon = num(a[2], -180, 180);
  if (lat == null || lon == null) return null;
  const osm = typeof a[3] === 'string' && /^[nwr]\d{1,12}$/.test(a[3]) ? a[3] : '';
  const lists = Array.isArray(a[4]) ? a[4].map(listId).filter(Boolean).slice(0, 50) : [];
  return [txt(a[0]) || tx('fiche.lieu'), lat, lon, osm, lists, txt(a[5]), txt(a[6], 80)];
}
function cleanLists(ls) {
  if (!Array.isArray(ls)) return null;
  return ls.slice(0, LIMITS.lists).map((l) => l && listId(l.id) && { id: l.id, name: txt(l.name, 60) || tx('meslieux.liste'), icon: ICON(l.icon) || 'star', color: color(l.color) || '#2A5BD7' }).filter(Boolean);
}

// Un lieu en tableau court : [nom, lat, lon, osm, listes, adresse, type]
const short = (p) => [p.name, +p.lat.toFixed(6), +p.lon.toFixed(6), p.osmType ? `${p.osmType[0]}${p.osmId}` : '', p.lists || [], p.address || '', p.type || ''];
const long = ([name, lat, lon, osm, lists, address, type]) => {
  const t = { n: 'node', w: 'way', r: 'relation' }[osm?.[0]];
  return { id: t ? `${t}${osm.slice(1)}` : `s${lat},${lon}`, name, lat, lon, lists: lists || ['fav'], address: address || '', type: type || '',
    ...(t ? { osmType: t, osmId: Number(osm.slice(1)) } : {}) };
};

/** Une liste à partager : nom, pictogramme, couleur et lieux. */
export const packList = (list, places) => pack({ v: 1, l: { n: list.name, i: list.icon, c: list.color }, p: places.map((p) => short({ ...p, lists: [] })) });
export async function unpackList(str) {
  const o = await unpack(str);
  if (!o?.l || !Array.isArray(o.p)) throw new Error('lien');
  return { list: { name: txt(o.l.n, 60) || tx('meslieux.liste_partagee'), icon: ICON(o.l.i) || 'star', color: color(o.l.c) || '#2A5BD7' },
    places: o.p.slice(0, LIMITS.places).map(cleanShort).filter(Boolean).map(long) };
}

/** Tout « Mes lieux » (listes, lieux, Maison/Travail, épinglés, raccourcis). */
export function snapshot({ lists, places, shortcuts, pins, chips, customs, reviewer }) {
  return { v: 1, app: tx('meslieux.untracked_maps'), date: new Date().toISOString(), lists,
    p: places.map(short), s: Object.fromEntries(Object.entries(shortcuts || {}).filter(([, v]) => v).map(([k, v]) => [k, short(v)])),
    pins: pins || [], chips: chips || [],
    // raccourcis personnels : nom, icône, adresse (absente tant qu'elle n'est pas choisie)
    c: (customs || []).map((c) => ({ n: c.name, i: c.icon, p: c.place ? short({ ...c.place, lists: [] }) : null })),
    // auteur des avis (reviewer.js) : sa clé, pour modifier ses avis depuis l'autre appareil, et ses avis
    ...(reviewer?.jwk ? { r: reviewer } : {}) };
}
export function restore(o) {
  if (!o || typeof o !== 'object') throw new Error('format');
  const s = o.s && typeof o.s === 'object' ? o.s : {};
  return { lists: cleanLists(o.lists)?.length ? cleanLists(o.lists) : DEFAULT_LISTS,
    places: (Array.isArray(o.p) ? o.p : []).slice(0, LIMITS.places).map(cleanShort).filter(Boolean).map(long),
    shortcuts: Object.fromEntries(['home', 'work'].map((k) => [k, cleanShort(s[k])]).filter(([, v]) => v).map(([k, v]) => [k, long(v)])),
    pins: Array.isArray(o.pins) ? o.pins.filter((x) => typeof x === 'string').slice(0, LIMITS.places) : [],
    customs: cleanCustoms((Array.isArray(o.c) ? o.c : []).map((c) => ({ name: txt(c?.n, NAME_MAX), icon: c?.i,
      place: c?.p && cleanShort(c.p) ? long(cleanShort(c.p)) : null }))),
    chips: Array.isArray(o.chips) ? o.chips.filter((c) => c && typeof c.key === 'string' && /^[\w-]{1,30}$/.test(c.key))
      .map((c) => ({ key: c.key, ...(c.hidden ? { hidden: true } : {}), ...(typeof c.label === 'string' ? { label: c.label.slice(0, 20) } : {}) })).slice(0, 60) : [],
    reviewer: o.r ? cleanReviewer(o.r) : null };
}

// ——— Sauvegarde dans un fichier, protégée par un mot de passe si on le souhaite ———
async function keyFrom(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function backupFile(data, password) {
  let body = { format: 'untracked-maps-sauvegarde', ...data };
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), new TextEncoder().encode(JSON.stringify(data))));
    body = { format: 'untracked-maps-sauvegarde', chiffre: true, salt: b64url(salt), iv: b64url(iv), data: b64url(enc) };
  }
  const day = new Date().toISOString().slice(0, 10);
  return new File([JSON.stringify(body)], `untracked-maps-mes-lieux-${day}.json`, { type: 'application/json' });
}
/** @returns {Promise<{data?:object, needsPassword?:boolean}>} */
export async function readBackup(file, password) {
  if (file.size > LIMITS.file) throw new Error('taille');
  const o = JSON.parse(await file.text());
  if (o.format !== 'untracked-maps-sauvegarde') throw new Error('format');
  if (!o.chiffre) return { data: o };
  if (!password) return { needsPassword: true };
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64url(o.iv) }, await keyFrom(password, unb64url(o.salt)), unb64url(o.data));
  return { data: JSON.parse(new TextDecoder().decode(plain)) };
}

/** Fusion : on ajoute ce qui manque, on réunit les listes d'un même lieu. */
export function mergeInto(cur, inc, same) {
  const lists = [...cur.lists];
  const idMap = {};
  for (const l of inc.lists) {
    const found = lists.find((x) => x.id === l.id || x.name.toLowerCase() === l.name.toLowerCase());
    if (found) idMap[l.id] = found.id;
    else { const id = lists.some((x) => x.id === l.id) ? newListId() : l.id; lists.push({ ...l, id }); idMap[l.id] = id; }
  }
  const places = cur.places.map((p) => ({ ...p }));
  let added = 0;
  for (const p of inc.places) {
    const ls = (p.lists || ['fav']).map((x) => idMap[x] || x);
    const ex = places.find((q) => same(q, p));
    if (ex) ex.lists = [...new Set([...(ex.lists || []), ...ls])];
    else { places.push({ ...p, lists: ls }); added++; }
  }
  return { lists: uniqueListIds(lists), places, added };
}
