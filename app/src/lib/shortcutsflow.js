// Maison, Travail, raccourcis personnels (customshortcuts.js) et enregistrement des favoris.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { tx } from '#lib/i18n/index.js';
import { addCustom, updateCustom, removeCustom } from '#lib/customshortcuts.js';
import { suggestIcon } from '#lib/shortcuticons.js';

/** @param {any} app */
export function createShortcuts(app) {
  function saveFavorites() {
    try { localStorage.setItem(app.FAVS_KEY, JSON.stringify(app.favorites)); } catch { /* navigation privée */ }
  }
  function setShortcut(which, p) {
    app.shortcuts = { ...app.shortcuts, [which]: p ? { id: p.id, name: p.name, type: p.type, address: p.address || '', lat: p.lat, lon: p.lon, osmType: p.osmType, osmId: p.osmId, subclass: p.subclass, pin: p.pin } : undefined };
    try { localStorage.setItem(app.SHORTCUTS_KEY, JSON.stringify(app.shortcuts)); } catch { /* rien */ }
  }
  // Toucher « Maison » : itinéraire direct. S'il n'est pas encore défini, on le demande.
  function useShortcut(which) {
    const p = app.shortcuts[which];
    if (!p) {
      app.assigning = which;
      app.query = '';
      app.say(which === 'home' ? tx('resultats.tapez_adresse_de_votre_maison') : tx('resultats.tapez_adresse_de_votre_travail'));
      setTimeout(() => document.getElementById('search')?.focus(), 50);
      return;
    }
    if (app.editing) { app.pickResult({ ...p }); return; }
    app.focused = false;
    document.activeElement?.blur();
    app.clearCategory();
    app.openPlace({ ...p, name: p.name || app.SHORT_NAMES[which] });
    app.startDirections();
  }

  // ——— Raccourcis personnels (maquette du 27/10/2026) ———
  // app.assigning vaut 'home', 'work' ou l'identifiant d'un raccourci personnel (« c… ») : la prochaine adresse
  // choisie dans la recherche devient son adresse (searchflow.pickResult → assignTo).
  const custom = (id) => app.customs.find((c) => c.id === id);
  function saveCustoms() {
    try { localStorage.setItem(app.CUSTOM_KEY, JSON.stringify(app.customs)); } catch { /* navigation privée */ }
  }
  /** Nom affiché d'un raccourci (Maison, Travail ou personnel). */
  const shortcutName = (which) => app.SHORT_NAMES[which] || custom(which)?.name || '';
  function askAddress(which) {
    app.assigning = which;
    app.query = '';
    app.say(tx('raccourcis.tapez_adresse', { nom: shortcutName(which) }));
    setTimeout(() => document.getElementById('search')?.focus(), 50);
  }
  /** La recherche a donné l'adresse attendue. */
  function assignTo(which, r) {
    if (which === 'home' || which === 'work') setShortcut(which, r);
    else { app.customs = updateCustom(app.customs, which, { place: r }); saveCustoms(); }
    app.say(`${shortcutName(which)} : ${r.name}`);
  }
  /** Fenêtre « Nouveau raccourci » / « Ajouter aux raccourcis » (depuis une fiche) / modifier. */
  function openShortcutDlg({ id = null, place = null } = {}) {
    const c = id ? custom(id) : null;
    app.shortcutDlg = c ? { id, name: c.name, icon: c.icon, place: c.place }
      : { id: null, name: place?.name || '', icon: place ? suggestIcon(place) : 'sport', place: place || null };
  }
  function saveShortcutDlg(name, icon) {
    const d = app.shortcutDlg;
    if (!d) return;
    app.shortcutDlg = null;
    if (d.id) { app.customs = updateCustom(app.customs, d.id, { name, icon }); saveCustoms(); return; }
    const r = addCustom(app.customs, { name, icon, place: d.place });
    if (!r.id) return;
    app.customs = r.list;
    saveCustoms();
    if (d.place) app.say(tx('raccourcis.ajoute', { nom: name.trim() }));
    else askAddress(r.id);                       // d'abord le nom et l'icône, ensuite l'adresse (choix du porteur)
  }
  function deleteCustom(id) {
    const before = app.customs, c = custom(id);
    app.customs = removeCustom(app.customs, id);
    saveCustoms();
    app.say(tx('fiche.retire', { nom: c?.name || '' }), { label: tx('resultats.annuler'), run: () => { app.customs = before; saveCustoms(); } });
  }
  /** Toucher un raccourci personnel : itinéraire, ou demande de l'adresse s'il n'en a pas encore. */
  function useCustom(id) {
    const c = custom(id);
    if (!c) return;
    if (!c.place) { askAddress(id); return; }
    if (app.editing) { app.pickResult({ ...c.place }); return; }
    app.focused = false;
    document.activeElement?.blur();
    app.clearCategory();
    app.openPlace({ ...c.place });
    app.startDirections();
  }

  return { saveFavorites, setShortcut, useShortcut, saveCustoms, shortcutName, askAddress, assignTo, openShortcutDlg, saveShortcutDlg, deleteCustom, useCustom };
}
