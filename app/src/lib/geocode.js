// Recherche par texte et adresse d'un point : une seule interface, plusieurs fournisseurs selon le pays.
//
//  - Adresses en France : géocodeur de l'État (Géoplateforme / Base Adresse Nationale), service public,
//    accès ouvert, 50 requêtes/s par adresse IP. Rapide (≈ 0,4 s mesuré).
//  - Noms de lieux (commerces, monuments) : Photon (instance publique de komoot, « usage raisonnable »),
//    à remplacer par notre propre instance avant tout lancement public.
//
// Ce qui est envoyé : le texte tapé et un point de référence (centre de la carte ou position), rien d'autre.
import { covered, hasPlaces, inFrance, streetLine } from '#lib/searchscope.js';
import { looksLikeStreet, matchesQuery, rankAddresses, townAt, withTown } from '#lib/addressnear.js';
import { tx } from '#lib/i18n/index.js';
import { city } from './cities/index.js';
import { typeLabel, typeOfTags } from './places.js';
import { searchLocal } from './localsearch.js';
import { norm } from './searchindex.js';
import { indexesAt, searchMany } from './searchzones.js';
import { directoryFor } from './directory.js';
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
    city: p.city,
    lat, lon,
    score: p.score
  };
}

// Photon est un service public gratuit : il peut être en panne ou très lent (constaté le 14/10/2026).
// Au-delà de ce délai, on cherche dans nos propres données.
const PHOTON_TIMEOUT = 4000;
const PHOTON_TIMEOUT_ALONE = 10000;

