// Avis libres de Mangrove (licence CC BY 4.0), rangés dans les tuiles de lieux par build_places.py (« _rev »).
// L'app ne contacte pas Mangrove pour les lire. Pas de moyenne mise en avant sous 3 avis : une note sur 1 ou 2 avis
// trompe (proposition validée par le porteur, 30/10/2026).
export const MIN_FOR_AVERAGE = 3;

/** Avis d'un lieu à partir de ses étiquettes, ou null. Notes sur 5 (Mangrove note sur 100). */
export function reviewsOf(t, base = '') {
  const r = t?._rev;
  if (!r?.n || !Array.isArray(r.l)) return null;
  return {
    // photos des avis, copiées chez nous (review_photos.py) : le téléphone ne contacte pas Mangrove pour les voir
    photos: (Array.isArray(r.ph) ? r.ph : []).filter((p) => /^[\w-]{10,100}$/.test(p?.[0] || ''))
      .map(([id, nick, date]) => ({ thumb: base + 'photos/' + id + '.t.jpg', full: base + 'photos/' + id + '.jpg', nick: nick || '', date: new Date(date * 1000) })),
    count: r.n,
    average: Math.round(r.a / 2) / 10,                 // 0-100 → 0-5, au dixième
    showAverage: r.n >= MIN_FOR_AVERAGE,
    latest: r.l.map(([rating, text, nick, date, sig, photos]) => ({
      stars: Math.max(1, Math.round(rating / 20)), text: text || '', nick: nick || '', date: new Date(date * 1000), sig, photos: photos || 0
    }))
  };
}

/** Étoiles pleines et vides (★★★★☆), pour l'affichage ; le nombre est donné à part aux lecteurs d'écran. */
export const starsText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
