// Position cachée dans les liens des listes Google (01/11/2026). Un lieu enregistré est exporté avec un lien
// « …/data=!4m2!3m1!1s0x47915bf6abbd0cad:0x… » : le premier nombre est l'identifiant d'une cellule « S2 » (découpage
// public de la sphère, bibliothèque libre S2 Geometry), c'est-à-dire la position du lieu. Vérifié sur un vrai export
// (135 lieux : positions exactes). Format non documenté par Google : à défaut, l'import cherche le lieu par son nom.
// Ces positions sont les données de l'utilisateur (son export) : elles restent sur son téléphone, jamais envoyées dans OSM.

// courbe de Hilbert : position (2 bits) → (i, j) selon l'orientation, et changement d'orientation
const POS_TO_IJ = [[0, 1, 3, 2], [0, 2, 3, 1], [3, 2, 0, 1], [3, 1, 0, 2]];
const POS_TO_ORIENT = [1, 0, 0, 3];
const MAX = 30;

const stToUV = (s) => (s >= 0.5 ? (1 / 3) * (4 * s * s - 1) : (1 / 3) * (1 - 4 * (1 - s) * (1 - s)));

function faceXYZ(face, u, v) {
  switch (face) {
    case 0: return [1, u, v];
    case 1: return [-u, 1, v];
    case 2: return [-u, -v, 1];
    case 3: return [-1, -v, -u];
    case 4: return [v, -1, -u];
    default: return [v, u, -1];
  }
}

/** Identifiant de cellule S2 (nombre de 64 bits, en BigInt ou en texte « 0x… ») → { lat, lon } du centre, ou null. */
export function cellToLatLon(id) {
  let c;
  try { c = BigInt(id); } catch { return null; }
  if (c <= 0n || c >= 1n << 64n) return null;
  const face = Number(c >> 61n);
  if (face > 5) return null;
  // niveau : le bit le plus bas à 1 marque la fin de la position
  let tz = 0;
  while (((c >> BigInt(tz)) & 1n) === 0n) tz++;
  if (tz % 2 || tz > 60) return null;
  const level = MAX - tz / 2;
  let i = 0, j = 0, orient = face & 1;
  for (let k = 0; k < level; k++) {
    const pos = Number((c >> BigInt(59 - 2 * k)) & 3n);
    const ij = POS_TO_IJ[orient][pos];
    i = i * 2 + (ij >> 1);
    j = j * 2 + (ij & 1);
    orient ^= POS_TO_ORIENT[pos];
  }
  // centre de la cellule, en coordonnées de face (0..1)
  const size = 2 ** (MAX - level);
  const s = ((i * size) + size / 2) / 2 ** MAX, t = ((j * size) + size / 2) / 2 ** MAX;
  const [x, y, z] = faceXYZ(face, stToUV(s), stToUV(t));
  const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/** Position d'un lien de lieu Google (« !1s0x…:0x… »), ou null. */
export function latLonFromGoogleUrl(url = '') {
  const m = /!1s(0x[0-9a-f]{6,16}):0x[0-9a-f]+/i.exec(url);
  return m ? cellToLatLon(m[1]) : null;
}
