// Fiche lieu : ouverture, partage, prochains passages, lieux récents.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { tx } from '#lib/i18n/index.js';
import { departures } from '#lib/routing.js';
import { details } from '#lib/places.js';
import { sortExits, stationExits } from '#lib/exits.js';
import { wikiInfo } from '#lib/placeinfo.js';
import { preparedPhotos, wikiSummary } from '#lib/wikiprepared.js';

/** @param {any} app */
export function createPlace(app) {
  function remember(p) {
    if (!p?.name || p.name === 'Point sélectionné') return;
    const keep = { id: p.id, name: p.name, type: p.type, address: p.address, lat: p.lat, lon: p.lon, osmType: p.osmType, osmId: p.osmId, subclass: p.subclass, pin: p.pin };
    app.recents = [keep, ...app.recents.filter((r) => r.id !== p.id && r.name !== p.name)].slice(0, 8);
    try { localStorage.setItem(app.RECENTS_KEY, JSON.stringify(app.recents)); } catch { /* navigation privée : tant pis */ }
  }
  function forgetRecents() {
    const before = app.recents;
    app.recents = [];
    try { localStorage.removeItem(app.RECENTS_KEY); } catch { /* rien à effacer */ }
    app.say(tx('fiche.lieux_recents_effaces'), { label: tx('resultats.annuler'), run: () => {
      app.recents = before;
      try { localStorage.setItem(app.RECENTS_KEY, JSON.stringify(app.recents)); } catch { /* rien */ }
    } });
  }
  async function openPlace(p) {
    app.viewChosen = true;
    app.showModes = false;      // une seule chose ouverte à la fois
    app.editChips = false;
    app.importOpen = false;
    if (p.name) remember(p);
    app.place = p;
    app.info = null;
    app.wiki = null;
    app.moreText = false;
    app.deps = null;
    app.showWeek = false;
    app.focused = false;
    document.activeElement?.blur();
    app.showSelection(p);
    app.frame(p.lon, p.lat);
    app.exits = null;
    app.allExits = false;
    if (app.STATION_TYPES.includes(p.type)) {
      loadDepartures(p);
      if (p.type !== 'Entrée de métro') {
        app.exits = { status: 'loading' };
        stationExits(p.lat, p.lon).then((d) => { if (app.place?.id === p.id) app.exits = { status: 'ok', data: sortExits(d) }; })
          .catch(() => { if (app.place?.id === p.id) app.exits = { status: 'error' }; });
      }
    }
    try { app.info = await details(p); } catch { app.info = {}; }
    if (app.place?.id !== p.id) return;
    // Lien partagé : on ne connaissait que l'identifiant du lieu, on récupère son nom.
    if (!p.name && app.info.name) { app.place = { ...app.place, name: app.info.name, type: app.info.kind || app.info.type || app.place.type }; remember(app.place); app.showSelection(app.place); }
    if (app.info.wikiPhotos || app.info.wikiTitle) {
      // préparé à l'avance (wikiprepared.js) : les photos tout de suite, le texte quand il arrive
      const photos = preparedPhotos(app.info.wikiPhotos);
      app.wiki = photos.length ? { photos, photo: photos[0] } : null;
      const title = app.info.wikiTitle || /^fr:(.+)$/.exec(app.info.wikipedia || '')?.[1];
      const s = await wikiSummary(title).catch(() => null);
      if (app.place?.id === p.id && s) app.wiki = { ...(app.wiki || {}), ...s };
    } else if (app.info.wikidata || app.info.wikipedia) {
      app.wiki = { pending: true };   // le bandeau de photos réserve leur place pendant la recherche (PhotoStrip.svelte)
      const w = await wikiInfo(app.info).catch(() => null);
      if (app.place?.id === p.id) app.wiki = w;
    }
  }
  // Partager : lien qui rouvre directement la fiche du lieu (feuille de partage du téléphone, sinon copie).
  async function sharePlace() {
    const u = new URL(location.href);
    u.hash = `carte=17/${app.place.lat.toFixed(5)}/${app.place.lon.toFixed(5)}` + (app.place.osmType ? `&lieu=${app.place.osmType}/${app.place.osmId}` : '&point=1');
    // sans « text » : sur iPhone, « Copier » dans la feuille de partage copiait le texte (le nom) au lieu du lien
    // (porteur, 31/10/2026) ; le titre suffit, les messageries affichent l'aperçu du lien
    const data = { title: app.place.name, url: u.toString() };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); app.say(tx('meslieux.lien_copie')); }
    } catch { /* partage annulé */ }
  }
  // Prochains passages d'une station, rafraîchis toutes les 30 s tant que la fiche est ouverte.
  async function loadDepartures(p) {
    if (!app.deps) app.deps = { status: 'loading' };
    try {
      const data = await departures(p.name, p.lat, p.lon);
      if (app.place?.id !== p.id) return;
      app.deps = data?.lines.length ? { status: 'ok', data } : { status: 'none' };
    } catch {
      if (app.place?.id === p.id && app.deps?.status !== 'ok') app.deps = { status: 'error' };
    }
  }
  function closePlace() {
    app.place = null;
    app.placeMenu = false;
    app.viewer = null;
    app.info = null;
    app.deps = null;
    app.wiki = null;
    app.exits = null;
    app.marker?.remove();
    app.clearSelection();
    if (app.reloadLater) setTimeout(app.reloadCategoryHere, 0);
  }

  return { remember, forgetRecents, openPlace, sharePlace, loadDepartures, closePlace };
}
