// Retrouver la position d'un lieu importé de Google Maps dont l'export ne donne que le nom
// (les listes Google n'ont pas de coordonnées). Dans l'ordre (01/11/2026, étape 4 de la recherche « où que l'on soit ») :
// 1. nos lieux autour du point de départ (sur le téléphone, rien n'est envoyé) ;
// 2. l'annuaire national des lieux (directory.js : communes, gares, musées, lieux connus de toutes nos régions) ;
// 3. l'adresse, s'il y en a une, par le géocodeur de l'État (France), puis le lieu de ce nom à cette adresse ;
// 4. à défaut seulement, Photon (service partagé, ≈ 1 demande par seconde) : surtout les lieux hors de France.
import { searchLocal } from './localsearch.js';
import { searchForImport, searchDirectory, geocodeAddress } from './geocode.js';
import { normName } from './myplaces.js';

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Choisit le résultat : un seul lieu portant exactement ce nom → sûr ; plusieurs (enseigne, homonymes) → le plus
 * proche, signalé « à vérifier » ; aucun nom exact → le premier résultat, lui aussi à vérifier.
 * @returns {{ place: object, sure: boolean } | null}
 */
export function pick(name, results) {
  if (!results?.length) return null;
  const exact = results.filter((r) => norm(r.name) === norm(name));
  // plusieurs résultats du même nom tout proches (le bâtiment et le musée, le point et la zone) : c'est le même lieu
  // (import du 31/10/2026 : 99 lieux sur 129 marqués « à vérifier » pour cette raison)
  const close = (a, b) => a.lat == null || b.lat == null || (Math.abs(a.lat - b.lat) < 0.003 && Math.abs(a.lon - b.lon) < 0.004);
  if (exact.length) return { place: exact[0], sure: exact.every((r) => close(r, exact[0])) };
  return { place: results[0], sure: false };
}

/**
 * @param {{name:string, address?:string}} p  @param {{lat:number, lon:number}} at
 * @returns {Promise<{place, sure}|null>} null : introuvable ; lève une erreur si le moteur de recherche n'a pas répondu
 * (le lieu est alors gardé pour « Réessayer », au lieu d'être compté introuvable)
 */
export async function resolvePlace(p, at, deps = {}) {
  const { local = searchLocal, directory = searchDirectory, address = geocodeAddress, remote = searchForImport } = deps;
  if (!p.address) {
    const near = pick(p.name, await local(p.name, at).catch(() => []));
    if (near?.sure) return near;
    const far = pick(p.name, await directory(p.name, at).catch(() => []));
    if (far?.sure) return far;
  } else {
    // l'adresse donne la position ; le lieu du même nom tout près donne la fiche (identifiant OSM)
    const a = await address(p.address).catch(() => null);
    if (a) {
      const same = (await local(p.name, a).catch(() => [])).find((r) => norm(r.name) === norm(p.name)
        && Math.abs(r.lat - a.lat) < 0.0015 && Math.abs(r.lon - a.lon) < 0.002);
      return { place: same || { name: p.name, lat: a.lat, lon: a.lon, address: p.address }, sure: true };
    }
  }
  const r = pick(p.name, await remote(p.address || p.name, at));
  return r ? { ...r, remote: true } : null;
}

/** Comme eachLimited, un à la fois, avec au moins `gap` ms entre deux départs (service partagé : ≈ 1 demande/s).
 *  fn peut renvoyer false : rien n'a été demandé au service partagé, pas d'attente. */
export async function eachPaced(items, gap, fn, now = () => Date.now(), wait = (ms) => new Promise((r) => setTimeout(r, ms))) {
  for (let i = 0; i < items.length; i++) {
    const t0 = now();
    if ((await fn(items[i], i)) === false) continue;
    const left = gap - (now() - t0);
    if (left > 0 && i < items.length - 1) await wait(left);
  }
}

/** Applique fn à chaque élément, quelques-uns à la fois (le moteur de recherche est un service partagé). */
export async function eachLimited(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i); }
  }));
}

/**
 * Lieu de Google qui a déjà une position : on cherche le même lieu dans nos données (même nom, à moins de ~80 m)
 * pour garder son identifiant OSM. Sans lui, la fiche du lieu ne savait pas qu'il était dans une liste (bug du 20/10).
 * Rien n'est envoyé : la recherche se fait dans nos fichiers.
 */
export async function snapToOsm(p, deps = { local: searchLocal }) {
  const near = (await deps.local(p.name, p).catch(() => [])) || [];
  return near.find((r) => r.osmType && normName(r.name) === normName(p.name)
    && Math.abs(r.lat - p.lat) < 0.0007 && Math.abs(r.lon - p.lon) < 0.001) || null;
}
