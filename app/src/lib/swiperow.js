// Glisser une ligne vers la gauche pour la supprimer, comme Plans et les listes d'iOS (porteur, 02/11/2026) :
// un petit glissement découvre la corbeille (on la touche pour supprimer) ; tirer la ligne jusqu'au bout supprime
// directement (avec confirmation pour une liste entière, décidée par onDelete). Lieux d'une liste et listes de Mes lieux.
// La ligne contient un élément .swipe-content (ce qui glisse) et, derrière, la corbeille (.swipe-act).

export const REVEAL = 84;                 // largeur de la corbeille découverte (px)
const SLIDE = ['transform', '0.22s', 'ease'].join(' ');   // (écrit ainsi : ce n'est pas un texte affiché)

/** Fin du geste : 'delete' (tirée au-delà de 55 % de la largeur), 'open' (corbeille découverte) ou 'close'. Pure. */
export function swipeEnd(dx, width) {
  if (dx <= -width * 0.55) return 'delete';
  if (dx <= -REVEAL / 2) return 'open';
  return 'close';
}

/** Action Svelte : use:swipeRow={{ enabled, open, onOpen(bool), onDelete() }} */
export function swipeRow(node, opts) {
  let o = opts, x0 = null, y0 = 0, base = 0, dir = null, dx = 0;
  const content = () => node.querySelector('.swipe-content');
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const place = (x, anim) => {
    const c = content();
    if (!c) return;
    c.style.transition = anim && !reduce() ? SLIDE : 'none';
    c.style.transform = x ? `translateX(${x}px)` : '';
    node.style.setProperty('--dx', `${-x}px`);
    node.classList.toggle('far', x <= -node.offsetWidth * 0.55);
  };
  const start = (e) => {
    if (!o.enabled || e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dir = null; base = o.open ? -REVEAL : 0; dx = base;
  };
  const move = (e) => {
    if (x0 === null) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!dir && Math.hypot(mx, my) > 8) dir = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
    if (dir !== 'x') return;
    e.preventDefault();                      // (le geste est horizontal : la fiche ne défile pas en même temps)
    dx = Math.min(0, base + mx);
    place(dx, false);
  };
  const end = () => {
    if (x0 === null) return;
    x0 = null;
    if (dir !== 'x') return;
    const r = swipeEnd(dx, node.offsetWidth);
    if (r === 'delete') { place(-node.offsetWidth, true); setTimeout(() => { o.onDelete(); place(0, false); }, reduce() ? 0 : 200); }
    else { place(r === 'open' ? -REVEAL : 0, true); o.onOpen(r === 'open'); }
  };
  node.addEventListener('touchstart', start, { passive: true });
  node.addEventListener('touchmove', move, { passive: false });
  node.addEventListener('touchend', end);
  node.addEventListener('touchcancel', end);
  if (o.open) place(-REVEAL, false);
  return {
    update(n) { const was = o.open; o = n; if (was !== o.open && x0 === null) place(o.open ? -REVEAL : 0, true); },
    destroy() {
      node.removeEventListener('touchstart', start); node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end); node.removeEventListener('touchcancel', end);
    }
  };
}
