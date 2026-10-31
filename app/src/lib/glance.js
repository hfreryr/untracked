// Infos clés d'une fiche en un coup d'œil, en colonnes sous les boutons (maquette B validée le 31/10/2026, inspirée
// de Plans) : horaires (ouvert ou fermé), note moyenne (3 avis au moins), distance, accès fauteuil, entrée.
// 4 colonnes au plus, pour rester lisibles avec le texte agrandi.
import { tx } from '#lib/i18n/index.js';
import { fmtDistance } from '#lib/routing.js';

const R = 6371000, rad = (d) => (d * Math.PI) / 180;
export function meters(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** @returns {{ key: string, label: string, value: string, sub?: string, tone?: 'open'|'closed' }[]} */
export function glanceItems({ status, reviews, me, place, info }) {
  const out = [];
  if (status) {
    const [head, ...rest] = status.label.split(' · ');
    // « 8 h 30 » jamais coupé en fin de ligne (colonne étroite)
    const keep = (t) => t.replace(/ (\d+) h(?: (\d+))?/g, (_, h, m) => `\u00a0${h}\u00a0h${m ? `\u00a0${m}` : ''}`);
    out.push(status.open === null
      ? { key: 'hours', label: tx('fiche.horaires_titre'), value: tx('fiche.incertains') }
      : { key: 'hours', label: tx('fiche.horaires_titre'), value: head, sub: keep(rest.join(' · ')) || undefined, tone: status.open ? 'open' : 'closed' });
  }
  if (reviews?.showAverage) {
    out.push({ key: 'rating', label: tx('avis.n_avis', { n: reviews.count }), value: `★ ${reviews.average.toLocaleString('fr-FR')}` });
  }
  if (me && place) out.push({ key: 'distance', label: tx('ecran.distance'), value: fmtDistance(meters(me, place)) });
  const wc = { yes: tx('ecran.oui'), limited: tx('ecran.partiel'), no: tx('ecran.non') }[info?.wheelchair];
  if (wc) out.push({ key: 'wheelchair', label: tx('ecran.acces_fauteuil'), value: wc });
  const fee = { no: tx('ecran.gratuite'), yes: tx('ecran.payante') }[info?.fee];
  if (fee) out.push({ key: 'fee', label: tx('ecran.entree'), value: fee });
  return out.slice(0, 4);
}

/** « Vous êtes à proximité » : à moins de 100 m du lieu, on propose d'en donner son avis. */
export const NEAR_M = 100;
export const isNear = (me, place) => !!(me && place) && meters(me, place) <= NEAR_M;
