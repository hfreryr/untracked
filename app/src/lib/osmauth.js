// Connexion au compte OpenStreetMap de la personne (OAuth 2.0 avec PKCE, sans serveur ni secret : app publique),
// pour envoyer ses modifications avec son propre compte (docs/contribution-osm.md, règle n° 1).
// On ne demande que write_api (modifier la carte) et read_prefs (afficher son nom). L'accès reste sur le téléphone
// (localStorage) et ne s'efface que par « Se déconnecter », par la révocation dans le compte OSM, ou avec les données
// du site ; OSM ne le fait pas expirer pour l'instant (wiki OAuth, vérifié le 02/11/2026).
// Serveur : celui d'OSM quand l'app y est enregistrée (OSM_CLIENT_ID) ; pour les essais, le serveur d'essai d'OSM
// (localStorage « osm-serveur-essai » : { clientId, web, api }), qui ne touche pas la vraie carte.

const KEY = 'osm-acces', PENDING = 'osm-connexion';
// identifiant public de l'app chez OSM (enregistrée par le porteur le 02/11/2026 avec le compte du projet ; pas un secret)
export const OSM_CLIENT_ID = import.meta.env?.VITE_OSM_CLIENT_ID || '7b-9qe41CkpMp93Lr8Qjrp_Lk1h3BADyrvssCrkt3Gg';
const PROD = { clientId: OSM_CLIENT_ID, web: 'https://www.openstreetmap.org', api: 'https://api.openstreetmap.org' };

const store = () => { try { return globalThis.localStorage; } catch { return null; } };
const read = (k) => { try { return JSON.parse(store()?.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { v == null ? store()?.removeItem(k) : store()?.setItem(k, JSON.stringify(v)); } catch { /* navigation privée */ } };

/** Serveur OSM utilisé, ou null si l'app n'y est pas encore enregistrée (le bouton n'apparaît pas). */
export function osmServer() {
  const test = read('osm-serveur-essai');
  if (test?.clientId && /^https:\/\//.test(test.web) && /^https:\/\//.test(test.api)) return test;
  return PROD.clientId ? PROD : null;
}

/** Accès enregistré : { token, name } ou null. */
export const osmAccount = () => read(KEY);
export const osmLogout = () => write(KEY, null);

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** Défi PKCE : SHA-256 du vérificateur, en base64 « url ». */
export async function challengeOf(verifier) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}
export const redirectUri = () => new URL('.', location.href).href;   // la page d'accueil de l'app (adresse enregistrée chez OSM)

/** Part vers la page de connexion d'OSM ; `resume` est gardé pour reprendre là où on en était au retour. */
export async function osmLogin(resume) {
  const s = osmServer();
  if (!s) return;
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  write(PENDING, { verifier, state, resume, at: Date.now() });
  const q = new URLSearchParams({ response_type: 'code', client_id: s.clientId, redirect_uri: redirectUri(), scope: 'write_api read_prefs',
    state, code_challenge: await challengeOf(verifier), code_challenge_method: 'S256' });
  location.assign(`${s.web}/oauth2/authorize?${q}`);
}

/**
 * Au retour d'OSM (…?code=…&state=…) : échange le code contre l'accès, retient le nom du compte, nettoie l'adresse.
 * @returns {Promise<{resume:any}|{error:string}|null>} null si l'app n'a pas été ouverte par un retour d'OSM
 */
export async function osmReturn(search = location.search, fetcher = fetch) {
  const p = new URLSearchParams(search);
  if (!p.has('state') || !(p.has('code') || p.has('error'))) return null;
  const pending = read(PENDING);
  write(PENDING, null);
  history.replaceState(history.state, '', location.pathname + location.hash);
  const s = osmServer();
  if (!pending || pending.state !== p.get('state') || !s) return { error: 'state' };
  if (p.has('error')) return { error: p.get('error'), resume: pending.resume };
  const r = await fetcher(`${s.web}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(), client_id: s.clientId,
      code_verifier: pending.verifier }) }).catch(() => null);
  const j = r?.ok ? await r.json() : null;
  if (!j?.access_token) return { error: 'token', resume: pending.resume };
  const u = await fetcher(`${s.api}/api/0.6/user/details.json`, { headers: { Authorization: `Bearer ${j.access_token}` } }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  write(KEY, { token: j.access_token, name: u?.user?.display_name || '', server: s.web });
  return { resume: pending.resume };
}
