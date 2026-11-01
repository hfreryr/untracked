// Ce que chaque avis garde, en plus de la note, pour les badges et la carte de mes avis (badges.js) : position du lieu,
// genre (restaurant, café…), commune et code postal. Tout reste sur le téléphone.
// La commune vient de la fiche (OSM) ou, à défaut, du géocodeur de l'État (déjà utilisé pour la recherche d'adresses) ;
// hors de France, seulement si OSM la donne.
import { kindOf } from './badges.js';
import { inFrance } from './searchscope.js';

const GEOPF = 'https://data.geopf.fr/geocodage';

/** Commune et code postal d'un point (géocodeur de l'État), ou {}. */
export async function townOfPoint(lat, lon, get = fetch) {
  if (!inFrance({ lat, lon })) return {};
  const r = await get(`${GEOPF}/reverse?lon=${lon}&lat=${lat}&index=address&limit=1`).catch(() => null);
  const p = r?.ok ? (await r.json().catch(() => null))?.features?.[0]?.properties : null;
  return p ? { city: p.city || undefined, pc: p.postcode || undefined } : {};
}

/**
 * Informations d'un avis sur `place` (lat, lon, subclass), avec la fiche `info` (places.js, fromTags) si elle est chargée.
 * @returns {Promise<{lat:number, lon:number, kind?:string, city?:string, pc?:string}>}
 */
export async function reviewMeta(place, info = null, get = fetch) {
  const pcIn = /\b(\d{5})\b/.exec(info?.address || place.address || '')?.[1];
  const m = { lat: +place.lat, lon: +place.lon, kind: kindOf(info?.subclass || place.subclass) || undefined,
    city: info?.city || undefined, pc: info?.postcode || pcIn || undefined };
  if (!m.city) Object.assign(m, Object.fromEntries(Object.entries(await townOfPoint(m.lat, m.lon, get)).filter(([, v]) => v)));
  for (const k of Object.keys(m)) if (m[k] === undefined) delete m[k];
  return m;
}

/** Avis à compléter (enregistrés avant le 01/11/2026, sans position ni genre de lieu). */
export const missingMeta = (mine) => mine.filter((r) => r.lat == null || (r.kind == null && r.city == null));
