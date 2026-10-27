// Appui long (ou clic droit / touche menu du clavier) sur un élément : ouvre une action secondaire, comme dans Plans
// (raccourcis de la rangée : modifier, changer l'adresse, supprimer). Le toucher qui suit l'appui long est ignoré.
// Usage : <button use:longpress={() => ouvrirMenu()} onclick={(e) => { if (!pressed(e)) agir(); }}>

export const LONG_MS = 480;
const fired = new WeakSet();

/** Le clic vient-il juste après un appui long (à ignorer) ? */
export function pressed(e) {
  const t = e.currentTarget;
  if (!fired.has(t)) return false;
  fired.delete(t);
  return true;
}

/** @param {HTMLElement} node @param {() => void} run */
export function longpress(node, run) {
  let timer = 0, x = 0, y = 0;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  const down = (e) => {
    if (e.button > 0) return;
    x = e.clientX; y = e.clientY;
    cancel();
    timer = setTimeout(() => { timer = 0; fired.add(node); navigator.vibrate?.(10); run(); }, LONG_MS);
  };
  const move = (e) => { if (timer && Math.hypot(e.clientX - x, e.clientY - y) > 10) cancel(); };
  const ctx = (e) => { e.preventDefault(); cancel(); fired.delete(node); run(); };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('contextmenu', ctx);
  return {
    update(fn) { run = fn; },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', down); node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', cancel); node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('pointerleave', cancel); node.removeEventListener('contextmenu', ctx);
    }
  };
}
