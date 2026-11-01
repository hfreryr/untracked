// Mes lieux : listes, épingles, Maison et Travail, transfert et sauvegarde.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { loadReviewer, saveReviewer, mergeReviewer } from '#lib/reviewer.js';
import { fromPins, mergeCustoms } from '#lib/customshortcuts.js';
import { tx } from '#lib/i18n/index.js';
import { LIST_COLORS, backupFile, mergeInto, newListId, pack, packList, readBackup, restore, sameSpot, snapshot } from '#lib/myplaces.js';
import { PARIS } from '#lib/places.js';
import qrcode from 'qrcode-generator';

/** @param {any} app */
export function createMyPlaces(app) {
  // Un même lieu : même identifiant OSM, ou même nom au même endroit (sameSpot, myplaces.js)
  function saveAll() {
    app.saveFavorites();
    try {
      localStorage.setItem(app.LISTS_KEY, JSON.stringify(app.lists));
      localStorage.setItem(app.PINS_KEY, JSON.stringify(app.pins));
    } catch { /* navigation privée */ }
  }
  const keepOf = (p) => ({ id: p.id, name: p.name, type: p.type, address: p.address || app.info?.address || '', lat: p.lat, lon: p.lon,
    osmType: p.osmType, osmId: p.osmId, subclass: p.subclass, pin: p.pin });
  // « Enregistrer » : un geste, dans Favoris ; le message propose de changer de liste. Déjà enregistré : choix des listes.
  function saveTap() {
    const p = app.place;
    if (!p) return;
    if (app.savedEntry) { app.listPicker = true; return; }
    app.favorites = [{ ...keepOf(p), lists: ['fav'] }, ...app.favorites];
    saveAll();
    app.say(tx('meslieux.enregistre_dans', { name: app.listOf('fav').name }), { label: tx('meslieux.changer'), run: () => (app.listPicker = true) });
  }
  function setMembership(listId, on) {
    const p = app.place;
    if (!p) return;
    const ex = app.favorites.find((f) => sameSpot(f, p));
    if (on && !ex) app.favorites = [{ ...keepOf(p), lists: [listId] }, ...app.favorites];
    else if (ex) {
      const ls = on ? [...new Set([...ex.lists, listId])] : ex.lists.filter((x) => x !== listId);
      if (!ls.length) {
        const before = app.favorites, beforePins = app.pins;
        app.favorites = app.favorites.filter((f) => f !== ex);
        app.pins = app.pins.filter((k) => k !== app.placeKey(ex));
        app.say(tx('meslieux.retire_de_mes_lieux'), { label: tx('resultats.annuler'), run: () => { app.favorites = before; app.pins = beforePins; saveAll(); } });
      } else app.favorites = app.favorites.map((f) => (f === ex ? { ...f, lists: ls } : f));
    }
    saveAll();
  }
  function togglePin(p) {
    const k = app.placeKey(p);
    if (app.pins.includes(k)) app.pins = app.pins.filter((x) => x !== k);
    else {
      if (!app.favorites.some((f) => sameSpot(f, p))) app.favorites = [{ ...keepOf(p), lists: ['fav'] }, ...app.favorites];
      app.pins = [...app.pins, k];
    }
    saveAll();
  }
  function removeFromList(saved, listId) {
    const before = app.favorites, beforePins = app.pins;
    const ls = saved.lists.filter((x) => x !== listId);
    if (ls.length) app.favorites = app.favorites.map((f) => (f === saved ? { ...f, lists: ls } : f));
    else { app.favorites = app.favorites.filter((f) => f !== saved); app.pins = app.pins.filter((k) => k !== app.placeKey(saved)); }
    app.swiped = null;
    saveAll();
    refreshSaved();
    app.say(tx('meslieux.retire_de', { name: saved.name, name2: app.listOf(listId).name }), { label: tx('resultats.annuler'), run: () => { app.favorites = before; app.pins = beforePins; saveAll(); refreshSaved(); } });
  }
  function createList(name, then) {
    const n = name.trim();
    if (!n) return null;
    const ex = app.lists.find((l) => l.name.toLowerCase() === n.toLowerCase());
    if (ex) { then?.(ex.id); return ex; }
    const l = { id: newListId(), name: n, icon: 'star',   // (pictogramme sobre ; la couleur distingue les listes)
      color: LIST_COLORS[app.lists.length % LIST_COLORS.length] };
    app.lists = [...app.lists, l];
    saveAll();
    then?.(l.id);
    return l;
  }
  function renameList(l) {
    const n = prompt(tx('meslieux.nouveau_nom_de_la_liste'), l.name)?.trim();
    if (!n) return;
    app.lists = app.lists.map((x) => (x.id === l.id ? { ...x, name: n } : x));
    saveAll();
  }
  /** Pictogramme et couleur d'une liste (test P4 : « je ne peux pas changer l'icône de la liste »). */
  function setListStyle(l, style) {
    app.lists = app.lists.map((x) => (x.id === l.id ? { ...x, ...style } : x));
    saveAll();
    refreshSaved();
  }
  function deleteList(l) {
    const before = { lists: app.lists, favorites: app.favorites };
    app.lists = app.lists.filter((x) => x.id !== l.id);
    app.favorites = app.favorites.map((f) => ({ ...f, lists: f.lists.filter((x) => x !== l.id) })).filter((f) => f.lists.length);
    app.savedList = null;
    saveAll();
    refreshSaved();
    app.say(tx('meslieux.liste_supprimee', { name: l.name }), { label: tx('resultats.annuler'), run: () => { app.lists = before.lists; app.favorites = before.favorites; saveAll(); refreshSaved(); } });
  }
  // Mes lieux sur la carte et dans la liste, triés par distance
  function refreshSaved() {
    if (!app.category?.saved) return;
    const o = app.me || (app.map ? { lat: app.map.getCenter().lat, lon: app.map.getCenter().lng } : PARIS);
    const src = app.category.shared ? app.incoming.places : app.favorites.filter((f) => !app.savedList || f.lists.includes(app.savedList));
    app.nearby = src.map((f, i) => {
      const l = app.category.shared ? app.category : app.listOf(f.lists?.[0]);
      return { f: { id: `s${i}`, properties: { name: f.name, subclass: f.subclass }, geometry: { coordinates: [f.lon, f.lat] } },
        d: app.dist(o.lat, o.lon, f.lat, f.lon), saved: f, icon: `cat|${l.icon}|${l.color}`, tc: app.labelColor(l.color) };
    }).sort((a, b) => a.d - b.d);
    app.nearbyFromMe = !!app.me;
    app.nearbyDone = true;
  }
  function openSavedList(id) {
    app.savedList = id;
    app.listEditing = false;
    app.swiped = null;
    refreshSaved();
    // la carte avec tous les lieux de la liste, la fiche réduite en bas (porteur, 01/11/2026) ; la liste se remonte au doigt
    requestAnimationFrame(showListOnMap);
  }
  function showListOnMap() {
    document.querySelector('.app > section.sheet')?.dispatchEvent(new CustomEvent('sheetsnap', { detail: 'peek' }));
    const pts = app.nearby.map((n) => n.f.geometry.coordinates);
    if (pts.length) app.fitTo(pts);
  }
  async function shareList(l) {
    const places = app.favorites.filter((f) => f.lists.includes(l.id));
    const u = new URL(location.href);
    u.hash = `liste=${await packList(l, places)}`;
    const data = { title: tx('meslieux.lieu', { nom: l.name, n: places.length }), url: u.toString() };   // sans « text » : voir sharePlace
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); app.say(tx('meslieux.lien_de_la_liste_copie')); }
    } catch { /* partage annulé */ }
  }
  // Ajouter une liste reçue par lien
  function keepIncomingList() {
    const { list, places } = app.incoming;
    let name = list.name;
    if (app.lists.some((l) => l.name.toLowerCase() === name.toLowerCase())) name = tx('meslieux.partagee', { name });
    const l = { id: newListId(), name, icon: list.icon || 'star', color: list.color || LIST_COLORS[2] };
    const m = mergeInto({ lists: app.lists, places: app.favorites }, { lists: [l], places: places.map((p) => ({ ...p, lists: [l.id] })) }, sameSpot);
    app.lists = m.lists;
    app.favorites = m.places;
    saveAll();
    app.incoming = null;
    app.clearCategory();
    app.say(tx('meslieux.liste_ajoutee_a_mes_lieux', { name }));
  }
  async function makeTransfer() {
    app.hubPanel = 'transfer';
    app.transfer = null;
    // lien de transfert : la clé et le pseudo, et ses avis sans leur texte (le lien doit rester court)
    const rv = loadReviewer();
    const data = await pack(snapshot({ lists: app.lists, places: app.favorites, shortcuts: app.shortcuts, pins: app.pins, chips: app.chipPrefs, customs: app.customs,
      reviewer: { ...rv, mine: rv.mine.map((m) => ({ ...m, text: '' })) } }));
    const u = new URL(location.href);
    u.hash = `transfert=${data}`;
    const url = u.toString();
    let qr = null;
    if (url.length <= 1500) {             // au-delà, un QR code devient trop dense pour être lu sur un écran
      const q = qrcode(0, 'L');
      q.addData(url);
      q.make();
      qr = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
    }
    app.transfer = { url, qr };
  }
  async function shareTransfer() {
    try {
      if (navigator.share) await navigator.share({ title: tx('meslieux.mes_lieux_untracked_maps'), url: app.transfer.url });
      else { await navigator.clipboard.writeText(app.transfer.url); app.say(tx('meslieux.lien_copie')); }
    } catch { /* annulé */ }
  }
  function applyIncoming(data) {
    const r = restore(data);
    const m = mergeInto({ lists: app.lists, places: app.favorites }, r, sameSpot);
    app.lists = m.lists;
    app.favorites = m.places;
    app.pins = [...new Set([...app.pins, ...r.pins])];
    // raccourcis personnels reçus ; une ancienne sauvegarde n'a que des « épinglés » : ils deviennent des raccourcis
    const got = r.customs.length ? r.customs : fromPins(r.pins, app.favorites, app.placeKey);
    app.customs = mergeCustoms(app.customs, got, sameSpot);
    app.saveCustoms();
    for (const k of ['home', 'work']) if (r.shortcuts[k] && !app.shortcuts[k]) app.setShortcut(k, r.shortcuts[k]);
    if (r.chips?.length) { app.chipPrefs = r.chips; app.saveChips(); }
    if (r.reviewer) saveReviewer(mergeReviewer(loadReviewer(), r.reviewer));
    saveAll();
    return m.added;
  }
  async function makeBackup() {
    const file = await backupFile(snapshot({ lists: app.lists, places: app.favorites, shortcuts: app.shortcuts, pins: app.pins, chips: app.chipPrefs, customs: app.customs, reviewer: loadReviewer() }), app.backupPassword.trim());
    app.backupPassword = '';
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: tx('meslieux.sauvegarde_de_mes_lieux') });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      app.lastBackup = Date.now();
      try { localStorage.setItem(app.BACKUP_KEY, String(app.lastBackup)); } catch { /* rien */ }
      app.hubPanel = null;
      app.say(tx('meslieux.sauvegarde_creee_rangez_la_dans'));
    } catch { /* partage annulé */ }
  }
  async function doRestore(file = app.restoreFile) {
    if (!file) return;
    app.restoreFile = file;
    try {
      const r = await readBackup(file, app.restorePassword);
      if (r.needsPassword) { app.restoreNeedsPw = true; return; }
      const added = applyIncoming(r.data);
      app.restoreFile = null; app.restoreNeedsPw = false; app.restorePassword = ''; app.hubPanel = null;
      refreshSaved();
      app.say(added ? tx('meslieux.lieu_restaure', { n: added }) : tx('meslieux.tout_etait_deja_la'));
    } catch (e) {
      app.say(app.restoreNeedsPw ? tx('meslieux.mot_de_passe_incorrect') : tx('meslieux.ce_fichier_est_pas_une_sauvegarde'));
    }
  }

  return { sameSpot, saveAll, keepOf, saveTap, setMembership, togglePin, removeFromList, createList, renameList, setListStyle, deleteList, refreshSaved, openSavedList, showListOnMap, shareList, keepIncomingList, makeTransfer, shareTransfer, applyIncoming, makeBackup, doRestore };
}
