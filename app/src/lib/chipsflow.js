// Raccourcis de catégories : afficher, ordonner, renommer.
// Code sorti de +page.svelte : il lit et modifie l'état de l'écran par l'objet « app » (bloc « app » de la page).
import { noteEngaged } from '#lib/install.js';
import { ALL_CATEGORIES, CHIPS_KEY } from '#lib/categories.js';

/** @param {any} app */
export function createChips(app) {
  // ——— Onglets personnalisés ———
  function saveChips() {
    noteEngaged();                                   // catégories personnalisées : on compte revenir (install.js)
    try { localStorage.setItem(CHIPS_KEY, JSON.stringify(app.chipPrefs)); } catch { /* rien */ }
  }
  function moveChip(i, d) {
    const j = i + d;
    if (j < 0 || j >= app.chipPrefs.length) return;
    const next = [...app.chipPrefs];
    [next[i], next[j]] = [next[j], next[i]];
    app.chipPrefs = next;
    saveChips();
  }
  function toggleChip(i) {
    const p = { ...app.chipPrefs[i], hidden: !app.chipPrefs[i].hidden };
    const rest = app.chipPrefs.filter((_, k) => k !== i);
    // affiché → rejoint la fin des raccourcis affichés ; masqué → rejoint le haut des disponibles
    const firstHidden = rest.findIndex((x) => x.hidden);
    const at = firstHidden < 0 ? rest.length : firstHidden;
    app.chipPrefs = [...rest.slice(0, at), p, ...rest.slice(at)];
    saveChips();
  }
  function renameChip(i, label) {
    app.chipPrefs = app.chipPrefs.map((p, k) => (k === i ? { ...p, label } : p));
    saveChips();
  }
  function resetChips() {
    app.chipPrefs = ALL_CATEGORIES.map((c) => (c.on ? { key: c.key } : { key: c.key, hidden: true }));
    saveChips();
  }
  const catOf = (key) => ALL_CATEGORIES.find((c) => c.key === key);

  return { saveChips, moveChip, toggleChip, renameChip, resetChips, catOf };
}
