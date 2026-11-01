// Lien Google Maps ou Plans collé dans la recherche ou partagé vers l'app → le lieu chez nous (maplink.js lit le lien).
// Avec un nom et une position : le même lieu dans nos données (sa fiche), sinon un repère à cette position.
// Avec un nom seul : la même recherche que l'import des listes Google (importresolve.js).
// Lien court : il ne dit rien du lieu ; on cherche le texte qui l'accompagne, sinon on demande le nom.
import { tx } from '#lib/i18n/index.js';
import { parseMapLink } from './maplink.js';
import { snapToOsm, linkByName, resolvePlace } from './importresolve.js';

const pin = (o) => ({ name: o.name || o.address || tx('liens.position_partagee'), type: '', address: o.address || '', lat: o.lat, lon: o.lon });

/**
 * Résultats de recherche pour un texte contenant un lien de lieu.
 * @param {string} text @param {{lat:number, lon:number}} at  centre de la carte (pour un nom sans position)
 * @param {{ search: (q:string, at:any) => Promise<any[]>, snap?: Function, resolve?: Function }} deps
 * @returns {Promise<any[]>} lève une erreur portant `say` (texte à afficher) si le lien ne permet pas de trouver le lieu
 */
export async function linkResults(text, at, deps) {
  const { search, snap = snapToOsm, resolve = resolvePlace } = deps;
  const l = parseMapLink(text);
  if (!l) return [];
  const words = (l.rest || '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (l.short) {
    if (words.length >= 3) return search(l.rest, at);
    throw Object.assign(new Error('lien-court'), { say: tx('liens.lien_court') });
  }
  if (l.lat != null && l.name) {
    const p = { name: l.name, lat: l.lat, lon: l.lon };
    const same = (await snap(p).catch(() => null)) || (await linkByName(p, search).catch(() => null));
    return [same || pin(l)];
  }
  if (l.lat != null) return [pin(l)];
  const r = await resolve({ name: l.name, address: l.address }, at).catch(() => null);
  if (r?.place) return [r.place];
  return search(l.name, at);
}
