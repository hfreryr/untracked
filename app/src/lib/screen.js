// Écran : messages, retour arrière, touche Échap, couches visibles.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import * as maplibregl from 'maplibre-gl';
import { closeAll } from '#lib/popover.js';

/** @param {any} app */
export function createScreen(app) {
  function say(msg, action = null) {
    app.toast = msg;
    app.toastAction = action;
    clearTimeout(app.toastTimer);
    app.toastTimer = setTimeout(() => { app.toast = ''; app.toastAction = null; }, action ? 6000 : 3500);
  }
  // Une catégorie choisie : on n'affiche plus qu'elle sur la carte (les autres lieux s'effacent).
  function isolate() {
    if (!app.map) return;
    const only = app.category && !app.directions;
    const vis = (id, on) => app.map.getLayer(id) && app.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    for (const id of ['poi', 'poi-other', 'landmark', 'exit']) vis(id, !only);
    vis('fav', !only && app.showSaved);
    vis('fav-label', !only && app.showSaved);
    vis('metro', !only || !!app.category?.transit);
  }
  // Fermer « ce qui est au-dessus » : Échap, ou le bouton Retour du téléphone.
  function closeTop() {
    if (closeAll()) return true;                       // un menu ouvert se ferme en premier (règles d'interface)
    if (app.aboutOpen) app.aboutOpen = false;
    else if (app.viewer != null) app.viewer = null;
    else if (app.placeMenu) app.placeMenu = false;
    else if (app.listPicker) app.listPicker = false;
    else if (app.hubPanel) app.hubPanel = null;
    else if (app.savedList) { app.savedList = null; app.refreshSaved(); }
    else if (app.navList) app.navList = false;
    else if (app.nav) app.endNav();
    else if (app.showModes) app.showModes = false;
    else if (app.editing) app.editing = null;
    else if (app.editChips || app.importOpen) { app.editChips = false; app.importOpen = false; }
    else if (app.directions) app.closeDirections();
    else if (app.place) app.closePlace();
    else if (app.category) app.clearCategory();
    else if (app.focused) { app.focused = false; document.activeElement?.blur(); }
    else return false;
    return true;
  }
  function onPopState() {
    if (app.viewHash && location.hash !== app.viewHash) history.replaceState(history.state, '', location.pathname + location.search + app.viewHash);
    if (app.skipPop) { app.skipPop = false; return; }
    closeTop();
    // encore un panneau dessous (une fiche ouverte depuis une liste) : Retour le fermera aussi
    if (app.anyOpen) history.pushState({ ...(history.state || {}), ui: 1 }, '', location.href);
  }
  function onKeyDown(e) {
    if (app.viewer != null && app.viewerEl && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      app.viewerEl.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * app.viewerEl.clientWidth, behavior: 'smooth' });
      return;
    }
    if (e.key === 'Escape' && closeTop()) e.preventDefault();
  }
  function undoToast() {
    const a = app.toastAction;
    app.toast = '';
    app.toastAction = null;
    a?.run();
  }
  // Point bleu de votre position, avec un faisceau qui montre la direction où vous regardez (boussole du téléphone).
  function showMe(lat, lon) {
    if (!app.meMarker) {
      const el = document.createElement('div');
      el.className = 'me';
      el.innerHTML = '<span class="me-beam"></span><span class="me-dot"></span>';
      app.meMarker = new maplibregl.Marker({ element: el, rotationAlignment: 'map' });
      if (app.heading != null) { el.classList.add('has-heading'); app.meMarker.setRotation(app.heading); }
    }
    app.meMarker.setLngLat([lon, lat]).addTo(app.map);
  }

  return { say, isolate, closeTop, onPopState, onKeyDown, undoToast, showMe };
}
