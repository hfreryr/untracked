// Photo jointe à un avis (01/11/2026) : réduite et recompressée sur le téléphone avant l'envoi, ce qui efface ses
// métadonnées (position GPS exacte de la prise de vue, modèle de l'appareil) ; puis envoyée à Mangrove, qui l'héberge
// sous licence CC BY 4.0 et la joint à l'avis signé (champ « images »). Envoi seulement quand on touche « Publier ».
export const UPLOAD = 'https://upload.mangrove.reviews';
export const FILES = 'https://files.mangrove.reviews/';
const MAX = 1600;

/** Taille réduite (le plus grand côté à MAX px au plus). */
export function fitSize(w, h, max = MAX) {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * k), Math.round(h * k)];
}

/** Fichier choisi → JPEG réduit, sans métadonnées (dessiné sur un canevas, orientation de la photo respectée). */
export async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const [w, h] = fitSize(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), 'image/jpeg', 0.85));
}

/** Envoie la photo à Mangrove ; renvoie son adresse (files.mangrove.reviews/…). */
export async function uploadPhoto(blob, get = fetch) {
  const form = new FormData();
  form.append('files', blob, 'photo.jpg');
  const r = await get(UPLOAD, { method: 'PUT', body: form });
  if (!r.ok) throw new Error(`upload ${r.status}`);
  const ids = await r.json();
  if (!Array.isArray(ids) || typeof ids[0] !== 'string' || !/^[\w-]{10,100}$/.test(ids[0])) throw new Error('upload');
  return FILES + ids[0];
}
