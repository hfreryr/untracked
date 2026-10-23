// Dessin sur la carte : itinéraire, lieux, sélection, cadrage, toucher la carte.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { tx } from '#lib/i18n/index.js';
import { addPlaceLayers, addRouteLayers, empty, routeTags as tagsFor } from '#lib/maplayers.js';
import { darken, osmRef, pinFor, pinImageId } from '#lib/mapstyle.js';
import * as maplibregl from 'maplibre-gl';
import { reverseAddress } from '#lib/geocode.js';
import { streetOpts } from '#lib/routeview.js';
import { roundCorners } from '#lib/roundline.js';
import { createBikeTiles } from '#lib/biketiles.js';
import { typeLabel } from '#lib/places.js';
import { setSatellite } from '#lib/satellite.js';

/** @param {any} app */
export function createMapDraw(app) {
  const favData = () => ({ type: 'FeatureCollection', features: app.favorites.map((f, i) => {
    const l = app.listOf(f.lists?.[0]);
    return { type: 'Feature', id: i, geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
      properties: { i, name: f.name, icon: app.listIcon(l), tc: labelColor(l.color) } };
  }) });
  function addCustomLayers() {
    if (app.map.getSource('route')) return;
    addRouteLayers(app.map, app.dark);
    addPlaceLayers(app.map, app.dark, favData());
    dimPlaces(app.dimmed);
    app.isolate();
    // Après un changement de style : on remet l'état en cours (trajet, catégorie, mode transports).
    if (app.directions) drawRoute();
    else if (app.place) showSelection(app.place);
    if (app.category) app.applyHit(app.category);
    if (app.mapMode === 'transit') for (const id of ['transit-case', 'transit-line', 'transit-label']) app.map.setLayoutProperty(id, 'visibility', 'visible');
    if (app.mapMode === 'satellite') setSatellite(app.map, true);
    if (bikeData) app.map.getSource('bikes')?.setData(bikeData);   // nouveau style (clair ↔ sombre) : source vide
    syncBike();
  }
  function drawRoute(fit = true) {
    const src = app.map?.getSource('route');
    if (!src) return;
    syncBike();
    const feats = [];
    const r = app.current?.status === 'ok' ? app.current.data : null;
    if (r && app.mode !== 'transit') {
      const opts = streetOpts(r);
      const sel = opts[app.pickedStreet] || r;
      // variantes en gris dessous (touchables), le trajet choisi en couleur par-dessus
      opts.forEach((o, i) => { if (o !== sel) feats.push({ ...line(o.coords, 'alt', '#A3ADBA', '#7F8A98'), properties: { kind: 'alt', color: '#A3ADBA', edge: '#7F8A98', i } }); });
      feats.push(app.mode === 'bike' ? line(sel.coords, 'bike', app.BIKE_COLOR, '#3F86F6') : line(sel.coords, app.mode, app.WALK_COLOR, '#3F86F6'));
    } else if (r && app.mode === 'transit' && r[app.picked]) {
      r[app.picked].legs.forEach((leg, li) => {
        if (leg.coords.length < 2) return;
        const f = leg.mode === 'WALK' ? line(leg.coords, 'transfer', '#6F7A88') : line(leg.coords, 'transit', leg.color, shade(leg.color));
        // li : quelle étape (toucher le trait l'ouvre dans la fiche) ; dim : estompée quand une autre est choisie
        Object.assign(f.properties, { li, dim: app.focusLeg != null && app.focusLeg !== li });
        feats.push(f);
      });
    }
    const focus = app.mode === 'transit' && app.focusLeg != null ? r?.[app.picked]?.legs[app.focusLeg] : null;
    // l'étape choisie : ses deux arrêts marqués d'un rond à la couleur de la ligne
    const stops = focus && focus.mode !== 'WALK' && focus.coords.length > 1 ? [focus.coords[0], focus.coords.at(-1)].map((c) =>
      ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { kind: 'stop', color: focus.color } })) : [];
    src.setData({ type: 'FeatureCollection', features: feats });
    app.map.getSource('route-ends').setData(app.from && app.directions ? { type: 'FeatureCollection', features: [
      // départ = votre position : la flèche de position suffit, pas de second point (porteur, 21/10)
      ...(app.from.isMe ? [] : [{ type: 'Feature', geometry: { type: 'Point', coordinates: [app.from.lon, app.from.lat] }, properties: { kind: 'from' } }]),
      ...(app.showVia && app.via ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [app.via.lon, app.via.lat] }, properties: { kind: 'via' } }] : []), ...stops] } : empty());
    const all = focus?.coords.length > 1 ? focus.coords : feats.flatMap((f) => f.geometry.coordinates);
    // zoom d'arrivée (après cadrage) : sert à écarter les étiquettes à l'écran
    const z = all.length && fit ? app.map.cameraForBounds(boundsOf(all), fitOptions())?.zoom ?? app.map.getZoom() : app.map.getZoom();
    app.map.getSource('route-tags')?.setData(r && app.mode !== 'transit' && !app.nav ? tagsFor(r, app.pickedStreet, z ?? app.map.getZoom()) : empty());
    if (feats.length && fit) fitTo(all);
  }
  // « Mon itinéraire » (à pied, vélo, voiture) : trait en relief, cœur bleu et bords plus clairs, comme Plans (porteur, 21/10)
  const RIM = { walk: '#7FAEF2', bike: '#7FAEF2', car: '#7FAEF2' };   // bord un peu moins clair (porteur, 23/10)
  // angles arrondis sur quelques mètres pour le dessin seulement (roundline.js) ; le guidage garde le tracé exact
  const line = (coords, kind, color, edge = color) => ({ type: 'Feature', properties: { kind, color, edge, rim: RIM[kind] || null }, geometry: { type: 'LineString', coordinates: roundCorners(coords) } });
  // Teinte plus foncée d'une couleur, pour le liseré d'un trait.
  function shade(hex, k = 0.7) {
    const n = parseInt(hex.slice(1, 7), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join('');
  }
  function dimPlaces(on) {
    app.dimmed = on;
    const v = on ? 0.35 : 1;
    const op = ['case', ['boolean', ['feature-state', 'sel'], false], 0, v];
    // les résultats de la liste (restaurants…) disparaissent pendant l'itinéraire et reviennent après
    for (const id of ['cat-hit', 'cat-hit-label']) if (app.map.getLayer(id)) app.map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
    for (const id of ['poi', 'poi-other', 'landmark', 'metro', 'fav', 'fav-label']) {
      if (!app.map.getLayer(id)) continue;
      const keep = id === 'fav' || id === 'fav-label';   // nos propres repères ne s'estompent pas pendant un trajet
      if (id !== 'fav-label') app.map.setPaintProperty(id, 'icon-opacity', keep ? ['case', ['boolean', ['feature-state', 'sel'], false], 0, 1] : op);
      if (id !== 'fav') app.map.setPaintProperty(id, 'text-opacity', keep ? ['case', ['boolean', ['feature-state', 'sel'], false], 0, 1] : op);
    }
  }
  /** Carte vélo visible : type de carte « Vélo », ou itinéraire à vélo en cours (comme Google Maps). */
  const bikeOn = () => app.mapMode === 'bike' || (app.directions && app.mode === 'bike');
  // Réseau complet (data/bikes/, refait chaque nuit, découpé par tuile : biketiles.js) chargé pour la zone affichée ;
  // sans lui (fichiers absents, hors ligne), on garde les pistes du fond de carte.
  let bikes = null;            // null : pas encore demandé ; true / false : données présentes ou non
  let bikeData = null;
  let bikeTiles = null, loadingBikes = false;
  function loadBikes() {
    if (loadingBikes) return;
    loadingBikes = true;
    bikeTiles ??= createBikeTiles(new URL('data/', location.href).href);
    const b = app.map.getBounds();
    bikeTiles.load({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() })
      .then((fs) => {
        if (fs) { bikeData = { type: 'FeatureCollection', features: fs }; app.map.getSource('bikes')?.setData(bikeData); }
        bikes = !!fs;
      })
      .catch(() => { bikes = bikes ?? false; })
      .finally(() => { loadingBikes = false; syncBike(); });
  }
  function syncBike() {
    const on = bikeOn();
    if (on && !bikeHooked) {
      bikeHooked = true;
      app.map.on('moveend', () => { if (bikeOn()) loadBikes(); });     // on se déplace : les tuiles voisines
    }
    if (on && bikes === null) loadBikes();
    const full = bikes === true;
    const set = (ids, show) => { for (const id of ids) if (app.map?.getLayer(id)) app.map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none'); };
    set(['bike-track', 'bike-shared'], on && !full);
    set(['bikes-track', 'bikes-lane', 'bikes-contra', 'bikes-shared'], on && full);
  }
  let bikeHooked = false;
  function setMapMode(m) {
    app.mapMode = m;
    app.showModes = false;
    syncBike();
    for (const id of ['transit-case', 'transit-line', 'transit-label']) app.map.setLayoutProperty(id, 'visibility', m === 'transit' ? 'visible' : 'none');
    setSatellite(app.map, m === 'satellite');
    if (m === 'transit' && app.map.getZoom() > 14.5) app.map.easeTo({ zoom: 13.5, duration: 600 });
  }
  // Marges de cadrage : ce que cachent réellement le haut d'écran et la fiche (mesurés), pas des valeurs fixes.
  function fitOptions() {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    if (!mobile) return { padding: { top: 60, bottom: 60, left: 460, right: 60 }, maxZoom: 17 };
    const vh = window.innerHeight;
    const top = document.querySelector('.app > header.top')?.getBoundingClientRect().bottom ?? 120;
    const sheet = document.querySelector('.app > section.sheet');
    // la fiche peut être en train de s'ouvrir : on prend sa hauteur d'arrivée (style.height), sinon sa hauteur affichée
    const sh = sheet ? parseFloat(sheet.style.height) || sheet.getBoundingClientRect().height : 0;
    const bottom = Math.min(Math.round(vh * 0.6), Math.round(sh));
    return { padding: { top: Math.round(top) + 24, bottom: bottom + 24, left: 36, right: 36 }, maxZoom: 17 };
  }
  const boundsOf = (coords) => coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  function fitTo(coords) {
    app.map.fitBounds(boundsOf(coords), { ...fitOptions(), duration: 700 });
  }
  function onMapClick(e) {
    if (app.nav) return;
    if (app.directions) {
      const tag = !app.editing && app.map.queryRenderedFeatures(e.point, { layers: ['route-tag', 'route-tag-sel'] })[0];
      if (tag) return app.pickStreet(tag.properties.i);
      const alt = !app.editing && app.map.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers: ['route-line'] })
        .find((f) => f.properties.kind === 'alt');
      if (alt) return app.pickStreet(alt.properties.i);
      // trajet en transport : toucher un bout du tracé ouvre cette étape dans la fiche (comme Citymapper)
      const leg = !app.editing && app.mode === 'transit' && app.map.queryRenderedFeatures([[e.point.x - 10, e.point.y - 10], [e.point.x + 10, e.point.y + 10]], { layers: ['route-line', 'route-walk'] })
        .find((f) => f.properties.li != null);
      if (leg) return app.focusOnLeg(leg.properties.li);
      // une étape est cadrée : toucher ailleurs sur la carte revient au trajet entier
      if (!app.editing && app.mode === 'transit' && app.focusLeg != null) return app.focusOnLeg(app.focusLeg);
      const which = app.editing || (Date.now() - app.lastEdit.at < 800 ? app.lastEdit.which : null);
      if (which) app.pickOnMap(which, e.lngLat);
      return;
    }
    // Un panneau ou un menu ouvert : le premier toucher à côté le referme, sans rien ouvrir d'autre.
    if (app.showModes || app.editChips || app.importOpen) { app.showModes = false; app.editChips = false; app.importOpen = false; return; }
    const fav = app.map.queryRenderedFeatures(e.point, { layers: ['fav', 'fav-label'] })[0];
    if (fav) {
      const f = app.favorites[fav.properties.i], l = app.listOf(f.lists?.[0]);
      return app.openPlace({ ...f, pin: { glyph: l.icon, color: l.color }, hide: [{ source: 'favs', id: fav.properties.i }] });
    }
    const hit = app.map.queryRenderedFeatures(e.point, { layers: ['cat-hit', 'cat-hit-label'] })[0];
    if (hit && app.nearby[hit.properties.i]?.saved) return app.openPlace({ ...app.nearby[hit.properties.i].saved, pin: { glyph: app.listOf(app.nearby[hit.properties.i].saved.lists?.[0]).icon, color: app.listOf(app.nearby[hit.properties.i].saved.lists?.[0]).color } });
    if (hit && app.nearby[hit.properties.i]?.res) return app.openResult(app.nearby[hit.properties.i].res, hit.properties.i);
    if (hit && app.nearby[hit.properties.i]) return openFeature(app.nearby[hit.properties.i].f, 'cat-hit');
    const f = app.map.queryRenderedFeatures(e.point, { layers: ['poi-hit', 'poi', 'poi-other', 'landmark', 'metro'] })[0];
    if (f) return openFeature(f);
    // Toucher un endroit vide : fiche de l'adresse (si une fiche est ouverte, le toucher la ferme d'abord).
    if (app.place) return app.closePlace();
    openPoint(e.lngLat);
  }
  async function openPoint({ lng, lat }) {
    const p = { id: `pt${lng},${lat}`, name: tx('carte.point_selectionne'), type: tx('fiche.adresse'), address: '', lat, lon: lng };
    clearSelection();
    placeMarker(lng, lat);
    app.place = p;
    app.info = {};
    app.deps = null;
    app.wiki = null;          // (sinon la photo du lieu précédent restait affichée)
    app.exits = null;
    app.moreText = false;
    app.showWeek = false;
    const label = await reverseAddress(lat, lng).catch(() => null);
    if (app.place === p || app.place?.id === p.id) { app.place = { ...p, name: label || tx('carte.point_selectionne') }; app.remember(app.place); }
  }
  function openFeature(f, layerId = f.layer?.id) {
    const [osmType, osmId] = (f.properties.osm || '').split('/');
    const ref = f.properties.osm ? { osmType, osmId: Number(osmId) } : osmRef(f.id);
    const [lon, lat] = f.geometry.coordinates;
    const ci = app.category && !app.category.transit ? app.nearby.findIndex((n) => n.f === f || (n.f.id === f.id && f.id != null)) : -1;
    const pin = ci >= 0 ? { glyph: app.catIcon(app.category), color: app.famColor(app.category) }
      : pinFor({ subclass: f.properties.subclass, family: f.properties.family, layer: layerId });
    const hide = [];
    if (f.source && f.id != null) hide.push(f.sourceLayer ? { source: f.source, sourceLayer: f.sourceLayer, id: f.id } : { source: f.source, id: f.id });
    if (ci >= 0) hide.push({ source: 'cat-hits', id: ci });
    app.openPlace({
      pin, hide,
      id: String(f.id), ...ref, name: app.category && !app.category.transit ? app.displayName(f, app.category) : f.properties.name,
      type: typeLabel('', f.properties.subclass) || typeLabel('', f.properties.class)
        || { culture: tx('carte.culture'), sight: tx('carte.lieu_remarquable'), nature: tx('carte.parc_ou_jardin'), health: tx('carte.hopital'), train: tx('ecran.gare'), shop: tx('carte.grand_magasin') }[f.properties.family],
      address: '', lat, lon
    });
  }
  function frame(lon, lat) {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    // Décale le lieu vers la zone visible (sans marge persistante, qui perturbe le rendu).
    const offset = mobile ? [0, -Math.round((window.innerHeight * 0.46 - 120) / 2)] : [210, 0];
    app.map.flyTo({ center: [lon, lat], zoom: Math.max(app.map.getZoom(), 16.5), offset, duration: 800 });
  }
  function placeMarker(lon, lat) {
    if (!app.marker) {
      const el = document.createElement('div');
      el.className = 'pin';
      app.marker = new maplibregl.Marker({ element: el, anchor: 'bottom' });
    }
    app.marker.setLngLat([lon, lat]).addTo(app.map);
  }
  // Couleur du nom à côté d'une pastille : plus foncée sur fond clair, plus claire en mode sombre.
  function labelColor(hex) {
    if (!app.dark) return darken(hex);
    const n = parseInt(hex.slice(1, 7), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * 0.45).toString(16).padStart(2, '0')).join('');
  }
  // (Les pastilles-photo sur la carte et les vignettes des listes ont été retirées le 13/10 : les vues de rue
  //  ne rendent pas l'ambiance d'un lieu. La vue de la rue reste dans la fiche, pour reconnaître l'entrée.)
  const clearSelPhoto = () => {};
  const clearPhotoPins = () => {};
  function clearSelection() {
    clearSelPhoto();
    for (const t of app.selStates) { try { app.map.setFeatureState(t, { sel: false }); } catch { /* tuile déchargée */ } }
    app.selStates = [];
    app.map?.getSource('selected')?.setData(empty());
  }
  function showSelection(p) {
    clearSelection();
    const pin = p.pin || pinFor({ subclass: p.subclass });
    if (!pin || !app.map?.getSource('selected')) { placeMarker(p.lon, p.lat); return; }
    app.marker?.remove();
    const color = pin === 'metro' ? '#2B4793' : pin.color;
    app.map.getSource('selected').setData({ type: 'FeatureCollection', features: [{ type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { icon: pinImageId(pin), name: p.name || '', tc: labelColor(color) } }] });
    app.selStates = p.hide || [];
    for (const t of app.selStates) { try { app.map.setFeatureState(t, { sel: true }); } catch { /* rien */ } }
  }

  return { favData, addCustomLayers, drawRoute, syncBike, bikeOn, line, shade, dimPlaces, setMapMode, fitOptions, boundsOf, fitTo, onMapClick, openPoint, openFeature, frame, placeMarker, labelColor, clearSelPhoto, clearPhotoPins, clearSelection, showSelection };
}
