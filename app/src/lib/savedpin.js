// Pastille des lieux de vos listes sur la carte (porteur, 02/11/2026, option « autocollant ») : plus grande que celle
// des catégories, épais contour blanc et ombre marquée, pour qu'on distingue d'un coup d'œil « mes lieux » des lieux
// proposés par l'app. Même forme ronde (l'épingle reste réservée au lieu choisi).

/** Mesures de la pastille (px à l'écran) : rond de couleur, contour blanc. Pure. */
export const SAVED = { px: 22, ring: 3 };

/** Image de la pastille : { data, pixelRatio } pour map.addImage. */
export function savedPinImage(color, glyphPath, { px = SAVED.px, ring = SAVED.ring } = {}) {
  const s = 2, pad = 7, size = (px + 2 * ring + 2 * pad) * s;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = (px / 2) * s, cx = size / 2, cy = size / 2;
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 4 * s; g.shadowOffsetY = 1.5 * s;
  g.fillStyle = '#FFFFFF';
  g.beginPath(); g.arc(cx, cy, r + ring * s, 0, Math.PI * 2); g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = color;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  const scale = (r * 1.25) / 24;
  g.save();
  g.translate(cx - 12 * scale, cy - 12 * scale);
  g.scale(scale, scale);
  g.fillStyle = '#FFFFFF';
  g.fill(new Path2D(glyphPath), 'evenodd');
  g.restore();
  return { data: g.getImageData(0, 0, size, size), pixelRatio: s };
}

/** Nom de l'image d'une liste ('fav|pictogramme|couleur'), lu par provideImage (mapstyle.js). */
export const savedIcon = (l) => `fav|${l.icon}|${l.color}`;
