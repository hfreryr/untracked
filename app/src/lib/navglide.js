// Guidage fluide : la flèche de position et la carte glissent d'une position GPS à la suivante, à vitesse constante,
// au lieu de sauter à chaque nouvelle position (retour du porteur, 21/10 : « par à-coups »).
// Le téléphone donne une position environ une fois par seconde : on met ce même temps à aller de l'une à l'autre.
import { tx } from '#lib/i18n/index.js';

export const lerp = (a, b, t) => a + (b - a) * t;
/** Angle intermédiaire (degrés), par le plus court chemin : de 350° à 10°, on passe par 0°, pas par 180°. */
export function lerpAngle(a, b, t) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (((a + d * t) % 360) + 360) % 360;
}
/** Durée du glissement : le temps écoulé depuis la position précédente, borné entre 0,3 et 2 s. */
export const glideMs = (gap) => Math.max(300, Math.min(2000, gap || 1000));

/**
 * Chiffres de la barre du bas pendant le guidage, comme Plans : [durée, distance], chacun { v, u } (valeur, unité).
 * @param {number} seconds  temps restant  @param {number} meters  distance restante
 */
export function etaParts(seconds, meters) {
  const m = Math.max(1, Math.round(seconds / 60));
  const time = m < 60 ? { v: String(m), u: tx('guidage.unite_min') }
    : { v: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, u: tx('guidage.unite_h') };
  const dist = meters < 950 ? { v: String(Math.max(10, Math.round(meters / 10) * 10)), u: tx('guidage.unite_m') }
    : { v: (meters / 1000).toFixed(meters < 9500 ? 1 : 0).replace('.', ','), u: tx('guidage.unite_km') };
  return [time, dist];
}

/** @param {any} app */
export function createGlide(app) {
  let anim = null, raf = 0, lastAt = 0;
  const now = () => performance.now();
  function at(t) {
    const k = Math.min(1, (t - anim.t0) / anim.dur);
    return { lon: lerp(anim.a.lon, anim.b.lon, k), lat: lerp(anim.a.lat, anim.b.lat, k), rot: lerpAngle(anim.ra, anim.rb, k), k };
  }
  function frame() {
    if (!anim) return;
    const p = at(now());
    app.meMarker?.setLngLat([p.lon, p.lat]);
    app.meMarker?.setRotation(p.rot);
    raf = p.k < 1 ? requestAnimationFrame(frame) : 0;
  }
  /**
   * Nouvelle position : la flèche y glisse ; si `cam` est donné, la carte suit au même rythme (sans accélérer ni freiner).
   * @param {{ zoom: number, pitch: number, offset: [number, number] } | null} cam
   */
  function glideTo(lat, lon, heading, cam = null) {
    const t = now();
    const cur = anim ? at(t) : null;
    const a = cur || (app.meMarker?.getLngLat() ? { lon: app.meMarker.getLngLat().lng, lat: app.meMarker.getLngLat().lat } : { lon, lat });
    const ra = cur ? cur.rot : heading ?? 0;
    const dur = glideMs(lastAt ? t - lastAt : 0);
    lastAt = t;
    if (!app.meMarker?.getLngLat()) app.showMe(lat, lon);
    anim = { a, b: { lon, lat }, ra, rb: heading ?? ra, t0: t, dur };
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    if (cam) app.map.easeTo({ center: [lon, lat], bearing: heading ?? app.map.getBearing(), pitch: cam.pitch, zoom: cam.zoom,
      offset: cam.offset, duration: dur, easing: (x) => x });
  }
  function stopGlide() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (anim) app.meMarker?.setLngLat([anim.b.lon, anim.b.lat]);
    anim = null;
    lastAt = 0;
  }
  return { glideTo, stopGlide };
}
