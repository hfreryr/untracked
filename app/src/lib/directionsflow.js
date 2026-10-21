// Itinéraire : départ, arrivée, étapes, calcul et choix du mode.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { tx } from '#lib/i18n/index.js';
import { empty } from '#lib/maplayers.js';
import { streetRoute, trafficEstimate, transitRoutes, transitWithStop, transitModesFor } from '#lib/routing.js';
import { tick } from 'svelte';

/** @param {any} app */
export function createDirections(app) {
  // ——— Itinéraire ———
  async function startDirections() {
    app.directions = true;
    app.dimPlaces(true);
    app.to = { label: app.place.name, lat: app.place.lat, lon: app.place.lon };
    app.clearSelection();
    app.placeMarker(app.to.lon, app.to.lat);
    app.via = null;
    app.showVia = false;
    app.when = null;                       // chaque nouvel itinéraire part « maintenant »
    app.routes = { walk: null, bike: null, transit: null };
    app.picked = 0;
    try {
      app.from = app.me || (await app.getPosition());
      const d = app.dist(app.from.lat, app.from.lon, app.to.lat, app.to.lon);
      app.mode = d > 2500 ? 'transit' : 'walk';
      computeRoutes();
    } catch {
      app.from = null;
      editField('from');
    }
  }
  /** Itinéraire sans lieu choisi d'abord (P5 : « pas de bouton pour faire un itinéraire ? ») : départ = votre position
   *  si elle est connue, et l'on tape tout de suite la destination. */
  function openDirections() {
    app.directions = true;
    app.dimPlaces(true);
    app.clearSelection?.();
    app.to = null;
    app.via = null;
    app.showVia = false;
    app.when = null;
    app.routes = { walk: null, bike: null, transit: null };
    app.picked = 0;
    app.mode = 'transit';
    app.from = app.me || null;
    if (!app.from) app.getPosition().then((p) => { if (app.directions && !app.from) { app.from = p; app.computeRoutes(); } }).catch(() => {});
    editField('to');
  }
  function closeDirections() {
    app.directions = false;
    app.dimPlaces(false);
    app.editing = null;
    app.routeCtrl?.abort();
    app.routes = { walk: null, bike: null, transit: null };
    app.map.getSource('route')?.setData(empty());
    app.map.getSource('route-ends')?.setData(empty());
    app.map.getSource('route-tags')?.setData(empty());
    if (app.place) { app.showSelection(app.place); app.frame(app.place.lon, app.place.lat); }
  }
  const pointOf = (which) => ({ from: app.from, via: app.via, to: app.to })[which];
  function setPoint(which, pt) {
    if (which === 'from') app.from = pt;
    else if (which === 'via') app.via = pt;
    else app.to = pt;
  }
  function addStop() {
    app.showVia = true;
    editField('via');
  }
  function removeStop() {
    app.showVia = false;
    app.via = null;
    if (app.editing === 'via') app.editing = null;
    computeRoutes();
  }
  async function editField(which) {
    app.editing = which;
    app.fieldQuery = '';
    app.results = [];
    await tick();
    app.fieldEl?.focus();
  }
  function useMyPosition() {
    app.editing = null;
    app.getPosition().then((p) => { app.from = p; computeRoutes(); })
      .catch((e) => app.say(tx('itin.en_attendant_choisissez_un_point_de', { locError: app.locError(e) })));
  }
  function swap() {
    [app.from, app.to] = [app.to, app.from];
    if (app.to) app.placeMarker(app.to.lon, app.to.lat);
    computeRoutes();
  }
  function computeRoutes() {
    app.routeCtrl?.abort();
    if (!app.from || !app.to || (app.showVia && !app.via)) return;
    app.routeCtrl = new AbortController();
    const signal = app.routeCtrl.signal;
    app.picked = 0;
    app.pickedStreet = 0;
    app.transitDetail = false;
    app.focusLeg = null;
    app.routes = { walk: { status: 'loading' }, bike: { status: 'loading' }, transit: { status: 'loading' }, car: { status: 'loading' } };
    const run = async (id, fn) => {
      try {
        const data = await fn();
        if (signal.aborted) return;
        app.routes[id] = (Array.isArray(data) && !data.length) ? { status: 'none' } : { status: 'ok', data };
      } catch (e) {
        if (e.name === 'AbortError') return;
        app.routes[id] = { status: e.message === 'no-route' ? 'none' : 'error' };
      }
      if (id === app.mode) app.drawRoute();
    };
    const v = app.showVia ? app.via : null;
    // serveur FOSSGIS : une demande par seconde ; le mode affiché passe en premier
    const prio = (m) => (m === app.mode ? 0 : 1);
    run('walk', () => streetRoute(app.from, app.to, 'walk', signal, v, prio('walk')));
    run('bike', () => streetRoute(app.from, app.to, 'bike', signal, v, prio('bike')));
    const modes = transitModesFor(app.transitPref);
    // heure choisie (when.js) : maintenant, partir à, ou arriver à
    const w = app.when, at = new Date(w ? w.t : Date.now()), arrive = !!w?.arrive;
    run('transit', () => (v ? transitWithStop(app.from, v, app.to, signal, at, modes, arrive) : transitRoutes(app.from, app.to, signal, at, modes, arrive)));
    run('car', async () => {
      const r = await streetRoute(app.from, app.to, 'car', signal, v, prio('car'));
      // trafic habituel à l'heure du départ (pour « arriver à » : départ estimé sans trafic, à l'heure près)
      const t = await trafficEstimate(app.from, app.to, new Date(arrive ? +at - r.duration * 1000 : +at));
      const withTraffic = (x) => ({ ...x, freeDuration: x.duration, duration: x.duration * t.factor, traffic: t.label });
      return { ...withTraffic(r), alts: r.alts.map(withTraffic) };
    });
  }
  function chooseMode(m) {
    app.mode = m;
    app.picked = 0;
    app.transitDetail = false;
    app.focusLeg = null;
    app.pickedStreet = 0;
    app.showSteps = false;
    app.drawRoute();
  }
  // Choisir un autre itinéraire : son résumé remonte en tête de fiche.
  const sheetToTop = () => document.querySelector('.route-sheet')?.scrollTo({ top: 0, behavior: 'smooth' });
  function pickStreet(i) {
    app.pickedStreet = i;
    app.drawRoute(false);
    sheetToTop();
  }
  function pickTransit(i) {
    app.picked = i;
    app.focusLeg = null;
    app.drawRoute();
    sheetToTop();
  }
  // Transports : la liste des propositions, puis le détail d'une proposition étape par étape (comme Citymapper).
  function openTransit(i) {
    pickTransit(i);
    app.transitDetail = true;
  }
  function closeTransit() {
    app.transitDetail = false;
    app.focusLeg = null;
    app.drawRoute();
    sheetToTop();
  }
  /** Toucher une étape (dans la fiche ou son trait sur la carte) : la carte cadre ce bout, le reste s'estompe ; retoucher : tout le trajet. */
  function focusOnLeg(li) {
    app.transitDetail = true;
    app.focusLeg = app.focusLeg === li ? null : li;
    app.drawRoute();
    requestAnimationFrame(() => document.querySelector(`.route-sheet [data-leg="${li}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  /** Retirer ou remettre une famille de transports (P4 : « seulement le métro » ; P5 : « pas de bus »). Il en reste toujours une. */
  function setTransitPref(kind) {
    const on = app.transitPref.includes(kind);
    if (on && app.transitPref.length === 1) return;
    app.transitPref = on ? app.transitPref.filter((k) => k !== kind) : [...app.transitPref, kind];
    app.picked = 0;
    computeRoutes();
  }
  /** Heure du trajet : null (maintenant) ou { t, arrive } (WhenPicker). */
  function setWhen(w) {
    app.when = w;
    app.picked = 0;
    computeRoutes();
  }
  return { startDirections, openDirections, closeDirections, pointOf, setPoint, addStop, removeStop, editField, useMyPosition, swap, computeRoutes, chooseMode, sheetToTop, pickStreet, pickTransit, openTransit, closeTransit, focusOnLeg, setTransitPref, setWhen };
}
