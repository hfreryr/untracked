<!-- Fenêtre modale (règles d'interface : docs/regles-interface.md) : une seule à la fois, fond assombri,
     se ferme par la croix, par Échap, en touchant le fond, ou en la glissant vers le bas (téléphone, 21/10) ;
     le focus va dans la fenêtre puis revient au bouton. Sur téléphone, c'est une fiche qui monte du bas. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { closeAll } from '#lib/popover.js';
  import { swipeClose } from '#lib/swipeclose.js';
  let { title, sub = '', icon, sheet = true, onclose, children } = $props();
  let box = $state();
  let node = $state();
  let back = null;
  $effect(() => {
    closeAll();                                   // un menu ouvert se ferme : une seule chose ouverte à la fois
    back = document.activeElement;
    document.body.appendChild(node);              // au-dessus de tout, hors des fiches qui défilent
    box?.focus();
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onclose(); } };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); node.remove(); back?.focus?.(); };
  });
</script>

<div class="dlg-back" class:bottom-sheet={sheet} bind:this={node} onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} role="presentation">
  <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title" tabindex="-1" bind:this={box} use:swipeClose={{ onclose, back: () => node }}>
    {#if sheet}<span class="dlg-grip" aria-hidden="true"></span>{/if}
    <button class="dlg-close" onclick={onclose} aria-label={tx('photos.fermer')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
    </button>
    {#if icon || sub}
      <div class="dlg-head">
        {#if icon}<span class="dlg-icon" aria-hidden="true">{@render icon()}</span>{/if}
        <div><h2 id="dlg-title">{title}</h2>{#if sub}<p class="dlg-sub">{sub}</p>{/if}</div>
      </div>
    {:else}
      <h2 id="dlg-title">{title}</h2>
    {/if}
    {@render children?.()}
  </div>
</div>

<style>
  .dlg-back { position: fixed; inset: 0; z-index: 60; background: rgb(0 0 0 / 0.4); display: grid; place-items: center; padding: 16px; }
  .dlg { position: relative; width: min(420px, 100%); max-height: calc(100dvh - 32px); overflow-y: auto; box-sizing: border-box;
    background: var(--card); color: var(--ink); border-radius: 20px; padding: 20px 20px 22px; box-shadow: var(--shadow-float); outline: none; }
  h2 { margin: 2px 44px 10px 0; font-size: 19px; line-height: 1.25; }
  .dlg :global(p) { margin: 0 0 10px; font-size: 15px; line-height: 1.45; }
  .dlg-close { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; border-radius: 50%; border: 0; background: var(--fill);
    color: var(--muted); display: grid; place-items: center; cursor: pointer; }
  .dlg-close::after { content: ''; position: absolute; inset: -6px; }
  /* en-tête avec pictogramme et sous-titre (fenêtre « À propos ») */
  .dlg-head { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; margin: 0 40px 14px 0; }
  .dlg-head h2 { margin: 0; }
  .dlg .dlg-sub { margin: 2px 0 0; font-size: 14px; color: var(--muted); }
  .dlg-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--accent-btn); color: #fff; display: grid; place-items: center; }
  /* fiche qui monte du bas sur téléphone (comme les autres fiches), fenêtre centrée sur grand écran */
  .dlg-grip { display: none; }
  @media (max-width: 767px) {
    /* poignée : on peut faire glisser la fiche vers le bas pour la fermer */
    .bottom-sheet .dlg-grip { display: block; width: 38px; height: 5px; border-radius: 3px; background: var(--line); margin: -8px auto 10px; }
    .dlg-back.bottom-sheet { place-items: end stretch; padding: 0; }
    .dlg-back.bottom-sheet .dlg { width: 100%; max-height: 92dvh; border-radius: 22px 22px 0 0; padding-bottom: calc(22px + env(safe-area-inset-bottom)); }
  }
  .dlg-close svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; }
</style>
