// Liens de lieux reçus de Google Maps ou de Plans (Apple), collés dans la recherche ou partagés vers l'app
// (porteur, 01/11/2026 : « un utilisateur va continuer à recevoir des liens Google Maps ou Plans »).
// On lit ce que le lien contient en clair (nom, position, adresse) ; rien n'est demandé à Google ni à Apple.
// Les liens courts (maps.app.goo.gl, maps.apple/p) ne disent rien du lieu : seule une vraie app pourra les lire.
import { coordsFromUrl } from './importgoogle.js';

const URL_RE = /https?:\/\/[^\s<>"]+[^\s<>"'.,;:!?)]/i;   // (sans la ponctuation qui suit un lien dans une phrase)
const SHORT = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\/p)\b/i;
const GOOGLE = /^https?:\/\/(www\.|maps\.)?google\.[a-z.]+\/(maps|\?)/i;
const GOOGLE_HOST = /^https?:\/\/maps\.google\.[a-z.]+/i;
const APPLE = /^https?:\/\/maps\.apple\.com\b/i;

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const dec = (s) => { try { return clean(decodeURIComponent((s || '').replace(/\+/g, ' '))); } catch { return clean(s); } };
const latLon = (s) => {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(s || '');
  return m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180 ? { lat: +m[1], lon: +m[2] } : null;
};

/** Le texte contient-il un lien de lieu Google ou Apple ? (texte partagé : « Café de Flore https://… ») */
export function isMapLink(text) {
  const u = URL_RE.exec(text || '')?.[0] || '';
  return SHORT.test(u) || GOOGLE.test(u) || GOOGLE_HOST.test(u) || APPLE.test(u);
}

/**
 * Ce que dit le lien : { name, lat, lon, address } (chacun peut manquer), ou { short: true } pour un lien court.
 * `rest` : le texte autour du lien (souvent le nom du lieu, dans un partage), sans le lien.
 * @returns {null | { short?: boolean, name?: string, lat?: number, lon?: number, address?: string, rest: string }}
 */
export function parseMapLink(text) {
  const u = URL_RE.exec(text || '')?.[0];
  if (!u || !isMapLink(u)) return null;
  const rest = clean((text || '').replace(u, ' '));
  if (SHORT.test(u)) return { short: true, rest };
  let url;
  try { url = new URL(u); } catch { return null; }
  const p = url.searchParams;
  const out = { rest };
  if (APPLE.test(u)) {
    // maps.apple.com/place?coordinate=…&name=…&address=… ; ancien format ?q=…&ll=…&address=… ; /search?query=…&center=…
    Object.assign(out, latLon(p.get('coordinate')) || latLon(p.get('ll')) || latLon(p.get('sll')) || latLon(p.get('q')) || {});
    const q = p.get('name') || p.get('q') || p.get('query') || p.get('daddr') || '';
    if (q && !latLon(q)) out.name = clean(q);
    if (p.get('address')) out.address = clean(p.get('address'));
  } else {
    // google.com/maps/place/Nom/@lat,lon/…!3d…!4d… ; ?q=… ; /maps/search/?api=1&query=… ; /maps/dir/…/Nom
    const c = coordsFromUrl(u);
    if (c) Object.assign(out, c);
    const seg = /\/maps\/place\/([^/@?]+)/.exec(url.pathname)?.[1];
    const q = p.get('q') || p.get('query') || p.get('destination') || '';
    const name = seg ? dec(seg) : !latLon(q) && q ? clean(q) : '';
    if (name && !latLon(name)) {
      // « Café de Flore, 172 Bd Saint-Germain, 75006 Paris » : le nom, puis l'adresse
      const [first, ...more] = name.split(/,\s*/);
      out.name = first;
      if (more.length) out.address = more.join(', ');
    }
    if (!c) Object.assign(out, latLon(q) || {});
  }
  return out.name || out.lat != null ? out : { ...out, short: true };
}
