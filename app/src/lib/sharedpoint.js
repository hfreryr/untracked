// Lien partagé vers un point placé à la main (…#carte=17/48.85/2.35&point=1, placeflow.js) : position du point, lue
// dans l'adresse, pour y reposer l'épingle et rouvrir sa fiche (porteur, 05/11/2026 : le lien n'ouvrait que la carte).
/** { lat, lon } du point partagé, ou null si l'adresse n'en contient pas. */
export function sharedPoint(hash) {
  if (!/[#&]point=1\b/.test(hash || '')) return null;
  const m = /carte=[\d.]+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/.exec(hash);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
