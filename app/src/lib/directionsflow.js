// Itinéraire : départ, arrivée, étapes, calcul et choix du mode.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { accessPoint, withAccess } from '#lib/access.js';
import { retime } from '#lib/passages.js';
import { tx } from '#lib/i18n/index.js';
import { empty } from '#lib/maplayers.js';
import { streetRoute, trafficEstimate, transitRoutes, transitWithStop, transitModesFor } from '#lib/routing.js';
import { tick } from 'svelte';
import { pickMode, readLastMode, saveLastMode } from '#lib/defaultmode.js';

/** @param {any} app */
export function createDirections(app) {
  // ——— Itinéraire ———
  async function startDirections() {
    app.directions = true;
    app.dimPlaces(true);
    app.to = { label: app.place.name, lat: app.place.lat, lon: app.place.lon, osmType: app.place.osmType, osmId: app.place.osmId,
      ...(app.info?.covered ? { access: app.info.access || null } : {}) };
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
      app.mode = pickMode(readLastMode(), d);          // le dernier mode choisi, sauf trajet déraisonnable (defaultmode.js)
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
    app.mode = pickMode(readLastMode(), null);
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
    app.syncBike();                                    // la carte vélo de l'itinéraire s'efface (sauf type « Vélo »)
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
  /**
   * Calcule les itinéraires de tous les modes.
   * @param {{ keep?: boolean }} [opts]  keep : mise à jour discrète (le départ a bougé) — on garde le trajet choisi,
   *   l'affichage en cours et le cadrage de la carte ; une erreur ne remplace pas l'ancien résultat.
   */
  function computeRoutes(opts) {
    const keep = opts?.keep === true;
    app.routeCtrl?.abort();
    if (!app.from || !app.to || (app.showVia && !app.via)) return;
    app.routeCtrl = new AbortController();
    const signal = app.routeCtrl.signal;
    if (!keep) {
      app.picked = 0;
      app.pickedStreet = 0;
      app.transitDetail = false;
      app.focusLeg = null;
      app.routes = { walk: { status: 'loading' }, bike: { status: 'loading' }, transit: { status: 'loading' }, car: { status: 'loading' } };
    }
    const run = async (id, fn) => {
      try {
        const data = await fn();
        if (signal.aborted) return;
        app.routes[id] = (Array.isArray(data) && !data.length) ? { status: 'none' } : { status: 'ok', data };
        if (keep && id === 'transit' && Array.isArray(data)) app.picked = Math.min(app.picked, Math.max(0, data.length - 1));
        if (keep && id !== 'transit' && id === app.mode) app.pickedStreet = Math.min(app.pickedStreet, data.alts?.length || 0);
      } catch (e) {
        if (e.name === 'AbortError' || keep) return;
        app.routes[id] = { status: e.message === 'no-route' ? 'none' : 'error' };
      }
      if (id === app.mode) app.drawRoute(!keep);
    };
    // grands lieux : on vise leur accès le plus proche de l'autre bout (access.js), pas leur centre
    const ends = Promise.all([withAccess(app.from), withAccess(app.to), withAccess(app.showVia ? app.via : null)])
      .then(([f, t, via]) => ({ from: accessPoint(f, via || t), to: accessPoint(t, via || f), v: via ? accessPoint(via, f) : null }));
    // serveur FOSSGIS : une demande par seconde ; le mode affiché passe en premier
    const prio = (m) => (m === app.mode ? 0 : 1);
    run('walk', async () => { const e = await ends; return streetRoute(e.from, e.to, 'walk', signal, e.v, prio('walk')); });
    run('bike', async () => { const e = await ends; return streetRoute(e.from, e.to, 'bike', signal, e.v, prio('bike')); });
    const modes = transitModesFor(app.transitPref);
    // heure choisie (when.js) : maintenant, partir à, ou arriver à
    const w = app.when, at = new Date(w ? w.t : Date.now()), arrive = !!w?.arrive;
    run('transit', async () => { const e = await ends; return e.v ? transitWithStop(e.from, e.v, e.to, signal, at, modes, arrive) : transitRoutes(e.from, e.to, signal, at, modes, arrive); });
    run('car', async () => {
      const e = await ends;
      const r = await streetRoute(e.from, e.to, 'car', signal, e.v, prio('car'));
      // trafic habituel à l'heure du départ (pour « arriver à » : départ estimé sans trafic, à l'heure près)
      const t = await trafficEstimate(e.from, e.to, new Date(arrive ? +at - r.duration * 1000 : +at));
      const withTraffic = (x) => ({ ...x, freeDuration: x.duration, duration: x.duration * t.factor, traffic: t.label });
      return { ...withTraffic(r), alts: r.alts.map(withTraffic) };
    });
  }
  /**
   * Autre passage choisi à l'étape `li` du trajet affiché (LegCards) : le trajet est recalculé depuis cet arrêt, avec
   * les correspondances qui suivent (passages.js). Le trajet d'origine reste dans la liste des propositions.
   */
  async function retimeLeg(li, time) {
    const r = app.routes.transit;
    const it = r?.data?.[app.picked];
    if (!it) return;
    app.retiming = li;
    try {
      const [f, t] = await Promise.all([withAccess(app.from), withAccess(app.to)]);
      const it2 = await retime(it, li, time, accessPoint(t, f), transitModesFor(app.transitPref));
      const data = r.data.slice();
      data[app.picked] = it2;
      app.routes = { ...app.routes, transit: { ...r, data } };
      app.drawRoute(false);
    } catch {
      app.say(tx('itin.passage_impossible'));
    } finally {
      app.retiming = null;
    }
  }
  // Départ = votre position : l'itinéraire suit vos déplacements (porteur, 21/10), discrètement.
  // Au plus un calcul toutes les 30 s et seulement après 50 m : les serveurs prêtés limitent les demandes (FOSSGIS : 1 par seconde).
  let lastFollow = 0;
  function followFrom() {
    if (!app.directions || app.nav || app.editing || !app.from?.isMe || !app.me || !app.to) return;
    if (Date.now() - lastFollow < 30000 || app.dist(app.from.lat, app.from.lon, app.me.lat, app.me.lon) < 50) return;
    lastFollow = Date.now();
    app.from = app.me;
    computeRoutes({ keep: true });
  }
  function chooseMode(m) {
    app.mode = m;
    saveLastMode(m);                                   // proposé par défaut au prochain itinéraire
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
  /**
   * Toucher une étape (dans la fiche ou son trait sur la carte) : la fiche se réduit à une fine bande, la carte cadre
   * ce bout et estompe le reste, comme Citymapper (porteur, 22/10). Retoucher la même étape : tout le trajet.
   */
  function focusOnLeg(li) {
    app.transitDetail = true;
    app.focusLeg = app.focusLeg === li ? null : li;
    const sheet = document.querySelector('.route-sheet');
    if (app.focusLeg != null) sheet?.dispatchEvent(new CustomEvent('sheetsnap', { detail: 'min' }));
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
  return { retimeLeg, startDirections, openDirections, closeDirections, pointOf, setPoint, addStop, removeStop, editField, useMyPosition, swap, computeRoutes, followFrom, chooseMode, sheetToTop, pickStreet, pickTransit, openTransit, closeTransit, focusOnLeg, setTransitPref, setWhen };
}