/** Photon, ou à défaut nos données de lieux (même forme de résultats). */
async function byName(query, near, signal, limit = 7, anywhere = false) {
  const ctl = new AbortController();
  // là où nous n'avons pas de données, pas de repli possible : on laisse à Photon le temps de répondre
  const timer = setTimeout(() => ctl.abort(), hasPlaces(near) ? PHOTON_TIMEOUT : PHOTON_TIMEOUT_ALONE);
  signal?.addEventListener('abort', () => ctl.abort());
  try {
    const r = await photon(query, near, ctl.signal, limit, anywhere);
    return r.length || !hasPlaces(near) ? r : (await searchLocal(query, near)).slice(0, limit);
  } catch (e) {
    if (signal?.aborted) throw e;                       // recherche remplacée par une plus récente
    return hasPlaces(near) ? (await searchLocal(query, near)).slice(0, limit) : [];   // nos données, là où il y en a
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

async function geopfRaw(query, near, signal, limit) {
  const url = new URL(`${GEOPF}/search`);
  url.search = new URLSearchParams({ q: query, index: 'address', limit: String(limit), lat: String(near.lat), lon: String(near.lon) });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Géoplateforme ${res.status}`);
  return (await res.json()).features.map(fromGeopf).filter((r) => r.score == null || r.score > 0.4);
}

/** Commune d'un point, selon le géocodeur de l'État. */
async function townOf(lat, lon) {
  const r = await fetch(`${GEOPF}/reverse?lon=${lon}&lat=${lat}&index=address&limit=1`);
  return r.ok ? (await r.json()).features[0]?.properties?.city || null : null;
}

async function geopf(query, near, signal, limit = 5) {
  // partout en France, Île-de-France comprise : le texte seul et « texte + commune de la carte », puis classement
  // par pertinence, la proximité ne départageant que des réponses équivalentes (addressnear.js)
  const plainP = geopfRaw(query, near, signal, 10);
  const town = await townAt(near, townOf);
  const q2 = withTown(query, town);
  const [plain, inTown] = await Promise.all([plainP, q2 ? geopfRaw(q2, near, signal, limit).catch(() => []) : []]);
  return rankAddresses(query, plain, inTown, town, near).slice(0, limit);
}

const near = (a, b) => Math.hypot((a.lon - b.lon) * 0.66, a.lat - b.lat) * 111320 < 40;

// ——— Recherche sur le téléphone (index préparé chaque nuit, scripts/build_search.py) ———
// Mesurée sur 144 recherches de référence (tests/search) : 90 % de bonnes réponses en premier contre 76 % pour Photon,
// en 0,02 s au lieu de 1,5 s. Photon reste consulté pour ce que l'index n'a pas (rues, quartiers).
// Index découpé par zone (searchzones.js) : l'essentiel de la région + les zones autour de « at ».
const index = (at = city.center) => indexesAt(dataBase(), at);
// plus l'annuaire national (directory.js) : les lieux loin de sa région (« Gordes » vu de Paris)
const indexFor = async (query, at) => (await Promise.all([index(at), directoryFor(dataBase(), query)])).flat();
/** Charge l'index autour de `at` dès que l'on touche la barre de recherche. */
export const warmSearch = (at) => { index(at || city.center); };

const LETTERS = { 1: ['node', 'N'], 2: ['way', 'W'], 3: ['relation', 'R'] };
function fromTile(p) {
  const [osmType, letter] = LETTERS[p.id % 10] || LETTERS[1];
  const osmId = Math.floor(p.id / 10), t = p.tags;
  const street = streetLine(t, p);
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
  // là où nous n'avons pas de données (hors de France, sauf Amsterdam) : Photon seul, autour du point, sans cadre
  if (!hasPlaces(at)) return byName(query, at, signal, limit, true);
  if (intent) {
    const r = await byIntent(intent, at, limit);
    if (r.length) return r;
  }
  const idx = await indexFor(query, at);
  const mine = searchMany(idx, query, at, limit);
  const strong = mine.filter((r) => r.strong);
  if (strong.length) onEarly?.(strong);
  let others = [];
  try {
    others = await byName(query, at, signal, limit, !covered(at));   // hors Île-de-France : sans le cadre de la ville
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
  if (inFrance(at) && looksLikeAddress(q)) {
    // l'adresse d'abord (rapide) ; Photon n'est consulté que si l'adresse n'est pas nette (un nom de commerce avec un chiffre…)
    const a = await geopf(q, at, signal).catch(() => []);
    // nette : l'adresse exacte, ou une rue qui contient tout ce qui a été tapé (« 2 place du château Gordes » : la place)
    const top = a[0];
    if (top && !top.area && ((top.type === tx('fiche.adresse') && top.score > 0.8) || matchesQuery(q, top))) return a.slice(0, 5);
    const p = await findByName(q, at, signal, 5).catch(() => []);
    const places = p.filter((r) => r.type !== tx('fiche.adresse') && !a.some((x) => near(x, r)));
    return [...a.slice(0, 1), ...places.slice(0, 3), ...a.slice(1)].slice(0, 7);
  }
  if (inFrance(at) && looksLikeStreet(q)) return streetOrPlaces(q, at, signal, onEarly);
  return findByName(q, at, signal, 7, onEarly);
}

/**
 * « rue Paradis Marseille », « place des Vosges » : la rue, par le géocodeur de l'État (rapide et complet en France),
 * montrée dès qu'elle arrive, avec les lieux de même nom ; Photon complète sans être attendu pour la rue.
 * Une rue n'est retenue que si elle contient tout ce qui a été tapé (« café de la place » reste un café).
 */
async function streetOrPlaces(q, at, signal, onEarly) {
  let streets = [], mine = [];
  const show = () => onEarly?.([...streets, ...mine.filter((r) => !streets.some((s) => near(s, r)))].slice(0, 7));
  const aP = geopf(q, at, signal).catch(() => []).then((a) => {
    streets = a.filter((r) => !r.area && r.score > 0.5 && matchesQuery(q, r));
    if (streets.length) show();
    return a;
  });
  const p = await findByName(q, at, signal, 7, (r) => { mine = r; if (streets.length) show(); else onEarly?.(r); }).catch(() => []);
  const a = await aP;
  const extra = a.filter((x) => !x.area && !streets.includes(x));
  const others = p.filter((r) => ![...streets, ...extra].some((s) => near(s, r)));
  return (streets.length ? [...streets.slice(0, 3), ...others, ...extra] : [...others, ...extra]).slice(0, 7);
}

/** Lieux portant ce nom, partout (proches de « at » d'abord) : pour retrouver un lieu importé dont on n'a que le nom. */
export const searchAnywhere = (query, at = city.center, signal) => byName(query.trim(), at, signal, 7, true);

/**
 * Recherche pour l'import des listes Google (des dizaines de noms d'affilée) : Photon, sans limite de zone, avec
 * plusieurs essais espacés. Photon public refuse une grande partie des demandes quand elles arrivent vite (mesuré le
 * 31/10/2026 sur une liste de 137 lieux, 4 à la fois : 67 refus « 503 » et 7 délais dépassés) ; un import réel n'avait
 * retrouvé que 5 lieux sur 137. Pas de repli sur nos données (il donnerait un homonyme parisien pour un lieu en Norvège).
 * @returns {Promise<object[]>} les résultats ([] : vraiment introuvable) ; lève une erreur si Photon n'a jamais répondu
 */
export async function searchForImport(query, at = city.center, { tries = 4, wait = (ms) => new Promise((r) => setTimeout(r, ms)), call = photon } = {}) {
  for (let k = 0; ; k++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), PHOTON_TIMEOUT_ALONE);
    try {
      return await call(query.trim(), at, ctl.signal, 7, true);
    } catch (e) {
      if (k + 1 >= tries) throw e;
      await wait(2000 * 2 ** k);   // 2 s, 4 s, 8 s
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Un lieu (pas une adresse, une rue ou une zone) : ceux-là seuls se montrent tous ensemble sur la carte. */
export const isPlaceResult = (r) => !!r && !r.area && !String(r.id).startsWith('ban:') && r.type !== tx('fiche.adresse') && r.type !== tx('resultats.rue');

/**
 * Touche Entrée : tous les lieux qui portent ce nom autour de « at » (jusqu'à `limit`), cherchés sur le téléphone,
 * réunis avec ceux déjà affichés (Photon compris), les plus proches d'abord.
 */
export async function searchAllPlaces(query, at, shown = [], limit = 40) {
  if (!hasPlaces(at)) return shown.filter(isPlaceResult).slice(0, limit);   // rien de plus dans nos données
  const idx = await index(at);
  // l'index classe par pertinence sur toute la zone : on en prend large, puis on garde les plus proches
  const mine = searchMany(idx, query.trim(), at, limit * 10);
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
  if (!hasPlaces(at)) return null;
  const idx = await indexFor(query.trim(), at);
  return searchMany(idx, query.trim(), at, 1)[0] || null;
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
