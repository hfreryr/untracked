// Guidage pas à pas : voix, étapes, suivi de la position et recalcul.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { tx } from '#lib/i18n/index.js';
import { MODE_NAMES, fmtDistance, fmtDuration, fmtTime, streetRoute, trafficEstimate } from '#lib/routing.js';
import { empty } from '#lib/maplayers.js';
import { exitLabel } from '#lib/exits.js';
import { placeLabel } from '#lib/rame.js';
import { prepare, progress, remaining, spokenDistance } from '#lib/nav.js';

/** @param {any} app */
export function createNav(app) {
  function speak(text) {
    if (!app.voice || !text || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    speechSynthesis.speak(u);
  }
  // Trajet en transport → étapes du guidage : marcher, monter, descendre (avec sortie et place dans la rame).
  function transitSteps(it) {
    const coords = [], steps = [];
    it.legs.forEach((leg, i) => {
      const idx = Math.max(0, coords.length - 1);
      if (leg.mode === 'STOP') { steps.push({ text: tx('itin.arret_2', { from: leg.from }), type: 'stop', idx, t: +leg.start }); return; }
      coords.push(...leg.coords);
      if (leg.mode === 'WALK') {
        const dest = leg.to === 'Arrivée' || i === it.legs.length - 1 ? app.to.label : leg.to;
        steps.push({ text: tx('guidage.marchez_jusqu_a', { dest }), sub: `${fmtDuration(leg.duration)}${leg.distance ? ` · ${fmtDistance(leg.distance)}` : ''}`, type: 'walk', idx, t: +leg.start });
      } else {
        const tip = app.legExits[`${app.picked}|${i}|${leg.to}`];
        const name = `${MODE_NAMES[leg.mode] || tx('itin.ligne')} ${leg.line}`.trim();
        steps.push({ text: tx('guidage.prenez_le_direction', { name, headsign: leg.headsign }), sub: tx('guidage.a_depart', { from: leg.from, fmtTime: fmtTime(leg.start), suite: tip?.place ? tx('guidage.montez', { placeLabel: placeLabel(tip.place) }) : '' }),
          type: 'board', idx, t: +leg.start, leg });
        steps.push({ text: tx('guidage.descendez_a', { to: leg.to }), sub: tx('guidage.arrivee', { arrets: leg.stops ? tx('itin.arrets', { n: leg.stops + 1 }) : '', fmtTime: fmtTime(leg.end), sortie: tip?.exit ? ` · ${exitLabel(tip.exit).replace(/^Sortie/, 'sortie')}` : '' }),
          type: 'alight', idx: Math.max(0, coords.length - 1), t: +leg.end - 60000, leg });
      }
    });
    return { coords: coords.length > 1 ? coords : [[app.from.lon, app.from.lat], [app.to.lon, app.to.lat]], steps };
  }
  async function startNav(option) {
    const kind = app.mode === 'transit' ? 'transit' : 'street';
    let base;
    if (kind === 'transit') {
      const { coords, steps } = transitSteps(option);
      base = { ...prepare(coords, steps, option.duration), end: +option.end };
    } else {
      base = prepare(option.raw, option.steps, option.duration);
      app.map.getSource('route-tags')?.setData(empty());
      // pendant le trajet, seul l'itinéraire choisi reste sur la carte
      app.map.getSource('route')?.setData({ type: 'FeatureCollection', features: [app.line(option.coords, app.mode,
        app.mode === 'bike' ? app.BIKE_COLOR : app.WALK_COLOR, app.mode === 'bike' ? '#1B3F9E' : '#1B3F9E')] });
    }
    app.nav = { ...base, kind, mode: app.mode, option, s: 0, k: 0, off: 0, arrived: false, startedAt: Date.now() };
    app.navFollow = true;
    app.navList = false;
    app.offCount = 0;
    app.arriveCount = 0;
    app.spoken = new Set();
    // l'écran reste allumé pendant le trajet (si le téléphone le permet)
    try { app.wakeLock = await navigator.wakeLock?.request('screen'); } catch { app.wakeLock = null; }
    speak(kind === 'transit' ? app.nav.steps[0]?.text : app.nav.steps[0]?.speak || app.nav.steps[0]?.text);
    clearInterval(app.navTick);
    app.navTick = setInterval(() => { app.now = Date.now(); if (app.nav?.kind === 'transit') updateNav(); }, 5000);
    app.stopWatch();
    app.followMode = 'none';
    if (navigator.geolocation) {
      app.navWatch = navigator.geolocation.watchPosition(onFix, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    }
    if (app.me) onFix({ coords: { latitude: app.me.lat, longitude: app.me.lon, heading: null, speed: null } });
  }
  function onFix(pos) {
    if (!app.nav) return;
    const { latitude: lat, longitude: lon, heading, speed } = pos.coords;
    app.me = { label: tx('resultats.votre_position'), lat, lon, isMe: true };
    app.lastFix = { lat, lon, heading: speed > 1 && heading != null && !Number.isNaN(heading) ? heading : null };
    app.showMe(lat, lon);
    updateNav();
  }
  function updateNav() {
    if (!app.nav || !app.lastFix) return;
    const cfg = app.NAV[app.nav.kind === 'transit' ? 'transit' : app.nav.mode];
    const p = progress(app.nav, [app.lastFix.lon, app.lastFix.lat], app.nav.s);
    let k = p.k;
    if (app.nav.kind === 'transit') {
      // sous terre, plus de position : on avance aussi avec l'horaire
      const byTime = app.nav.steps.reduce((acc, st, i) => (st.t <= Date.now() ? i : acc), 0);
      k = Math.max(k, byTime, app.nav.k);
    } else k = Math.max(k, app.nav.k);
    // arrivée confirmée par deux positions de suite (une position ancienne ou imprécise ne suffit pas)
    const atEnd = app.nav.total - p.s < 20 && p.off < 40 || (app.nav.kind === 'transit' && Date.now() > app.nav.end && app.nav.total - p.s < 80);
    app.arriveCount = atEnd ? app.arriveCount + 1 : 0;
    const arrived = app.arriveCount >= 2;
    const heading = app.lastFix.heading ?? p.heading;
    const prevK = app.nav.k;
    app.nav = { ...app.nav, s: Math.max(p.s, app.nav.s - 30), k, off: p.off, heading, arrived: app.nav.arrived || arrived };
    app.meMarker?.setRotationAlignment('map');      // la flèche suit la carte (qui tourne avec vous)
    app.meMarker?.setRotation(heading);
    app.meMarker?.getElement().classList.add('navigating');
    // sur la carte : seul le reste du trajet reste en bleu, et le point de départ disparaît (la flèche suffit)
    if (app.nav.kind !== 'transit') {
      const color = app.nav.mode === 'bike' ? app.BIKE_COLOR : app.WALK_COLOR;
      app.map.getSource('route')?.setData({ type: 'FeatureCollection', features: [app.line(remaining(app.nav, app.nav.s), app.nav.mode, color, '#1B3F9E')] });
    }
    app.map.getSource('route-ends')?.setData({ type: 'FeatureCollection', features: app.showVia && app.via && app.nav.steps.findIndex((st) => st.type === 'stop') > app.nav.k
      ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [app.via.lon, app.via.lat] }, properties: { kind: 'via' } }] : [] });
    if (app.navFollow) {
      app.map.easeTo({ center: [app.lastFix.lon, app.lastFix.lat], bearing: heading, pitch: 50, zoom: cfg.zoom,
        offset: [0, Math.round(window.innerHeight * 0.18)], duration: 900 });
    }
    if (app.nav.arrived && !app.spoken.has('fin')) { app.spoken.add('fin'); speak(tx('guidage.vous_etes_arrive', { label: app.to.label })); return; }
    if (app.nav.kind === 'transit') {
      if (k !== prevK) speak(app.nav.steps[k].text);
      return;
    }
    // annonces : une de loin, une juste avant la manœuvre
    const next = app.nav.steps[k + 1];
    if (next) {
      const d = next.s - app.nav.s;
      if (d < cfg.near && !app.spoken.has(`${k + 1}n`)) { app.spoken.add(`${k + 1}n`); app.spoken.add(`${k + 1}f`); speak(next.speak || next.text); }
      else if (d < cfg.far && d > cfg.near * 2 && !app.spoken.has(`${k + 1}f`)) { app.spoken.add(`${k + 1}f`); speak(spokenDistance(d) + (next.speak || next.text).replace(/^./, (c) => c.toLowerCase())); }
    }
    // écart au trajet : nouveau calcul depuis la position actuelle
    app.offCount = p.off > cfg.off ? app.offCount + 1 : 0;
    if (app.offCount >= 3 && !app.rerouting) reroute();
  }
  /** Sans position (localisation refusée ou indisponible) : passer d'une étape à l'autre à la main (test P3). */
  function stepBy(d) {
    if (!app.nav) return;
    const last = app.nav.steps.length - 1;
    const k = Math.max(0, Math.min(last, app.nav.k + d));
    if (app.nav.kind === 'transit') { app.nav = { ...app.nav, k }; speak(app.nav.steps[k].text); return; }
    const s = app.nav.steps[k].s;
    app.nav = { ...app.nav, k, s };
    const next = app.nav.steps[k + 1];
    const at = app.nav.coords[Math.min(app.nav.coords.length - 1, next?.idx ?? app.nav.coords.length - 1)];
    const color = app.nav.mode === 'bike' ? app.BIKE_COLOR : app.WALK_COLOR;
    app.map.getSource('route')?.setData({ type: 'FeatureCollection', features: [app.line(remaining(app.nav, s), app.nav.mode, color, '#1B3F9E')] });
    app.navFollow = false;
    app.map.easeTo({ center: at, zoom: 17, pitch: 0, duration: 700 });
    if (next) speak(next.speak || next.text);
  }
  async function reroute() {
    app.rerouting = true;
    try {
      const passedVia = !app.showVia || !app.via || app.nav.steps.findIndex((st) => st.type === 'stop') <= app.nav.k;
      const r = await streetRoute({ lat: app.me.lat, lon: app.me.lon }, app.to, app.nav.mode, undefined, passedVia ? null : app.via, 0);
      if (!app.nav) return;
      let route = r;
      if (app.nav.mode === 'car') { const t = await trafficEstimate(app.me, app.to); route = { ...r, duration: r.duration * t.factor }; }
      app.nav = { ...app.nav, ...prepare(route.raw, route.steps, route.duration), option: route, s: 0, k: 0, startedAt: Date.now() };
      app.spoken = new Set();
      app.offCount = 0;
      app.say(tx('guidage.nouvel_itineraire'));
      speak(tx('guidage.nouvel_itineraire_2') + (route.steps[0]?.speak || ''));
      app.map.getSource('route')?.setData({ type: 'FeatureCollection', features: [app.line(route.coords, app.nav.mode, app.nav.mode === 'bike' ? app.BIKE_COLOR : app.WALK_COLOR, app.nav.mode === 'bike' ? '#1B3F9E' : '#1B3F9E')] });
    } catch { /* on réessaiera au prochain écart */ }
    app.rerouting = false;
  }
  function endNav() {
    if (app.navWatch != null) navigator.geolocation.clearWatch(app.navWatch);
    app.navWatch = null;
    clearInterval(app.navTick);
    app.wakeLock?.release?.().catch?.(() => {});
    app.wakeLock = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    app.nav = null;
    app.navList = false;
    app.meMarker?.setRotation(app.heading ?? 0);   // retour au faisceau de direction
    app.meMarker?.getElement().classList.remove('navigating');
    app.startWatch();
    app.map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    app.drawRoute();
  }

  return { speak, transitSteps, startNav, onFix, updateNav, stepBy, reroute, endNav };
}
