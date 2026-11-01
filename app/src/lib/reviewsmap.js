// Carte de mes avis (maquette du 31/10/2026) : les lieux que j'ai notés, sur la carte et en liste, avec ma note.
// Montrés comme une liste partagée (myplacesflow.js, refreshSaved), sans bouton « Ajouter à mes lieux ».
import { tx } from './i18n/index.js';
import { loadReviewer } from './reviewer.js';
import { ALL_CATEGORIES } from './categories.js';

export const REVIEWS_COLOR = '#C9820F';

/** Mes avis qui ont une position, au format des lieux enregistrés. */
export function reviewPlaces(mine) {
  return mine.filter((r) => r.lat != null && r.lon != null).map((r) => {
    const [osmType, osmId] = r.id.split('/');
    return { name: r.name, lat: r.lat, lon: r.lon, osmType, osmId: Number(osmId), id: `${osmType}${osmId}`,
      type: tx('badges.votre_note', { n: r.stars }), address: '' };
  });
}

/** Ouvre la carte de mes avis. */
export function showMyReviews(app) {
  const places = reviewPlaces(loadReviewer().mine);
  app.hubPanel = null;
  app.incoming = { kind: 'reviews', places };
  app.category = { key: 'mesavis', saved: true, shared: true, reviews: true, label: tx('badges.mes_avis'), name: tx('badges.mes_avis'),
    icon: 'star', color: REVIEWS_COLOR };
  app.refreshSaved();
  const pts = app.nearby.slice(0, 12).map((n) => n.f.geometry.coordinates);
  if (pts.length) app.fitTo(pts);
}

/** Retour à « Mes contributions » (dans Mes lieux). */
export function backToContrib(app) {
  app.incoming = null;
  app.pickCategory(ALL_CATEGORIES.find((c) => c.key === 'saved'));
  app.hubPanel = 'contrib';
}
