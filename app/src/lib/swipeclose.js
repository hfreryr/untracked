// Fermer une fenêtre en la faisant glisser vers le bas (téléphone), comme les fiches modales d'iOS et d'Android
// (demande du porteur, 21/10 ; règle d'interface n° 7). On ne tire que si le contenu est en haut de son défilement,
// pour ne pas confondre avec un défilement de la liste.

const EASE = ['transform', '0.2s', 'ease'].join(' ');   // (écrit ainsi : ce n'est pas un texte affiché)

/** Fermer à la fin du geste ? Assez loin (90 px), ou un coup rapide vers le bas. Pure, donc testable. */
export function shouldClose(dy, ms) {
  if (dy <= 0) return false;
  return dy > 90 || (dy > 30 && dy / Math.max(ms, 1) > 0.5);
}

/** Action Svelte : use:swipeClose={{ onclose, back: () => fondAssombri }} */
export function swipeClose(node, opts) {
  let o = opts, start = null;
  const mobile = () => matchMedia('(max-width: 767px)').matches;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const move = (dy) => {
    node.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
    const b = o.back?.();
    if (b) b.style.opacity = dy > 0 ? String(Math.max(0.3, 1 - dy / 400)) : '';
  };
  // gestes tactiles (et non « pointer ») : sur téléphone, le navigateur annule un geste « pointer » dès qu'il défile
  const y = (e) => e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY;
  const x = (e) => e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX;
  const down = (e) => {
    if (!mobile() || node.scrollTop > 0 || e.target.closest('input, select, textarea')) return;
    start = { y: y(e), x: x(e), t: performance.now(), dy: 0, on: false };
    node.style.transition = 'none';
  };
  const drag = (e) => {
    if (!start) return;
    start.dy = y(e) - start.y;
    // un geste plutôt horizontal (photo qu'on fait défiler) n'est pas un « glisser pour fermer »
    if (!start.on && start.dy > 6 && Math.abs(start.dy) > Math.abs(x(e) - start.x) && node.scrollTop <= 0) start.on = true;
    if (start.on) { e.preventDefault(); move(Math.max(0, start.dy)); }
  };
  const up = () => {
    if (!start) return;
    const { dy, t, on } = start;
    start = null;
    if (!on) return;
    node.style.transition = reduce() ? 'none' : EASE;
    if (shouldClose(dy, performance.now() - t)) { move(window.innerHeight); setTimeout(() => o.onclose(), reduce() ? 0 : 180); }
    else move(0);
  };
  node.addEventListener('touchstart', down, { passive: true });
  node.addEventListener('touchmove', drag, { passive: false });
  node.addEventListener('touchend', up);
  node.addEventListener('touchcancel', up);
  return {
    update(n) { o = n; },
    destroy() {
      node.removeEventListener('touchstart', down);
      node.removeEventListener('touchmove', drag);
      node.removeEventListener('touchend', up);
      node.removeEventListener('touchcancel', up);
    }
  };
}
