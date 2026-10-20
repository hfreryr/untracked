// Import des lieux enregistrés dans Google Maps (fichier Takeout lu sur l'appareil).
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { tx } from '#lib/i18n/index.js';
import { PARIS } from '#lib/places.js';
import { mergeInto } from '#lib/myplaces.js';
import { readGoogleExport } from '#lib/importgoogle.js';
import { search } from '#lib/geocode.js';
import { resolvePlace, eachLimited, snapToOsm } from '#lib/importresolve.js';

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
      let added = 0, missed = 0, unsure = 0, done = 0;
      // chaque liste Google retrouve son équivalent : Favoris, À tester (« À visiter »), ou une liste à son nom
      const listFor = (name) => {
        if (!name || /favori|favorite/i.test(name)) return 'fav';
        if (/want to go|visiter|envie/i.test(name)) return 'todo';
        const l = app.createList(name);
        if (l && /suivi|starred/i.test(name) && l.icon !== 'star') { app.lists = app.lists.map((x) => (x.id === l.id ? { ...x, icon: 'star', color: '#C7972B' } : x)); }
        return l?.id || 'fav';
      };
      const lost = places.filter((p) => !p.lat || !p.lon);
      const found = new Map();
      // Les listes Google n'ont pas de position : on retrouve chaque lieu par son nom (nos données d'abord), quatre à la fois.
      await eachLimited(lost, 4, async (p) => {
        const r = await resolvePlace(p, PARIS);
        done++;
        app.importing = tx('import.recherche_des_lieux_sans_position', { i: done, n: lost.length });
        if (r) { found.set(p, r); if (!r.sure) unsure++; } else missed++;
      });
      // Lieux qui ont déjà une position : on leur retrouve leur identifiant OSM dans nos données (quatre à la fois)
      const snapped = new Map();
      await eachLimited(places.filter((p) => p.lat && p.lon && p.name), 4, async (p) => { const o = await snapToOsm(p); if (o) snapped.set(p, o); });
      const kept = [];
      for (const p of places) {
        const r = p.lat && p.lon ? { place: { ...p, ...pickIds(snapped.get(p)) }, sure: true } : found.get(p);
        if (!r) continue;
        const { lat, lon, address } = r.place;
        // un lieu retrouvé seulement par son nom, parmi plusieurs homonymes, est marqué pour être vérifié
        const type = r.sure ? tx('import.importe_de_google_maps') : tx('import.importe_a_verifier');
        // l'identifiant OSM, quand on l'a, relie le lieu importé à sa fiche (et à ses listes)
        kept.push({ id: `g${lat},${lon}`, name: p.name || p.address, type, address: p.address || address || '', lat, lon,
          ...pickIds(r.place), lists: [listFor(p.listName)] });
      }
      const m = mergeInto({ lists: app.lists, places: app.favorites }, { lists: [], places: kept }, app.sameSpot);
      app.favorites = m.places;
      added = m.added;
      app.saveAll();
      app.refreshSaved();
      let extra = '';
      for (const [k, v] of [['home', home], ['work', work]]) {
        if (!v || app.shortcuts[k]) continue;
        let { lat, lon } = v;
        if (!lat || !lon) { const r = (await search(v.address || v.name, PARIS).catch(() => []))[0]; if (!r) continue; ({ lat, lon } = r); }
        app.setShortcut(k, { id: `${k}${lat}`, name: v.address || v.name, type: app.SHORT_NAMES[k], address: v.address || '', lat, lon });
        extra += tx('import.defini', { nom: app.SHORT_NAMES[k] });
      }
      app.importing = '';
      app.importOpen = false;
      if (!added && !extra) app.say((places.length ? tx('import.ces_lieux_sont_deja_dans_vos_favoris') : tx('import.aucun_lieu_trouve_dans_ce_fichier')) + (listsMissing ? tx('import.listes_absentes') : ''));
      else app.say(tx('import.lieu_importe', { n: added, extra, manquants: (missed ? tx('import.introuvable', { n: missed }) : '') + (unsure ? tx('import.a_verifier', { n: unsure }) : '') + (listsMissing ? tx('import.listes_absentes') : '') }));
    } catch {
      app.importing = '';
      app.say(tx('import.ce_fichier_a_pas_pu_etre_lu'));
    }
  }

  return { importFile };
}
