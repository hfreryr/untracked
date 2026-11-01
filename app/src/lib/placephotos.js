// Toutes les photos d'un lieu, d'où qu'elles viennent, pour le bandeau sous l'en-tête de la fiche (comme Plans, porteur,
// 01/11/2026 : « quasiment la section la plus importante ») et la visionneuse plein écran.
//  - avis Mangrove : copiées chez nous (review_photos.py), CC BY 4.0, auteur affiché ;
//  - Wikimedia Commons (placeinfo.js) ;
//  - site du lieu : chargée depuis son site, jamais copiée (build_sitehours.py, « Qui voit quoi »).
// Un commerce montre d'abord ses propres photos (avis, site) ; un monument, d'abord Wikimedia.
import { tx } from './i18n/index.js';

const hostOf = (u) => { try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ''); } catch { return ''; } };

/**
 * @returns {{src:string, full:string, page:string|null, credit:string, source:string, cors:boolean, referrer:string}[]}
 */
export function placePhotos(wiki, info) {
  const fromWiki = (wiki?.photos || []).map((p) => ({ src: p.src, full: p.full || p.src, page: p.page,
    credit: tx('photos.wikimedia_commons', { auteur: p.credit || tx('photos.wikimedia_commons_2') }), source: tx('photos.wikimedia_commons_2'),
    cors: true, referrer: 'no-referrer' }));
  const fromReviews = (info?.reviews?.photos || []).map((p) => ({ src: p.thumb, full: p.full, page: 'https://mangrove.reviews',
    credit: tx('photos.avis_credit', { auteur: p.nick || tx('avis.anonyme') }), source: tx('photos.avis_source'), cors: false, referrer: 'no-referrer' }));
  const site = info?.sitePhoto ? [{ src: info.sitePhoto, full: info.sitePhoto, page: info.website ? (/^https?:/.test(info.website) ? info.website : `https://${info.website}`) : null,
    credit: tx('fiche.photo_du_site', { site: hostOf(info.website || info.sitePhoto) }), source: hostOf(info.website || info.sitePhoto),
    // on s'annonce (untrackedmaps.app) : un site qui réserve ses images à lui-même peut refuser, et on le respecte
    cors: false, referrer: 'origin' }] : [];
  return info?.expectsHours ? [...fromReviews, ...site, ...fromWiki] : [...fromWiki, ...fromReviews, ...site];
}
