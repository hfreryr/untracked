// Recherche par texte et adresse d'un point : une seule interface, plusieurs fournisseurs selon le pays.
//
//  - Adresses en France : géocodeur de l'État (Géoplateforme / Base Adresse Nationale), service public,
//    accès ouvert, 50 requêtes/s par adresse IP. Rapide (≈ 0,4 s mesuré).
//  - Noms de lieux (commerces, monuments) : Photon (instance publique de komoot, « usage raisonnable »),
//    à remplacer par notre propre instance avant tout lancement public.
//
// Ce qui est envoyé : le texte tapé et un point de référence (centre de la carte ou position), rien d'autre.
import { tx } from '#lib/i18n/index.js';
import { city } from './cities/index.js';
import { typeLabel, typeOfTags } from './places.js';
import { searchLocal } from './localsearch.js';
import { loadIndex, searchIndex, norm } from './searchindex.js';
import { intentOf, nearestOf } from './searchintent.js';
import { placesInBounds } from './placestore.js';
import { dataBase } from './config.js';

const PHOTON = 'https://photon.komoot.io';
const GEOPF = 'https://data.geopf.fr/geocodage';

const looksLikeAddress = (q) => /\d/.test(q) && !/\b(ligne|bus|rer|tram|m\d{1,2})\b/i.test(q);

function fromPhoton(f) {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  const isAddress = !p.name;
  const line = [p.housenumber, p.street].filter(Boolean).join(' ');
  const where = p.postcode ? `${p.postcode} ${p.city || ''}`.trim() : p.district || p.city;
  const addr = [line, where].filter(Boolean).join(', ');
  return {
    id: `${p.osm_type}${p.osm_id}`,
    osmType: { N: 'node', W: 'way', R: 'relation' }[p.osm_type],
    osmId: p.osm_id,
    name: p.name || addr,
    type: isAddress ? tx('fiche.adresse') : typeLabel(p.osm_key, p.osm_value),
    subclass: isAddress ? null : p.osm_value,
    area: p.osm_key === 'place' && ['suburb', 'quarter', 'neighbourhood', 'city_district', 'city', 'town', 'village'].includes(p.osm_value),
    address: isAddress ? [p.postcode, p.city].filter(Boolean).join(' ') : addr,
    lat, lon
  };
}

function fromGeopf(f) {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  const street = p.type === 'street' || p.type === 'locality';
  if (p.type === 'municipality') {
    // ville ou arrondissement : une zone, pas un lieu (la carte s'y cadre, les raccourcis restent disponibles)
    return { id: `ban:${p.id}`, name: p.name, type: tx('resultats.ville_ou_arrondissement'), subclass: null, address: p.postcode || '',
      lat, lon, score: p.score, area: true };
  }
  return {
    id: `ban:${p.id}`,
    name: street ? `${p.name}, ${p.postcode} ${p.city}` : `${p.name}, ${p.postcode} ${p.city}`,
    type: street ? tx('resultats.rue') : tx('fiche.adresse'),
    subclass: null,
    address: `${p.postcode} ${p.city}`,
    lat, lon,
    score: p.score
  };
}

// Photon est un service public gratuit : il peut être en panne ou très lent (constaté le 14/10/2026).
// Au-delà de ce délai, on cherche dans nos propres données.
const PHOTON_TIMEOUT = 4000;

/** Photon, ou à défaut nos données de lieux (même forme de résultats). */
async function byName(query, near, signal, limit = 7, anywhere = false) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PHOTON_TIMEOUT);
  signal?.addEventListener('abort', () => ctl.abort());
  try {
    const r = await photon(query, near, ctl.signal, limit, anywhere);
    return r.length ? r : (await searchLocal(query, near)).slice(0, limit);
  } catch (e) {
    if (signal?.aborted) throw e;                       // recherche remplacée par une plus récente
    return (await searchLocal(query, near)).slice(0, limit);
  } finally {
    clearTimeout(timer);
  }
}

async function photon(query, near, signal, limit = 7, anywhere = false) {
  const url = new URL(`${PHOTON}/api/`);
  const params = { q: query, lang: 'fr', limit: String(limit), lat: String(near.lat), lon: String(near.lon), location_bias_scale: '0.4' };
  // « anywhere » : sans limite à la zone de la ville (lieux importés d'une liste de voyage, par exemple)
  url.search = new URLSearchParams(anywhere ? params : { ...params, bbox: city.searchBbox.join(',') });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const seen = new Set();
  return (await res.json()).features
    .filter((f) => { const id = `${f.properties.osm_type}${f.properties.osm_id}`; return !seen.has(id) && seen.add(id); })
    .map(fromPhoton);
}

