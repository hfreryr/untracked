// Points de contribution (maquette validée le 04/11/2026) : une correction coûte plus qu'un avis, les horaires sont
// l'info la plus utile et la plus rare. Doublés quand la personne est sur place (à moins de 100 m du lieu à l'envoi) :
// c'est la règle d'OpenStreetMap (« ce que vous voyez sur place ») et la meilleure garantie de qualité. Plafond discret
// de 20 modifications comptées par jour, pour ne pas encourager la course au volume (la communauté OSM s'en méfie).
// Tout est compté sur le téléphone ; aucun classement entre personnes.
export const POINTS = { avis: 1, signalement: 2, corrections: 3, horaires: 5 };
export const NEAR_M = 100;
export const DAILY_CAP = 20;

/** Points d'une modification envoyée à OSM (osmcontrib.js) : selon son genre, doublés sur place. */
export const editPoints = (e) => (POINTS[e.kind] || 0) * (e.near ? 2 : 1);

/** Points de toutes les modifications, au plus DAILY_CAP comptées par jour. */
export function editsPoints(edits = []) {
  const perDay = {};
  let total = 0;
  for (const e of edits) {
    const day = Math.floor((e.t || 0) / 86400);
    perDay[day] = (perDay[day] || 0) + 1;
    if (perDay[day] <= DAILY_CAP) total += editPoints(e);
  }
  return total;
}

/** Total : 1 point par avis publié, plus les modifications. */
export const pointsOf = (mine = [], edits = []) => mine.length * POINTS.avis + editsPoints(edits);

/** Détail par genre, pour « Mes contributions ». */
export function tally(mine = [], edits = []) {
  const n = (k) => edits.filter((e) => e.kind === k).length;
  return { avis: mine.length, corrections: n('corrections'), horaires: n('horaires'), signalements: n('signalement') };
}

/** Sur place : à moins de NEAR_M mètres du lieu (position connue du téléphone, jamais envoyée). */
export function isOnSite(me, place) {
  if (!me || me.lat == null || place?.lat == null) return false;
  const k = 111320, dx = (me.lon - place.lon) * k * Math.cos((place.lat * Math.PI) / 180), dy = (me.lat - place.lat) * k;
  return Math.hypot(dx, dy) <= NEAR_M;
}
