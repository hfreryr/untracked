// Fiche du bas d'écran qu'on fait glisser du doigt (téléphone uniquement), comme dans les apps
// de cartes de référence : aperçu (titre seul), mi-hauteur (par défaut) et plein écran.
// Glisser vers le bas depuis l'aperçu ferme la fiche ; toucher la poignée agrandit ou réduit.
import { tx } from '#lib/i18n/index.js';
import { shouldClose } from '#lib/swipeclose.js';
import { sheetIntent, startsSideways } from './sheetintent.js';

const PEEK = 150;          // hauteur de l'aperçu, en pixels
const TOP_GAP = 64;        // marge laissée en haut en plein écran, pour voir qu'on est sur une carte

/**
 * Action Svelte : use:draggable={{ key, onDismiss }}
 *  - key : change quand la fiche affiche autre chose (elle revient alors à mi-hauteur) ;
 *  - onDismiss : appelée quand on fait glisser la fiche hors de l'écran (facultatif ; sans elle, la fiche
 *    s'arrête à l'aperçu et reste ouverte, comme la liste d'une catégorie dans les apps de référence) ;
 *  - start : hauteur d'ouverture, 'peek' | 'half' (défaut) ;
 *  - min : la fiche peut aussi se réduire à une fine bande (jusqu'à l'élément marqué data-min-end), pour voir
 *    presque toute la carte (aperçu d'un itinéraire, comme dans Plans et Maps) ;
 *  - tease : à l'aperçu, hauteur (px) du contenu suivant laissée visible et coupée exprès, pour montrer qu'il y a
 *    une suite à faire remonter (le haut des étapes sous « Aller » ; retour du porteur, 15/10) ;
 *  - modal : fiche-fenêtre (choisir une liste, importer, raccourcis…) : pas d'aperçu, un glissement vers le bas
 *    la ferme directement, comme les fiches modales d'iOS et d'Android (demande du porteur, 21/10).
 */
