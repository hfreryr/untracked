// Position de l'utilisateur et boussole (rien n'est envoyé : tout reste sur l'appareil).
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { tx } from '#lib/i18n/index.js';
import { reverse } from '#lib/geocode.js';

/** @param {any} app */
export function createLocation(app) {
  function setHeading(h, fromCompass) {
    if (h == null || Number.isNaN(h)) return;
    if (!fromCompass && Date.now() - app.lastCompass < 3000) return;   // la boussole prime sur le GPS
    if (fromCompass) app.lastCompass = Date.now();
    // lissage (sans faire le tour par 360 → 0)
    if (app.heading == null) app.heading = h;
    else { const d = ((h - app.heading + 540) % 360) - 180; if (Math.abs(d) < 1.5) return; app.heading = (app.heading + d * 0.35 + 360) % 360; }
    if (app.nav) return;   // pendant le guidage, la flèche suit le trajet
    const el = app.meMarker?.getElement();
    el?.classList.add('has-heading');
    app.meMarker?.setRotation(app.heading);
    if (app.followMode === 'heading' && !app.map.isMoving()) app.map.easeTo({ bearing: app.heading, duration: 250, easing: (t) => t });
  }
  function onOrientation(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;          // iPhone
    else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;                  // Android
    if (h == null) return;
    h = (h + (screen.orientation?.angle || 0) + 360) % 360;                                // écran en paysage
    setHeading(h, true);
  }
  // iPhone : l'accès à la boussole se demande lors d'un geste (le bouton de localisation)
  async function startCompass() {
    if (app.compassOn) return;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return;
      }
    } catch { return; }
    app.compassOn = true;
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOrientation);
    else window.addEventListener('deviceorientation', onOrientation);
  }
  // Suivre la position tant que l'app est à l'écran (le point bouge avec vous)
  function startWatch() {
    if (app.posWatch != null || !navigator.geolocation || app.nav) return;
    app.posWatch = navigator.geolocation.watchPosition(({ coords }) => {
      if (app.nav) return;
      app.me = { label: tx('resultats.votre_position'), lat: coords.latitude, lon: coords.longitude, isMe: true };
      app.showMe(app.me.lat, app.me.lon);
      app.followFrom();                    // itinéraire ouvert depuis votre position : il suit vos déplacements
      if (coords.speed > 1 && coords.heading != null) setHeading(coords.heading, false);
      if (app.followMode !== 'none' && !app.map.isMoving()) app.map.easeTo({ center: [app.me.lon, app.me.lat], duration: 600 });
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  }
  function stopWatch() {
    if (app.posWatch != null) navigator.geolocation.clearWatch(app.posWatch);
    app.posWatch = null;
  }
  // La position reste sur l'appareil : elle n'est envoyée qu'aux moteurs d'itinéraire, au moment du calcul.
  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('unsupported'));
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          app.me = { label: tx('resultats.votre_position'), lat: coords.latitude, lon: coords.longitude, isMe: true };
          app.showMe(app.me.lat, app.me.lon);
          startWatch();
          try { localStorage.setItem('position-ok', '1'); } catch { /* rien */ }
          resolve(app.me);
        },
        (err) => {
          // délai dépassé en haute précision (intérieur, GPS froid) : on retente avec la position approximative
          if (err.code !== 3) return reject(err);
          navigator.geolocation.getCurrentPosition(({ coords }) => {
            app.me = { label: tx('resultats.votre_position'), lat: coords.latitude, lon: coords.longitude, isMe: true };
            app.showMe(app.me.lat, app.me.lon);
            startWatch();
            resolve(app.me);
          }, reject, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });
  }
  // Position refusée à l'ouverture : on le dit une fois, avec la marche à suivre (P6 et P7, iPhone avec Chrome
  // et Firefox : la carte restait sur Paris sans explication). Ensuite, plus rien : le refus peut être voulu.
  function sayRefusedOnce(e) {
    if (app.showPromise) return;                          // (l'écran de bienvenue passe d'abord)
    let told = false;
    try { told = localStorage.getItem('position-refus-dit') === '1'; localStorage.setItem('position-refus-dit', '1'); } catch { /* rien */ }
    if (!told) app.say(locError(e), { label: tx('itin.reessayer'), run: locate });
  }
  // À l'ouverture, comme les cartes de référence : on se centre sur vous si vous l'acceptez.
  // Refus : un message, une seule fois. Autre erreur : la carte reste sur Paris, sans message.
  async function startupLocate() {
    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
      if (perm?.state === 'denied') { sayRefusedOnce({ code: 1 }); return; }
      // App installée sur l'écran d'accueil : iOS peut refuser (et mémoriser le refus) une demande faite sans
      // geste de l'utilisateur. On attend donc qu'il touche le bouton de localisation la première fois.
      const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      let ok = false;
      try { ok = localStorage.getItem('position-ok') === '1'; } catch { /* rien */ }
      if (standalone && !ok && perm?.state !== 'granted') {
        if (!app.showPromise) app.say(tx('position.touchez_la_fleche_pour_vous'));
        return;
      }
      let firstTime = false;
      try { firstTime = !localStorage.getItem('position-expliquee'); localStorage.setItem('position-expliquee', '1'); } catch { /* rien */ }
      if (firstTime && perm?.state !== 'granted' && !app.showPromise) app.say(tx('position.votre_position_reste_sur_votre'));
      const p = await getPosition();
      // (pas si la personne a déjà choisi quoi regarder entre-temps : position arrivée tard)
      if (!app.place && !app.category && !app.directions && !app.viewChosen) { app.followMode = 'follow'; app.map.flyTo({ center: [p.lon, p.lat], zoom: 15.5, duration: 900 }); }
    } catch (e) {
      if (e?.code === 1) sayRefusedOnce(e);                // sinon on reste sur Paris, sans message
    }
  }
  // Un message qui dit la vraie cause (refus, page non sécurisée, signal introuvable, délai dépassé)
  function locError(e) {
    if (!window.isSecureContext) return tx('position.localisation_impossible_la_page_est');
    if (e?.code === 1) {
      const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      if (app) return tx('position.iphone_refuse_la_localisation_a_app');
      // iPhone avec Chrome, Firefox ou Edge : l'autorisation se donne dans les réglages de l'iPhone, pas du navigateur
      const ua = navigator.userAgent;
      const other = /CriOS/.test(ua) ? tx('position.nav_chrome') : /FxiOS/.test(ua) ? tx('position.nav_firefox') : /EdgiOS/.test(ua) ? tx('position.nav_edge') : null;
      return other ? tx('position.iphone_navigateur_refuse', { navigateur: other }) : tx('position.localisation_refusee_autorisez_la');
    }
    if (e?.code === 3) return tx('position.position_pas_encore_trouvee_delai');
    if (e?.code === 2) return tx('position.position_introuvable_verifiez_que_le');
    return tx('position.localisation_indisponible_sur_cet');
  }
  // Détail technique ajouté au message (pour diagnostiquer à distance une localisation qui ne marche pas)
  const locDetail = (e) => tx('position.code', { mode: matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'app' : tx('position.navigateur'), securite: window.isSecureContext ? 'https' : tx('position.non_securise'), code: e?.code ?? '?', suite: e?.message ? ` · ${e.message}` : '' });
  // Bouton de localisation, comme Plans et Maps : 1er toucher → centré sur vous ; 2e → la carte tourne
  // dans la direction où vous regardez ; 3e → retour au nord en haut.
  async function locate() {
    // iPhone (app sur l'écran d'accueil) : une seule demande d'autorisation par toucher. La position passe
    // en premier ; la boussole n'est demandée qu'au 2e toucher (« la carte tourne avec vous »).
    if (app.me && app.followMode === 'follow') {
      startCompass();   // (doit partir du geste, avant toute attente)
      app.followMode = 'heading';
      app.map.easeTo({ center: [app.me.lon, app.me.lat], bearing: app.heading ?? app.map.getBearing(), duration: 500 });
      if (app.heading == null && app.compassOn) app.say(tx('position.direction_pas_encore_disponible'));
      return;
    }
    if (app.me && app.followMode === 'heading') {
      app.followMode = 'follow';
      app.map.easeTo({ center: [app.me.lon, app.me.lat], bearing: 0, duration: 500 });
      return;
    }
    app.locating = true;
    try {
      const p = await getPosition();
      app.followMode = 'follow';
      // là où aucune autorisation n'est demandée (Android, ordinateur), la boussole démarre tout de suite
      if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission !== 'function') startCompass();
      app.map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(16, app.map.getZoom()), duration: 800 });
    } catch (e) {
      app.say(locError(e) + locDetail(e), { label: tx('itin.reessayer'), run: locate });
    } finally {
      app.locating = false;
    }
  }
  // Point choisi en touchant la carte : on retrouve l'adresse la plus proche.
  async function pickOnMap(which, { lng, lat }) {
    const pt = { label: tx('position.point_sur_la_carte'), lat, lon: lng };
    app.setPoint(which, pt);
    if (which === 'to') app.placeMarker(lng, lat);
    app.editing = null;
    app.lastEdit = { which: null, at: 0 };
    app.fieldQuery = '';
    app.results = [];
    app.computeRoutes();
    const label = await reverse(lat, lng).catch(() => null);
    if (label) {
      // (les objets d'état sont des copies : on compare les coordonnées)
      const same = (q) => q && q.lat === lat && q.lon === lng;
      if (same(app.pointOf(which))) app.setPoint(which, { ...pt, label });
    }
  }

  return { setHeading, onOrientation, startCompass, startWatch, stopWatch, getPosition, startupLocate, locError, locDetail, locate, pickOnMap };
}
