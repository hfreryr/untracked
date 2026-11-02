// Import des lieux enregistrés dans Google Maps (fichier Takeout lu sur l'appareil).
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { noteEngaged } from '#lib/install.js';
import { tx } from '#lib/i18n/index.js';
import { PARIS } from '#lib/places.js';
import { mergeInto } from '#lib/myplaces.js';
import { readGoogleExport } from '#lib/importgoogle.js';
import { search, searchForImport } from '#lib/geocode.js';
import { resolvePlace, eachLimited, eachPaced, snapToOsm, linkByName } from '#lib/importresolve.js';
import { hasPlaces } from '#lib/searchscope.js';
import { listCenters, tooFar } from '#lib/importcenter.js';

const pickIds = (o) => (o?.osmType && o?.osmId ? { osmType: o.osmType, osmId: o.osmId, subclass: o.subclass || undefined } : {});

/** @param {any} app */
export function createImport(app) {
  // ——— Import des lieux enregistrés dans Google Maps ———
  async function importFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    app.importing = tx('import.lecture_du_fichier');
    try {
      const { places, home, work, listsMissing } = await readGoogleExport(file);
      let added = 0, missed = 0, unsure = 0;
      // chaque liste Google retrouve son équivalent : Favoris, ou une liste à son nom (« À visiter » comprise, 02/11/2026)
      const listFor = (name) => {
        if (!name || /favori|favorite/i.test(name)) return 'fav';
        const l = app.createList(name);
        if (l && /suivi|starred/i.test(name) && l.icon !== 'star') { app.lists = app.lists.map((x) => (x.id === l.id ? { ...x, icon: 'star', color: '#C7972B' } : x)); }
        return l?.id || 'fav';
      };
      // toutes les listes d'abord, même celles dont aucun lieu ne sera retrouvé (porteur, 31/10/2026 : une seule liste
      // apparaissait sur 9)
      const ids = new Map();
      for (const p of places) if (!ids.has(p.listName)) ids.set(p.listName, listFor(p.listName));
      // la position de presque tous les lieux est dans leur lien (s2cell.js) ; les autres sont cherchés par leur nom,
      // autour des lieux de leur liste (importcenter.js), un par seconde au plus quand il faut Photon
      const lost = places.filter((p) => !p.lat || !p.lon);
      const where = (lastWhere = listCenters(places));
      const { found, missed: nMissed, unsure: nUnsure, failed } = await resolveAll(lost, where);
      missed = nMissed; unsure = nUnsure;
      // Lieux qui ont déjà une position : on leur retrouve leur identifiant OSM dans nos données (quatre à la fois)
      const snapped = new Map();
      await eachLimited(places.filter((p) => p.lat && p.lon && p.name), 4, async (p) => { const o = await snapToOsm(p); if (o) snapped.set(p, o); });
      const kept = keep(places, found, snapped, ids);
      const m = mergeInto({ lists: app.lists, places: app.favorites }, { lists: [], places: kept }, app.sameSpot);
      app.favorites = m.places;
      added = m.added;
      app.saveAll();
      app.refreshSaved();
      let extra = '';
      for (const [k, v] of [['home', home], ['work', work]]) {
        if (!v || app.shortcuts[k]) continue;
        let { lat, lon } = v;
        if (!lat || !lon) { const r = (await search(v.address || v.name, where.all || startPoint()).catch(() => []))[0]; if (!r) continue; ({ lat, lon } = r); }
        app.setShortcut(k, { id: `${k}${lat}`, name: v.address || v.name, type: app.SHORT_NAMES[k], address: v.address || '', lat, lon });
        extra += tx('import.defini', { nom: app.SHORT_NAMES[k] });
      }
      app.importing = '';
      app.importOpen = false;
      linkAbroad(kept);
      const later = failed.length ? tx('import.non_cherches', { n: failed.length }) : '';
      const retry = failed.length ? { label: tx('import.reessayer'), run: () => retryFailed(failed, ids) } : undefined;
      if (!added && !extra && !failed.length) app.say((places.length ? tx('import.ces_lieux_sont_deja_dans_vos_favoris') : tx('import.aucun_lieu_trouve_dans_ce_fichier')) + (listsMissing ? tx('import.listes_absentes') : ''));
      else { if (added) noteEngaged(); app.say(tx('import.lieu_importe', { n: added, extra, manquants: (missed ? tx('import.introuvable', { n: missed }) : '') + (unsure ? tx('import.a_verifier', { n: unsure }) : '') + later + (listsMissing ? tx('import.listes_absentes') : '') }), retry); }
    } catch {
      app.importing = '';
      app.say(tx('import.ce_fichier_a_pas_pu_etre_lu'));
    }
  }

  /** Après l'import, sans faire attendre : les lieux hors de nos données (étranger) reçoivent leur identifiant OSM par le
   *  moteur de recherche, un par seconde, pour ouvrir leur vraie fiche. Leur position, elle, est déjà juste. */
  async function linkAbroad(kept) {
    const todo = kept.filter((k) => !k.osmId && k.name && !hasPlaces(k));
    await eachPaced(todo, 1000, async (k) => {
      const o = await linkByName(k, searchForImport);
      if (!o) return;
      app.favorites = app.favorites.map((f) => (f.id === k.id && !f.osmId ? { ...f, ...pickIds(o) } : f));
      app.saveAll();
    }).catch(() => {});
  }

  /** Retrouve les lieux sans position, un par seconde ; ceux pour lesquels le moteur n'a pas répondu sont gardés à part. */
  let lastWhere = null;     // centres des listes du dernier import (pour « Réessayer »)
  // point de départ quand l'export n'a aucune position : là où est l'utilisateur, sinon le centre de la carte
  const startPoint = () => app.me || (app.map ? { lat: app.map.getCenter().lat, lon: app.map.getCenter().lng } : PARIS);

  async function resolveAll(lost, where = listCenters([])) {
    const found = new Map(), failed = [];
    let missed = 0, unsure = 0, done = 0;
    await eachPaced(lost, 1000, async (p) => {
      try {
        let usedRemote = false;
        const center = where.centers.get(p.listName) || null;
        const at = center || where.all || startPoint();
        let r = await resolvePlace(p, at, { remote: (q, a) => { usedRemote = true; return searchForImport(q, a); } });
        // homonyme lointain (« Baden-Baden » à Paris) : pas de point plutôt qu'un faux point
        if (r && tooFar(r.place, center)) r = null;
        if (r) { found.set(p, r); if (!r.sure) unsure++; } else missed++;
        done++;
        app.importing = tx('import.recherche_des_lieux_sans_position', { i: done, n: lost.length, min: Math.ceil((lost.length - done) / 60) });
        return usedRemote;          // trouvé dans nos données : pas d'attente (seul Photon impose ≈ 1 demande par seconde)
      } catch {
        failed.push(p); done++;
      }
    });
    return { found, missed, unsure, failed };
  }

  /** Lieux à ajouter : ceux qui ont une position, et ceux retrouvés par leur nom. */
  function keep(places, found, snapped, ids) {
    const kept = [];
    for (const p of places) {
      const r = p.lat && p.lon ? { place: { ...p, ...pickIds(snapped.get(p)) }, sure: true } : found.get(p);
      if (!r) continue;
      const { lat, lon, address } = r.place;
      // un lieu retrouvé seulement par son nom, parmi plusieurs homonymes, est marqué pour être vérifié
      const type = r.sure ? tx('import.importe_de_google_maps') : tx('import.importe_a_verifier');
      // l'identifiant OSM, quand on l'a, relie le lieu importé à sa fiche (et à ses listes)
      kept.push({ id: `g${lat},${lon}`, name: p.name || p.address, type, address: p.address || address || '', lat, lon,
        ...pickIds(r.place), lists: [ids.get(p.listName)] });
    }
    return kept;
  }

  /** « Réessayer » : les lieux que le moteur de recherche n'avait pas traités. */
  async function retryFailed(places, ids) {
    app.importing = tx('import.lecture_du_fichier');
    const { found, missed, unsure, failed } = await resolveAll(places, lastWhere || undefined);
    const m = mergeInto({ lists: app.lists, places: app.favorites }, { lists: [], places: keep(places, found, new Map(), ids) }, app.sameSpot);
    app.favorites = m.places;
    app.saveAll();
    app.refreshSaved();
    app.importing = '';
    const later = failed.length ? tx('import.non_cherches', { n: failed.length }) : '';
    app.say(tx('import.lieu_importe', { n: m.added, extra: '', manquants: (missed ? tx('import.introuvable', { n: missed }) : '') + (unsure ? tx('import.a_verifier', { n: unsure }) : '') + later }),
      failed.length ? { label: tx('import.reessayer'), run: () => retryFailed(failed, ids) } : undefined);
  }

  return { importFile };
}
