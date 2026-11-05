// Tracé d'une étape en transport (porteur, 05/11/2026 : ligne 13 dessinée en zigzag de Saint-Lazare à la Concorde).
// Le tracé fourni par Transitous est parfois faux : celui de la 13 faisait 13,7 km pour 4,1 km d'arrêt en arrêt
// (3,4 fois plus). On le vérifie entre chaque paire d'arrêts : la portion du tracé qui les relie est gardée si elle est
// plausible (pas plus de 1,8 fois la ligne droite, + 300 m pour les courbes), sinon on trace la ligne droite entre les
// deux arrêts. Un métro bien tracé reste donc courbe ; un tracé aberrant ne déborde plus de la ligne.
const K = 111320;
const dist = (a, b) => Math.hypot((a[0] - b[0]) * K * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * K);
const len = (c, i, j) => { let s = 0; for (let k = i; k < j; k++) s += dist(c[k], c[k + 1]); return s; };

/** Indice du point du tracé le plus proche de p, à partir de « from » (on avance dans l'ordre des arrêts). */
function nearest(c, p, from) {
  let best = from, bd = Infinity;
  for (let k = from; k < c.length; k++) { const d = dist(c[k], p); if (d < bd) { bd = d; best = k; } }
  return { k: best, d: bd };
}

/**
 * coords : tracé [[lon, lat]…] ; stops : arrêts dans l'ordre (départ, intermédiaires, arrivée) [[lon, lat]…].
 * Renvoie un tracé plausible.
 */
export function trustedShape(coords, stops) {
  if (!stops || stops.length < 2) return coords || [];
  if (!coords || coords.length < 2) return stops;
  const out = [];
  let cur = 0;
  for (let s = 0; s + 1 < stops.length; s++) {
    const a = stops[s], b = stops[s + 1];
    const na = nearest(coords, a, cur), nb = nearest(coords, b, na.k);
    const straight = dist(a, b);
    const ok = na.d < 250 && nb.d < 250 && nb.k > na.k && len(coords, na.k, nb.k) <= straight * 1.8 + 300;
    const part = ok ? coords.slice(na.k, nb.k + 1) : [a, b];
    out.push(...(out.length ? part.slice(1) : part));
    if (ok) cur = nb.k;
  }
  return out;
}
