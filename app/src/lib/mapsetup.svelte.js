// Mise en place de la carte : style clair/sombre, liens partagés à l'ouverture, écouteurs.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { applyTheme, isDark } from '#lib/theme.js';
import { tx } from '#lib/i18n/index.js';
import { PARIS } from '#lib/places.js';
import { followLandmarks } from '#lib/landmarkstore.js';
import { mapStyle, provideImage } from '#lib/mapstyle.js';
import * as maplibregl from 'maplibre-gl';
import { restore, unpack, unpackList } from '#lib/myplaces.js';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

/** @param {any} app */
export function createMapSetup(app) {
  // Mise en place de la carte et des écouteurs (fenêtre, réseau, boussole)
  function setupMap() {
    maplibregl.setWorkerUrl(workerUrl);
    const fresh = !location.hash.includes('carte='); // ouverture « à neuf » (pas un lien vers un endroit précis)
    // Mode sombre : suit le réglage du téléphone, y compris s'il change pendant l'utilisation.
    const darkMQ = matchMedia('(prefers-color-scheme: dark)');
    applyTheme(app.themePref);              // choix « Clair » / « Sombre » retenu sur l'appareil (theme.js)
    app.dark = isDark(app.themePref);
    const base = new URL('.', location.href).href;
    app.map = new maplibregl.Map({
      container: app.mapEl,
      style: mapStyle(base, app.dark),
      center: [PARIS.lon, PARIS.lat],
      zoom: 13,
      hash: 'carte',
      attributionControl: false,   // mention « © OpenStreetMap » 5 s (MapCredit.svelte), crédits complets dans ⓘ (AboutDialog.svelte)
      fadeDuration: 200
    });
    app.map.setMissingStyleImageResolver((id) => provideImage(app.map, id));
    if (location.hostname === 'localhost') window.__map = app.map; // pour les tests locaux
    if (location.hostname === 'localhost') window.__nav = () => app.nav && { k: app.nav.k, s: app.nav.s, total: app.nav.total, coords: $state.snapshot(app.nav.coords) };
    // Nos calques (trajet, favoris) sont à rajouter à chaque changement de style (clair ↔ sombre).
    app.map.on('style.load', app.addCustomLayers);
    followLandmarks(app.map);   // lieux mis en avant, mêmes règles dans toutes les zones (landmarkstore.js)
    darkMQ.addEventListener('change', () => { if (app.themePref === 'auto') app.restyle(); });
    app.restyle = () => { app.dark = isDark(app.themePref); app.map.setStyle(mapStyle(base, app.dark)); };
    app.map.once('load', () => {
      if (fresh) app.startupLocate();
      // Liste partagée (…#liste=…) ou transfert depuis un autre appareil (…#transfert=…) : tout est dans le lien.
      const lm = /[#&]liste=([\w-]+)/.exec(location.hash), tm = /[#&]transfert=([\w-]+)/.exec(location.hash);
      if (lm || tm) {
        history.replaceState(history.state, '', location.href.replace(/[#&](liste|transfert)=[\w-]+/, ''));
        if (tm) unpack(tm[1]).then((raw) => { app.incoming = { kind: 'transfer', raw, data: restore(raw) }; }).catch(() => app.say(tx('ecran.ce_lien_de_transfert_est_incomplet')));
        else unpackList(lm[1]).then((r) => {
          app.incoming = { kind: 'list', ...r };
          app.category = { key: 'shared', saved: true, shared: true, label: r.list.name, name: r.list.name, icon: r.list.icon || 'star', color: r.list.color || '#2A5BD7' };
          app.refreshSaved();
          const pts = app.nearby.slice(0, 10).map((n) => n.f.geometry.coordinates);
          if (pts.length) app.fitTo(pts);
        }).catch(() => app.say(tx('ecran.ce_lien_de_liste_est_incomplet')));
      }
      // Lien partagé vers un lieu (…#carte=…&lieu=node/123) : on rouvre sa fiche.
      const shared = /[#&]lieu=(node|way|relation)\/(\d+)/.exec(location.hash);
      if (shared) {
        const c = app.map.getCenter();
        app.openPlace({ id: `${shared[1]}${shared[2]}`, osmType: shared[1], osmId: Number(shared[2]), name: '', type: '', address: '', lat: c.lat, lon: c.lng });
      }
    });
    app.map.on('click', app.onMapClick);
    // Catégorie ouverte : quand on déplace ou zoome la carte à la main, la liste se recharge pour la nouvelle zone.
    app.map.on('movestart', (e) => { if (e.originalEvent) app.userMoved = app.viewChosen = true; });
    app.map.on('moveend', () => {
      setTimeout(() => (app.viewHash = location.hash), 500);   // (la carte met à jour l’adresse avec un léger délai)
      if (!app.userMoved) return;
      app.userMoved = false;
      clearTimeout(app.reloadTimer);
      app.reloadTimer = setTimeout(app.reloadCategoryHere, 350);
    });
    app.map.on('dragstart', (e) => {
      if (!e.originalEvent) return;
      if (app.nav) app.navFollow = false;
      if (app.followMode !== 'none') app.followMode = 'none';
    });
    // l'app passe en arrière-plan : on arrête de suivre la position (batterie)
    const onVis = () => { if (document.hidden) app.stopWatch(); else if (app.me) app.startWatch(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('popstate', app.onPopState);
    window.addEventListener('keydown', app.onKeyDown);
    const offline = () => app.say(tx('ecran.pas_de_connexion_la_recherche_et_les'));
    const online = () => app.say(tx('ecran.connexion_retablie'));
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    // Boussole : visible seulement quand la carte est tournée ou inclinée.
    const orient = () => { app.bearing = app.map.getBearing(); app.pitch = app.map.getPitch(); };
    app.map.on('rotate', orient);
    app.map.on('pitch', orient);
    // Appui long (ou clic droit) : adresse du point, même si une fiche est ouverte.
    app.map.on('contextmenu', (e) => { if (!app.directions) app.openPoint(e.lngLat); });
    for (const id of ['poi', 'poi-outside', 'poi-other', 'poi-hit', 'landmark', 'metro', 'fav']) {
      app.map.on('mouseenter', id, () => (app.map.getCanvas().style.cursor = 'pointer'));
      app.map.on('mouseleave', id, () => (app.map.getCanvas().style.cursor = ''));
    }
    return () => {
      window.removeEventListener('popstate', app.onPopState);
      window.removeEventListener('keydown', app.onKeyDown);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      app.map.remove();
    };
  }

  return { setupMap };
}