export function draggable(node, params = {}) {
  const mobile = matchMedia('(max-width: 767px)');
  let { key, onDismiss, start, min, tease = 0, modal = false } = params;
  let snap = start || 'half';
  let drag = null;

  // Hauteur naturelle du contenu (sans contrainte), pour ne jamais ouvrir plus grand que nécessaire.
  function natural() {
    const { height, maxHeight, transition } = node.style;
    node.style.transition = 'none';
    node.style.height = 'auto';
    node.style.maxHeight = 'none';
    const h = node.scrollHeight;
    Object.assign(node.style, { height, maxHeight, transition });
    return h;
  }
  function heights() {
    const n = natural();
    const vh = window.innerHeight;
    const full = Math.min(n, vh - TOP_GAP);
    const half = Math.min(n, Math.round(vh * 0.46));
    // L'aperçu s'arrête sous l'élément marqué data-peek-end (résumé d'itinéraire), sinon juste au-dessus
    // des boutons d'action quand il y en a (titre, type, statut).
    const end = node.querySelector('[data-peek-end]');
    const actions = node.querySelector('.actions');
    const peek = end ? Math.min(n, end.offsetTop + end.offsetHeight + 10 + tease) : actions ? actions.offsetTop - 6 : PEEK;
    const minEnd = min && node.querySelector('[data-min-end]');
    const low = minEnd ? minEnd.offsetTop + minEnd.offsetHeight + 4 : null;
    return { min: low, peek: Math.min(peek, half), half, full };
  }
  // Hauteur de la fiche annoncée à la page (événement « sheetmove ») : ce qui est posé sur la carte juste au-dessus
  // (vignette de vue de la rue) suit la fiche.
  const emit = (height) => node.dispatchEvent(new CustomEvent('sheetmove', { detail: { height } }));
  function apply(animate = true) {
    if (!mobile.matches) {
      for (const p of ['height', 'maxHeight', 'overflowY', 'transition']) node.style[p] = '';
      emit(null);
      return;
    }
    const h = heights();
    if (snap === 'full' && h.full <= h.half) snap = 'half';
    node.style.transition = animate ? 'height 280ms cubic-bezier(0.2, 0.9, 0.25, 1)' : 'none';
    node.style.maxHeight = 'none';
    node.style.height = `${h[snap]}px`;
    node.style.overflowY = snap === 'full' ? 'auto' : 'hidden';
    if (snap !== 'full') node.scrollTop = 0;
    node.dataset.snap = snap;
    emit(h[snap]);
    const grip = node.querySelector('.grip');
    if (grip) {
      grip.setAttribute('aria-label', snap === 'full' ? tx('ecran.reduire_la_fiche') : tx('liste.agrandir_la_fiche'));
      grip.toggleAttribute('hidden', h.full <= h.peek);
    }
  }

  function onStart(e) {
    if (!mobile.matches || e.touches.length !== 1) return;
    drag = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, t0: performance.now(), h0: node.getBoundingClientRect().height, active: false, dy: 0,
      sideways: startsSideways(e.target) };
  }
  function onMove(e) {
    if (!drag) return;
    const dy = e.touches[0].clientY - drag.y0;
    if (!drag.active) {
      const intent = sheetIntent(e.touches[0].clientX - drag.x0, dy, drag.sideways);   // (sheetintent.js)
      if (intent === 'wait') return;
      if (intent === 'other') { drag = null; return; }
      // En plein écran, le contenu défile normalement ; on ne reprend la main que pour redescendre
      // depuis le haut du contenu.
      if (snap === 'full' && !(dy > 0 && node.scrollTop <= 0)) { drag = null; return; }
      drag.active = true;
      drag.limits = heights();
      node.style.transition = 'none';
    }
    e.preventDefault();
    drag.dy = dy;
    const h = Math.max(40, Math.min(drag.limits.full + 24, drag.h0 - dy));
    node.style.height = `${h}px`;
    emit(h);
  }
  function onEnd() {
    if (!drag?.active) { drag = null; return; }
    const { limits, h0, dy, t0 } = drag;
    drag = null;
    const h = h0 - dy;
    const v = dy / Math.max(1, performance.now() - t0);          // px/ms, positif vers le bas
    const close = modal ? shouldClose(dy, performance.now() - t0) : h < limits.peek * 0.7 || (snap === 'peek' && v > 0.5);
    if (onDismiss && close) {
      node.style.transition = 'height 200ms ease-in';
      node.style.height = '0px';
      emit(0);
      setTimeout(onDismiss, 180);
      return;
    }
    const order = ['min', 'peek', 'half', 'full'].filter((s) => limits[s] != null && !(modal && s === 'peek'))
      .filter((s, i, a) => i === 0 || limits[s] > limits[a[i - 1]]);
    let i = order.reduce((best, s, k) => (Math.abs(limits[s] - h) < Math.abs(limits[order[best]] - h) ? k : best), 0);
    if (v < -0.45) i = Math.min(order.length - 1, order.indexOf(snap) + 1);   // geste vif vers le haut
    if (v > 0.45) i = Math.max(0, order.indexOf(snap) - 1);                   // geste vif vers le bas
    snap = order[i];
    apply();
  }
  function onGrip(e) {
    if (!e.target.closest('.grip') || !mobile.matches) return;
    snap = snap === 'full' ? 'half' : snap === 'min' ? 'peek' : 'full';
    apply();
  }
  function onWheel(e) {             // petite fenêtre d'ordinateur : la molette agrandit la fiche
    if (mobile.matches && snap !== 'full' && e.deltaY > 0) { snap = 'full'; apply(); }
  }

  // Le contenu change (horaires chargés, liste de trajets…) : on réajuste sans à-coup.
  let raf = 0;
  const watch = new MutationObserver(() => {
    if (drag) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => apply());
  });
  watch.observe(node, { childList: true, subtree: true, characterData: true });
  const onResize = () => apply(false);

  node.addEventListener('touchstart', onStart, { passive: true });
  node.addEventListener('touchmove', onMove, { passive: false });
  node.addEventListener('touchend', onEnd);
  node.addEventListener('touchcancel', onEnd);
  node.addEventListener('click', onGrip);
  node.addEventListener('wheel', onWheel, { passive: true });
  // demande extérieure de hauteur (événement « sheetsnap », detail : 'min' | 'peek' | 'half' | 'full')
  const onSnap = (e) => { if (mobile.matches && ['min', 'peek', 'half', 'full'].includes(e.detail)) { snap = e.detail === 'min' && !min ? 'peek' : e.detail; apply(); } };
  node.addEventListener('sheetsnap', onSnap);
  window.addEventListener('resize', onResize);
  mobile.addEventListener('change', onResize);
  requestAnimationFrame(() => apply(false));

  return {
    update(p = {}) {
      onDismiss = p.onDismiss;
      if (p.key !== key) { key = p.key; snap = p.start || 'half'; apply(); }
    },
    destroy() {
      watch.disconnect();
      node.removeEventListener('sheetsnap', onSnap);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      mobile.removeEventListener('change', onResize);
    }
  };
}
