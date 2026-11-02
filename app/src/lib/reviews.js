// Avis libres de Mangrove (licence CC BY 4.0), rangés dans les tuiles de lieux par build_places.py (« _rev »).
// L'app ne contacte pas Mangrove pour les lire. Note affichée dès le premier avis, toujours avec le nombre d'avis à côté
// (« ★ 5,0 · 1 avis »), comme Google (porteur, 02/11/2026, revient sur la règle du 30/10) ; en revanche, jamais de tri ni
// de mise en avant d'un lieu sur sa note sous 3 avis (rankable).
export const MIN_FOR_RANKING = 3;

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
    showAverage: r.n >= 1,
    rankable: r.n >= MIN_FOR_RANKING,             // (assez d'avis pour classer ou mettre en avant un lieu sur sa note)
    latest: r.l.map(([rating, text, nick, date, sig, photos]) => ({
      stars: Math.max(1, Math.round(rating / 20)), text: text || '', nick: nick || '', date: new Date(date * 1000), sig, photos: photos || 0
    }))
  };
}

/** Étoiles pleines et vides (★★★★☆), pour l'affichage ; le nombre est donné à part aux lecteurs d'écran. */
export const starsText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
