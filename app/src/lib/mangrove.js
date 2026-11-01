// Publier un avis sur Mangrove (Open Reviews Association), sans compte : l'avis est signé par une clé créée dans le
// téléphone (ECDSA P-256, format JWT « ES256 », comme MapComplete et CoMaps). Le téléphone l'envoie directement à
// Mangrove ; aucun serveur à nous entre les deux. Licence des avis : CC BY 4.0 (conditions de Mangrove).
// Format vérifié le 30/10/2026 : docs.mangrove.reviews (PUT /submit/{jwt}) ; en-tête { alg, kid (clé publique PEM), jwk }.
// Écrit sans la bibliothèque mangrove-reviews-typescript (GPL-2.0 seule, incompatible avec notre AGPL-3.0).
export const API = 'https://api.mangrove.reviews';
export const CLIENT_ID = 'https://untrackedmaps.app';
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };

const enc = new TextEncoder();
export const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (s) => b64url(enc.encode(s));

/** Nouvelle paire de clés ; seule la clé privée (JWK) est gardée, la publique s'en déduit. */
export async function newKeyJwk() {
  const k = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  return crypto.subtle.exportKey('jwk', k.privateKey);
}

/** Clés utilisables à partir de la clé privée gardée (JWK). */
export async function keysFrom(jwk) {
  const priv = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: ['sign'] }, ALG, true, ['sign']);
  const { d, key_ops, ...pub } = jwk;    // eslint-disable-line no-unused-vars
  const pubKey = await crypto.subtle.importKey('jwk', { ...pub, key_ops: ['verify'] }, ALG, true, ['verify']);
  return { priv, pub: pubKey };
}

/** Clé publique au format PEM sur une ligne, comme l'attend Mangrove (« kid »). */
export async function pemOf(pub) {
  const spki = await crypto.subtle.exportKey('spki', pub);
  return `-----BEGIN PUBLIC KEY-----${btoa(String.fromCharCode(...new Uint8Array(spki)))}-----END PUBLIC KEY-----`;
}

/** Sujet d'un avis : l'adresse géographique du lieu avec son nom (« geo: » URI, comme les autres apps). */
export function subjectOf(place) {
  return `geo:${(+place.lat).toFixed(7)},${(+place.lon).toFixed(7)}?q=${encodeURIComponent(place.name || '')}&u=30`;
}

/** Contenu de l'avis. stars : 1 à 5 (Mangrove note sur 100). */
export function payloadOf({ place, stars, text, nick, images = [], now = Date.now() }) {
  const metadata = { client_id: CLIENT_ID, is_personal_experience: true };
  if (nick?.trim()) metadata.nickname = nick.trim().slice(0, 40);
  if (place.osmType && place.osmId) metadata.osm_id = `${place.osmType}/${place.osmId}`;
  const p = { sub: subjectOf(place), rating: Math.max(1, Math.min(5, Math.round(stars))) * 20, iat: Math.floor(now / 1000), metadata };
  if (text?.trim()) p.opinion = text.trim().slice(0, 1000);
  // photos jointes (photoupload.js) : hébergées par Mangrove, CC BY 4.0
  const imgs = images.filter((u) => /^https:\/\/files\.mangrove\.reviews\/[\w-]+$/.test(u)).slice(0, 4);
  if (imgs.length) p.images = imgs.map((src) => ({ src, label: null }));
  return p;
}

/** Avis signé (JWT). La signature ECDSA de WebCrypto (r||s, 64 octets) est déjà au format attendu par ES256. */
export async function signReview(jwk, payload) {
  const { priv, pub } = await keysFrom(jwk);
  const { d, key_ops, ...pubJwk } = jwk;   // eslint-disable-line no-unused-vars
  const header = { alg: 'ES256', kid: await pemOf(pub), jwk: JSON.stringify(pubJwk), enc: 'utf-8' };
  const input = `${b64urlText(JSON.stringify(header))}.${b64urlText(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc.encode(input));
  return `${input}.${b64url(sig)}`;
}

/** Envoi à Mangrove ; renvoie la signature de l'avis (son identifiant). */
export async function submit(jwt, get = fetch) {
  const res = await get(`${API}/submit/${jwt}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`mangrove-${res.status}`);
  return jwt.split('.')[2];
}
