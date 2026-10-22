// Tracés aux angles arrondis, comme Plans (porteur, 23/10 : « pas d'angles avec des coins pointus »).
// Chaque coin est remplacé par une petite courbe tangente aux deux tronçons, sur quelques mètres seulement :
// le tracé reste dans la rue (écart au coin de 3 à 4 m au plus pour un angle droit) — contrairement à un lissage global, qui coupait
// les angles et faisait traverser des immeubles. Sert seulement au dessin ; le guidage garde le tracé exact.

import { simplify } from './routing.js';

const M = 111320;   // mètres par degré de latitude

/**
 * @param {number[][]} coords  [[lon, lat], …]
 * @param {number} r  longueur (m) prise sur chaque tronçon pour arrondir un coin
 * @param {number} steps  points par courbe
 */
export function roundCorners(coords, r = 10, steps = 6) {
  if (!coords || coords.length < 3) return coords;
  // d'abord les petits crochets de moins de 2,5 m (trottoir, passage piéton décalé) : invisibles sur le terrain
  coords = simplify(coords, 2.5);
  if (coords.length < 3) return coords;
  const k = Math.cos((coords[0][1] * Math.PI) / 180);
  const xy = coords.map(([lon, lat]) => [lon * M * k, lat * M]);
  const out = [coords[0]];
  for (let i = 1; i < xy.length - 1; i++) {
    const [a, b, c] = [xy[i - 1], xy[i], xy[i + 1]];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const u = [(a[0] - b[0]) / ab, (a[1] - b[1]) / ab], v = [(c[0] - b[0]) / bc, (c[1] - b[1]) / bc];
    const turn = Math.acos(Math.max(-1, Math.min(1, -(u[0] * v[0] + u[1] * v[1]))));   // 0 = tout droit
    if (!ab || !bc || turn < 0.17) { out.push(coords[i]); continue; }                      // moins de 10° : rien à arrondir
    const d = Math.min(r, ab * 0.5, bc * 0.5);
    const p1 = [b[0] + u[0] * d, b[1] + u[1] * d], p2 = [b[0] + v[0] * d, b[1] + v[1] * d];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, q = 1 - t;
      const x = q * q * p1[0] + 2 * q * t * b[0] + t * t * p2[0], y = q * q * p1[1] + 2 * q * t * b[1] + t * t * p2[1];
      out.push([x / (M * k), y / M]);
    }
  }
  out.push(coords.at(-1));
  return out;
}
