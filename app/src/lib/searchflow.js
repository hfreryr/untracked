// Recherche et catégories : résultats, filtres « ouvert », liste autour de la carte.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { tx } from '#lib/i18n/index.js';
import { tick } from 'svelte';
import { ARR_CENTERS, fitsDiet } from '#lib/intent.js';
import { FAMILIES } from '#lib/mapstyle.js';
import { departures } from '#lib/routing.js';
import { empty } from '#lib/maplayers.js';
import { hoursStatus, statusAt } from '#lib/hours.js';
import { search, searchAllPlaces, isPlaceResult, localFirst } from '#lib/geocode.js';
import { splitByFilters } from '#lib/filters.js';
import { placeById } from '#lib/placestore.js';
import { searchCategory } from '#lib/places.js';

/** @param {any} app */
export function createSearch(app) {
  function clearSearch() {
    app.query = '';
    app.results = [];
    app.closePlace();
  }
  const hitFilter = (c) => (c.transit ? ['==', ['get', 'subclass'], '__none__'] : ['match', ['get', c.by || 'subclass'], c.classes, true, false]);
  const catIcon = (c) => c.icon || FAMILIES[c.family]?.icon || 'dot';
  // Lieux mis en avant : filtre, pictogramme et couleur de la catégorie choisie.
  // Les lieux de la liste sont aussi posés sur la carte (y compris ceux trouvés hors de la vue).
  function applyHit(c) {
    const src = app.map?.getSource('cat-hits');
    if (!src) return;
    if (!c || c.transit) return src.setData(empty());
    src.setData({ type: 'FeatureCollection', features: app.nearby.map(({ f }, i) => ({
      type: 'Feature', id: i, geometry: { type: 'Point', coordinates: f.geometry.coordinates },
      properties: { i, name: displayName(f, c), icon: app.nearby[i].icon || `cat|${catIcon(c)}|${app.famColor(c)}`, tc: app.nearby[i].tc || app.labelColor(app.famColor(c)) } })) });
  }
  // Un lieu sans nom (toilettes, borne…) ou au nom de code (« G-040 ») prend le nom de sa catégorie.
  const displayName = (f, c) => {
    const n = f.properties.name;
    return !n || (c?.unnamed && /^[A-Z0-9][A-Z0-9 _-]{0,9}$/.test(n)) ? c?.unnamed || n || tx('resultats.sans_nom') : n;
  };
  // Lieux d'une catégorie autour d'un point. `fit` : élargir la carte si les plus proches sont hors de la vue
  // (seulement au premier choix de la catégorie, jamais quand on déplace la carte soi-même).
  async function collectCategory(c, origin, fit) {
      const req = ++app.catRequest;
      const stale = () => req !== app.catRequest || app.category?.key !== c.key;
      const o = origin || { lat: app.map.getCenter().lat, lon: app.map.getCenter().lng };
      const seen = new Set();
      const filter = c.transit
        ? ['all', ['has', 'name'], ['==', ['get', 'class'], 'railway'], ['match', ['get', 'subclass'], ['subway', 'station', 'halt'], true, false]]
        : c.unnamed ? hitFilter(c) : ['all', ['has', 'name'], hitFilter(c)];
      // Une station a souvent plusieurs points (un par ligne) : on n'en garde qu'un par nom.
      const keyOf = (f) => (c.transit ? f.properties.name : f.id);
      const list = app.map.querySourceFeatures('omt', { sourceLayer: 'poi', filter })
        .map((f) => ({ f, d: dist(o.lat, o.lon, f.geometry.coordinates[1], f.geometry.coordinates[0]) }))
        .sort((a, b) => a.d - b.d)
        .filter(({ f }) => !seen.has(keyOf(f)) && seen.add(keyOf(f)))
        .slice(0, c.transit ? 8 : 80);
      if (stale()) return;
      if (c.transit) {
        app.nearby = list.map((n) => ({ ...n, deps: { status: 'loading' } }));
        app.nearbyDone = true;
        // Prochains passages des stations les plus proches, directement dans la liste.
        list.slice(0, 5).forEach((n, i) => {
          const [lon, lat] = n.f.geometry.coordinates;
          departures(n.f.properties.name, lat, lon)
            .then((d) => d?.lines.length ? { status: 'ok', data: d } : { status: 'none' })
            .catch(() => ({ status: 'error' }))
            .then((deps) => { if (!stale() && app.nearby[i]?.f.id === n.f.id) app.nearby[i] = { ...app.nearby[i], deps }; });
        });
        for (let i = 5; i < app.nearby.length; i++) app.nearby[i] = { ...app.nearby[i], deps: null };
        return;
      }
      // Compléter avec les lieux des tuiles préparées (tout ce qui est dans la zone, y compris hors de la vue
      // et sans nom dans la carte) : catégories rares, et horaires de chacun.
      const bb = app.map.getBounds();
      const span = Math.max(bb.getEast() - bb.getWest(), 0.02);
      const zone = { west: o.lon - span, east: o.lon + span, south: o.lat - span * 0.66, north: o.lat + span * 0.66 };
      const extra = c.inc ? await searchCategory(c.inc, zone, c.q).catch(() => []) : [];
      if (stale()) return;
      // régime demandé (« restaurant végétarien ») : seuls les lieux des tuiles portent l'information
      if (c.diet) {
        list.length = 0;
        for (const f of extra) if (fitsDiet(c.diet, f.tags)) list.push({ f, d: dist(o.lat, o.lon, f.geometry.coordinates[1], f.geometry.coordinates[0]) });
      }
      const near = (a, b) => dist(a[1], a[0], b[1], b[0]) < 80;
      const byName = new Map(extra.map((f) => [f.properties.name, f]));
      for (const f of c.diet ? [] : extra) {
        const xy = f.geometry.coordinates;
        if (list.some((n) => n.f.properties.name === f.properties.name && near(n.f.geometry.coordinates, xy))) continue;
        list.push({ f, d: dist(o.lat, o.lon, xy[1], xy[0]) });
      }
      list.sort((a, b) => a.d - b.d);
      list.splice(80);
      // horaires : ceux de la tuile (par nom et position, les identifiants des tuiles de carte étant parfois différents)
      const hoursOf = (f) => f.tags?.opening_hours
        || [...(byName.get(f.properties.name) ? [byName.get(f.properties.name)] : [])].find((x) => near(x.geometry.coordinates, f.geometry.coordinates))?.tags?.opening_hours
        || null;
      // (les lieux de la carte sont des objets MapLibre : on recopie leurs champs, un « ... » perdrait la géométrie)
      const withFacade = (f, facade) => ({ id: f.id, properties: f.properties, geometry: f.geometry, source: f.source, sourceLayer: f.sourceLayer, layer: f.layer, tags: f.tags, facade });
      const twin = (f) => f.tags ? f : (byName.get(f.properties.name) && near(byName.get(f.properties.name).geometry.coordinates, f.geometry.coordinates) ? byName.get(f.properties.name) : null);
      app.nearbyAll = list.map((n) => ({ ...n, h: hoursOf(n.f), t: twin(n.f)?.tags || null, sub: n.f.properties.subclass, f: n.f.facade || !twin(n.f)?.facade ? n.f : withFacade(n.f, twin(n.f).facade) }));
      applyOpenFilter();
      app.nearbyDone = true;
      // Les plus proches sont hors de la vue (catégorie rare) : on élargit la carte pour les montrer.
      const first = app.nearby.slice(0, 4).map((n) => n.f.geometry.coordinates);
      if (fit && first.length && !first.some((xy) => app.map.getBounds().contains(xy))) app.fitTo([[o.lon, o.lat], ...first]);
  }
  // Horaires (« ouvert maintenant », « ouvert à… ») et filtres (terrasse, végétarien…) appliqués à la liste.
  // Les lieux sans l'information sont mis à part, jamais présentés comme « non » (décision du 21/10).
  function applyOpenFilter() {
    const at = app.openAt?.at || null;
    const limit = app.category?.results ? 40 : 25;
    const items = app.nearbyAll.map((n) => {
      const [lon, lat] = n.f.geometry.coordinates;
      return { ...n, st: n.h ? (at ? statusAt(n.h, lat, lon, at) : hoursStatus(n.h, lat, lon)) : null };
    });
    const active = app.filters || [];
    if (!app.openAt && !active.length) { app.openCounts = null; app.nearby = items.slice(0, limit); return; }
    const { match, unknown, out } = splitByFilters(items, active, !!app.openAt);
    app.openCounts = { open: match.length, unknown: unknown.length, closed: out };
    app.nearby = [...match.slice(0, limit), ...(app.showUnknown ? unknown.slice(0, 20) : [])];
  }
  function toggleFilter(k) {
    app.filters = app.filters.includes(k) ? app.filters.filter((x) => x !== k) : [...app.filters, k];
    app.showUnknown = false;
    applyOpenFilter();
  }
  function setOpenAt(v) {
    app.openAt = v;
    app.showUnknown = false;
    app.momentPicker = false;
    applyOpenFilter();
  }
  function momentFrom(dayOffset, h, m) {
    const at = new Date(); at.setSeconds(0, 0);
    at.setDate(at.getDate() + dayOffset + (h < 6 ? 1 : 0));   // 0 h – 2 h : la nuit qui suit
    at.setHours(h, m);
    return at;
  }
  function quickMoment(kind) {
    const now = new Date();
    if (kind === 'soir') return setOpenAt(now.getHours() >= 20 ? { now: true } : { at: momentFrom(0, 20, 0) });
    if (kind === 'midi') return setOpenAt({ at: momentFrom(now.getHours() >= 13 ? 1 : 0, 12, 30) });
    if (kind === 'demain-soir') return setOpenAt({ at: momentFrom(1, 20, 0) });
  }
  // Un point est-il près du centre de la vue ? (sinon, on cherche autour du centre de la carte)
  function nearView(pt, share = 0.15) {
    const ctr = app.map.getCenter(), bb = app.map.getBounds();
    const span = dist(bb.getSouth(), bb.getWest(), bb.getNorth(), bb.getEast());
    return dist(pt.lat, pt.lon, ctr.lat, ctr.lng) < span * share;
  }
  function reloadCategoryHere() {
    const c = app.category;
    if (!c || c.saved || c.results || app.directions || app.nav) return;
    if (app.place) { app.reloadLater = true; return; }   // une fiche est ouverte : on recharge à sa fermeture
    app.reloadLater = false;
    // attendre que la carte ait chargé la nouvelle zone
    if (!app.map.areTilesLoaded()) { app.map.once('idle', () => { if (app.category?.key === c.key && !app.place) reloadCategoryHere(); }); return; }
    // votre position si elle est près du centre de la vue, sinon le centre de la carte
    const origin = app.me && nearView(app.me) ? app.me : null;
    app.nearbyFromMe = !!origin;
    collectCategory(c, origin, false);
  }
  async function pickCategory(c) {
    app.editChips = false;
    app.importOpen = false;
    if (app.category?.key === c.key) return clearCategory();
    app.filters = [];
    if (c.saved) {
      app.category = c;
      app.closePlace();
      app.savedList = null;
      app.hubPanel = null;
      app.nearby = [];
      app.refreshSaved();
      return;
    }
    app.category = c;
    app.closePlace();
    app.nearby = [];
    app.nearbyDone = false;
    applyHit(c);
    // « Le plus proche de vous » : depuis votre position si elle est connue (ou déjà autorisée), sinon depuis le centre de la carte.
    let origin = app.me;
    if (!origin) {
      const perm = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
      if (perm?.state === 'granted') origin = await app.getPosition().catch(() => null);
    }
    // On regarde un autre quartier (ex. après avoir cherché « 8e arrondissement ») : on cherche là,
    // sans ramener la carte sur votre position.
    if (origin && app.viewChosen && !nearView(origin)) origin = null;
    if (app.category?.key !== c.key) return; // (l'état est une copie : on compare les clés)
    app.nearbyFromMe = !!origin;
    const collect = () => collectCategory(c, origin, true);
    const target = origin ? [origin.lon, origin.lat] : null;
    if (target || app.map.getZoom() < 15) {
      app.map.flyTo({ center: target || app.map.getCenter(), zoom: Math.max(c.transit ? 15 : 15.5, app.map.getZoom()), duration: 700 });
      // Si la carte est déjà au bon endroit, elle ne bouge pas : on n'attend pas indéfiniment.
      let done = false;
      const once = () => { if (!done) { done = true; collect(); } };
      app.map.once('idle', once);
      setTimeout(() => { if (!app.map.isMoving()) once(); }, 1200);
    } else collect();
  }
  function clearCategory() {
    app.clearPhotoPins();
    app.category = null;
    app.filters = [];
    app.reloadLater = false;
    app.openAt = null;
    app.openCounts = null;
    app.momentPicker = false;
    app.nearbyAll = [];
    app.savedList = null;
    app.hubPanel = null;
    app.nearby = [];
    applyHit(null);
  }
  function dist(lat1, lon1, lat2, lon2) {
    const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
    return Math.hypot(x, lat2 - lat1) * 111320;
  }
  async function openCategoryFromSearch() {
    const c = app.catHit;          // à lire avant de vider la recherche (catHit en dépend)
    app.query = '';
    app.focused = false;
    document.activeElement?.blur();
    if (c.when) { app.openAt = c.when; app.showUnknown = false; }
    let center = null;
    if (c.area?.arr) center = ARR_CENTERS[c.area.arr];
    else if (c.area?.text) {
      const r = (await search(`${c.area.text} Paris`).catch(() => []))[0];
      if (r) center = [r.lon, r.lat];
      else app.say(tx('resultats.introuvable_recherche_autour_de_la', { text: c.area.text }));
    }
    const { when, area, ...cat } = c;
    if (app.category?.key === cat.key) app.category = null;   // (sinon pickCategory refermerait la catégorie)
    if (!center) return pickCategory(cat);
    app.viewChosen = true;
    app.map.flyTo({ center, zoom: 15, duration: 800 });
    app.map.once('moveend', () => (app.map.areTilesLoaded() ? pickCategory(cat) : app.map.once('idle', () => pickCategory(cat))));
  }
  function onKey(e) {
    if (e.key === 'Enter' && app.catHit && app.active < 0) { e.preventDefault(); openCategoryFromSearch(); return; }
    // Entrée avant que la liste n'arrive (on tape vite) : on cherche quand même tous les lieux de ce nom
    if (e.key === 'Enter' && !app.editing && app.active < 0 && app.activeQuery.trim().length >= 2) { e.preventDefault(); showAllResults(); return; }
    if (!app.showList || !app.results.length) return;
    if (e.key === 'ArrowDown') { app.active = (app.active + 1) % app.results.length; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { app.active = (app.active - 1 + app.results.length) % app.results.length; e.preventDefault(); }
    else if (e.key === 'Enter') {
      // une ligne choisie aux flèches, ou un champ de trajet : ce résultat-là ; sinon, tous les lieux de ce nom (comme Google Maps)
      if (app.active >= 0 || app.editing) pickResult(app.results[Math.max(app.active, 0)]);
      else showAllResults();
    }
    else if (e.key === 'Escape') { app.focused = false; app.editing = null; }
  }
  /**
   * Entrée dans la barre de recherche : tous les lieux qui correspondent, sur la carte et en liste
   * (retour du porteur, 21/10 : Entrée ouvrait le premier résultat). Un seul lieu, une adresse ou une zone : on l'ouvre.
   */
  async function showAllResults() {
    const q = app.activeQuery.trim();
    // la liste affichée peut être celle du texte précédent (réponse pas encore arrivée) : on l'ignore alors
    const shown = app.resultsFor === q ? app.results : [], top = shown[0];
    if (top && !isPlaceResult(top)) return pickResult(top);
    const c = app.map.getCenter();
    const at = app.me && nearView(app.me) ? app.me : { lat: c.lat, lon: c.lng };
    const all = await searchAllPlaces(q, at, shown).catch(() => shown.filter(isPlaceResult));
    if (app.activeQuery.trim() !== q) return;            // on a continué à taper entre-temps
    if (!top && !all.length) {                            // une adresse tapée vite : on attend sa réponse
      const r = (await search(q, at).catch(() => []))[0];
      if (r && app.activeQuery.trim() === q) pickResult(r);
      return;
    }
    if (!top) {                                           // tapé vite : une zone en tête (« 8e arrondissement ») s'ouvre comme une zone
      const first = await localFirst(q, at).catch(() => null);
      if (first && !isPlaceResult(first) && app.activeQuery.trim() === q) return pickResult(first);
    }
    if (all.length <= 1) { pickResult(top || all[0]); return; }
    app.closePlace();
    app.focused = false;
    document.activeElement?.blur();
    app.category = { key: `recherche:${q}`, label: q, results: true, icon: 'dot', color: '#2A5BD7' };
    app.nearby = [];
    app.nearbyDone = false;
    app.nearbyFromMe = at === app.me;
    app.filters = [];
    app.openAt = null;
    app.showUnknown = false;
    // horaires et étiquettes de chaque lieu, lus dans nos tuiles (pour « ouvert maintenant » et les filtres)
    const tagsOf = (r) => (r.osmType && r.osmId ? placeById(r.osmType, r.osmId, r.lat, r.lon).then((p) => p?.tags || null).catch(() => null) : Promise.resolve(null));
    const tags = await Promise.all(all.map(tagsOf));
    if (app.activeQuery.trim() !== q) return;
    app.nearbyAll = all.map((r, i) => ({ f: { id: `r${i}`, properties: { name: r.name, subclass: r.subclass }, geometry: { coordinates: [r.lon, r.lat] } },
      d: dist(at.lat, at.lon, r.lat, r.lon), res: r, t: tags[i], sub: r.subclass || tags[i]?.amenity || tags[i]?.shop || null, h: tags[i]?.opening_hours || null }));
    applyOpenFilter();
    app.nearbyDone = true;
    applyHit(app.category);
    // cadrer sur les plus proches (et vous) : les autres restent sur la carte, un geste plus loin
    // (après que la liste de la recherche s'est refermée et que la fiche est posée : sinon les marges sont fausses)
    const pts = app.nearby.slice(0, 6).map((n) => n.f.geometry.coordinates);
    await tick();
    requestAnimationFrame(() => app.fitTo(app.nearbyFromMe ? [[at.lon, at.lat], ...pts] : pts));
  }
  // Ligne « Monoprix · Afficher les lieux » (brandhit.js) : tous les lieux de cette enseigne
  function showBrand(name) {
    app.query = name;
    showAllResults();
  }
  // Un lieu de cette liste de résultats : sa fiche, avec la pastille de la liste agrandie
  function openResult(r, i) {
    app.openPlace({ ...r, pin: { glyph: catIcon(app.category), color: app.famColor(app.category) }, hide: i >= 0 ? [{ source: 'cat-hits', id: i }] : [] });
  }
  function pickResult(r) {
    if (app.editing) {
      const pt = { label: r.name, lat: r.lat, lon: r.lon };
      const which = app.editing;
      app.setPoint(which, pt);
      app.editing = null;
      app.fieldQuery = '';
      app.results = [];
      if (which === 'to') app.placeMarker(pt.lon, pt.lat);
      app.computeRoutes();
      return;
    }
    clearCategory();
    if (r.area && !app.assigning) {
      // une zone (arrondissement, quartier, ville) : on y cadre la carte, sans fiche, et les raccourcis restent là
      app.query = r.name;
      app.results = [];
      app.closePlace();
      document.activeElement?.blur();
      app.map.flyTo({ center: [r.lon, r.lat], zoom: 14.3, duration: 900 });
      return;
    }
    if (app.assigning) {
      const which = app.assigning;
      app.assigning = null;
      app.setShortcut(which, r);
      app.say(`${app.SHORT_NAMES[which]} : ${r.name}`);
      app.query = '';
    } else app.query = r.name;
    app.openPlace(r);
  }

  return { showAllResults, showBrand, openResult, toggleFilter, clearSearch, hitFilter, catIcon, applyHit, displayName, collectCategory, applyOpenFilter, setOpenAt, momentFrom, quickMoment, nearView, reloadCategoryHere, pickCategory, clearCategory, dist, openCategoryFromSearch, onKey, pickResult };
}
