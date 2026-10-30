// Recherche de secours dans nos propres données de lieux (tuiles préparées chaque nuit), quand Photon
// ne répond pas ou trop lentement. Rien n'est envoyé : la recherche se fait sur le téléphone.
import { streetLine } from '#lib/searchscope.js';
import { placesInBounds } from './placestore.js';
import { typeOfTags } from './places.js';

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const TYPES = { 1: ['node', 'N'], 2: ['way', 'W'], 3: ['relation', 'R'] };

/**
 * Lieux dont le nom contient tous les mots tapés, les plus pertinents d'abord
 * (nom qui commence par la recherche, puis le plus proche du point de référence).
 * @param {{id:number, lon:number, lat:number, tags:object}[]} places  @param {string} query  @param {{lat:number, lon:number}} at
 */
export function matchPlaces(places, query, at, limit = 7) {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const q = words.join(' ');
  const k = Math.cos((at.lat * Math.PI) / 180);
  const hits = [];
  for (const p of places) {
    const n = norm(p.tags?.name);
    if (!n || !words.every((w) => n.includes(w))) continue;
    const d = Math.hypot((p.lon - at.lon) * k, p.lat - at.lat);
    hits.push({ p, score: (n === q ? 0 : n.startsWith(q) ? 1 : 2) * 3 + d * 100 });   // ~1 km ≈ 1 point
  }
  hits.sort((a, b) => a.score - b.score);
  return hits.slice(0, limit).map(({ p }) => {
    const [osmType, letter] = TYPES[p.id % 10] || TYPES[1];
    const osmId = Math.floor(p.id / 10);
    const t = p.tags;
    const street = streetLine(t, p);
    return { id: `${letter}${osmId}`, osmType, osmId, name: t.name, type: typeOfTags(t) || '', subclass: t.amenity || t.shop || t.tourism || null,
      address: [street, t['addr:postcode']].filter(Boolean).join(', '), lat: p.lat, lon: p.lon };
  });
}

/** Les tuiles autour du point de référence (environ 7 km de côté), puis la correspondance par nom. */
export async function searchLocal(query, at) {
  const dLat = 0.032, dLon = 0.048;
  const places = await placesInBounds({ west: at.lon - dLon, east: at.lon + dLon, south: at.lat - dLat, north: at.lat + dLat }, 9).catch(() => []);
  return matchPlaces(places, query, at);
}