async function geopf(query, near, signal, limit = 5) {
  const url = new URL(`${GEOPF}/search`);
  url.search = new URLSearchParams({ q: query, index: 'address', limit: String(limit), lat: String(near.lat), lon: String(near.lon) });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Géoplateforme ${res.status}`);
  const all = (await res.json()).features.map(fromGeopf).filter((r) => r.score == null || r.score > 0.4);
  // la zone de la ville d'abord (le géocodeur est national) ; ailleurs seulement si rien ici
  const [w, s, e, n] = city.searchBbox;
  const here = all.filter((r) => r.lon > w && r.lon < e && r.lat > s && r.lat < n);
  return here.length ? here : all;
}

const near = (a, b) => Math.hypot((a.lon - b.lon) * 0.66, a.lat - b.lat) * 111320 < 40;

// ——— Recherche sur le téléphone (index préparé chaque nuit, scripts/build_search.py) ———
// Mesurée sur 144 recherches de référence (tests/search) : 90 % de bonnes réponses en premier contre 76 % pour Photon,
// en 0,02 s au lieu de 1,5 s. Photon reste consulté pour ce que l'index n'a pas (rues, quartiers).
const index = () => loadIndex(() => fetch(`${dataBase()}places/search.json`).then((r) => (r.ok ? r.json() : null)));
/** Charge l'index dès que l'on touche la barre de recherche (≈ 1,6 Mo compressé, une fois). */
export const warmSearch = () => { index(); };

const LETTERS = { 1: ['node', 'N'], 2: ['way', 'W'], 3: ['relation', 'R'] };
function fromTile(p) {
  const [osmType, letter] = LETTERS[p.id % 10] || LETTERS[1];
  const osmId = Math.floor(p.id / 10), t = p.tags;
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  return { id: `${letter}${osmId}`, osmType, osmId, name: t.name || typeOfTags(t) || '', type: typeOfTags(t) || '',
    subclass: t.amenity || t.shop || t.tourism || t.leisure || null, address: [street, t['addr:postcode']].filter(Boolean).join(', '), lat: p.lat, lon: p.lon };
}

/** « pharmacie », « restaurant italien », « vegan » : les plus proches de ce type, dans nos tuiles. */
async function byIntent(filter, at, limit) {
  const dLat = 0.032, dLon = 0.048;
  const places = await placesInBounds({ west: at.lon - dLon, east: at.lon + dLon, south: at.lat - dLat, north: at.lat + dLat }, 9).catch(() => []);
  return nearestOf(places, filter, at, limit).map(fromTile);
}

// même lieu vu par deux moteurs : même identifiant, ou même nom tout près
const sameAs = (a, b) => a.id === b.id || (Math.hypot((a.lon - b.lon) * 0.66, a.lat - b.lat) * 111320 < 250 && norm(a.name) === norm(b.name));

/**
 * Lieux par leur nom : d'abord sur le téléphone (instantané), puis Photon pour ce que l'index n'a pas.
 * onEarly(résultats) : appelé tout de suite avec les résultats du téléphone quand ils sont nets, sans attendre Photon.
 */
async function findByName(query, at, signal, limit = 7, onEarly = null) {
  const intent = intentOf(query);
  if (intent) {
    const r = await byIntent(intent, at, limit);
    if (r.length) return r;
  }
  const idx = await index();
  const mine = idx ? searchIndex(idx, query, at, limit) : [];
  const strong = mine.filter((r) => r.strong);
  if (strong.length) onEarly?.(strong);
  let others = [];
  try {
    others = await byName(query, at, signal, limit);
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  // nos résultats nets d'abord, puis ce que Photon ajoute (rues, quartiers, lieux absents de nos données)
  const extra = others.filter((o) => !mine.some((m) => sameAs(m, o)));
  return (strong.length ? [...strong, ...extra] : [...extra, ...mine]).slice(0, limit);
}

/**
 * Lieux et adresses correspondant au texte, les plus pertinents d'abord.
 * Une adresse (texte avec un numéro) part d'abord au géocodeur de l'État ; les noms vont à Photon.
 */
export async function search(query, at = city.center, signal, onEarly = null) {
  const q = query.trim();
  if (!q) return [];
  if (city.country === 'FR' && looksLikeAddress(q)) {
    // l'adresse d'abord (rapide) ; Photon n'est consulté que si l'adresse n'est pas nette (un nom de commerce avec un chiffre…)
    const a = await geopf(q, at, signal).catch(() => []);
    if (a[0]?.type === 'Adresse' && a[0].score > 0.8) return a.slice(0, 5);
    const p = await findByName(q, at, signal, 5).catch(() => []);
    const places = p.filter((r) => r.type !== 'Adresse' && !a.some((x) => near(x, r)));
    return [...a.slice(0, 1), ...places.slice(0, 3), ...a.slice(1)].slice(0, 7);
  }
  return findByName(q, at, signal, 7, onEarly);
}

/** Lieux portant ce nom, partout (proches de « at » d'abord) : pour retrouver un lieu importé dont on n'a que le nom. */
export const searchAnywhere = (query, at = city.center, signal) => byName(query.trim(), at, signal, 7, true);

/** Un lieu (pas une adresse, une rue ou une zone) : ceux-là seuls se montrent tous ensemble sur la carte. */
export const isPlaceResult = (r) => !!r && !r.area && !String(r.id).startsWith('ban:') && r.type !== tx('fiche.adresse') && r.type !== tx('resultats.rue');

/**
 * Touche Entrée : tous les lieux qui portent ce nom autour de « at » (jusqu'à `limit`), cherchés sur le téléphone,
 * réunis avec ceux déjà affichés (Photon compris), les plus proches d'abord.
 */
export async function searchAllPlaces(query, at, shown = [], limit = 40) {
  const idx = await index();
  // l'index classe par pertinence sur tout Paris : on en prend large, puis on garde les plus proches
  const mine = idx ? searchIndex(idx, query.trim(), at, limit * 10) : [];
  const all = [...shown.filter(isPlaceResult)];
  for (const r of mine) if (isPlaceResult(r) && !all.some((a) => sameAs(a, r))) all.push(r);
  const d = (r) => Math.hypot((r.lon - at.lon) * Math.cos((at.lat * Math.PI) / 180), r.lat - at.lat);
  // assez de lieux portent vraiment ce nom : on écarte les rapprochements dus aux fautes tolérées
  // (« Société générale » ne doit pas donner « Société de l'Industrie Minérale », retour du 21/10)
  const words = norm(query).split(' ').filter((w) => w.length > 1);
  const exact = all.filter((r) => { const n = norm(r.name); return words.every((w) => n.includes(w)); });
  return (exact.length >= 2 ? exact : all).sort((a, b) => d(a) - d(b)).slice(0, limit);
}

/** Premier résultat de l'index du téléphone (instantané), pour décider vite ce que fait la touche Entrée. */
export async function localFirst(query, at) {
  const idx = await index();
  return idx ? searchIndex(idx, query.trim(), at, 1)[0] || null : null;
}

/** Adresse la plus proche d'un point (nom de rue ou lieu). */
export async function reverse(lat, lon) {
  if (city.country === 'FR') {
    const r = await fetch(`${GEOPF}/reverse?lon=${lon}&lat=${lat}&index=address&limit=1`).catch(() => null);
    const p = r?.ok ? (await r.json()).features?.[0]?.properties : null;
    if (p) return p.name;
  }
  const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lon}&lang=fr&limit=1`).catch(() => null);
  const p = res?.ok ? (await res.json()).features?.[0]?.properties : null;
  if (!p) return null;
  const line = [p.housenumber, p.street].filter(Boolean).join(' ');
  return p.name && !p.housenumber ? p.name : line || p.name || null;
}

/** Adresse postale complète d'un point : « 57 Rue de Rennes, 75006 Paris ». */
export async function reverseAddress(lat, lon) {
  if (city.country === 'FR') {
    const r = await fetch(`${GEOPF}/reverse?lon=${lon}&lat=${lat}&index=address&limit=1`).catch(() => null);
    const p = r?.ok ? (await r.json()).features?.[0]?.properties : null;
    if (p) return `${p.name}, ${p.postcode} ${p.city}`;
  }
  const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lon}&lang=fr&limit=1&layer=house&layer=street`).catch(() => null);
  const p = res?.ok ? (await res.json()).features?.[0]?.properties : null;
  if (!p) return null;
  const line = p.housenumber ? [p.housenumber, p.street].filter(Boolean).join(' ') : p.street || p.name;
  const where = [p.postcode, p.city].filter(Boolean).join(' ');
  return line ? [line, where].filter(Boolean).join(', ') : null;
}
