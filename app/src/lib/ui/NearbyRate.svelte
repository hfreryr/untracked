<!-- « Votre avis sur ce lieu — Vous êtes à proximité » : en haut de la fiche quand on est à moins de 100 m
     (maquette B validée le 31/10/2026, étoiles). Toucher une étoile ouvre la fenêtre d'avis avec cette note
     (Reviews.svelte écoute l'événement « avis-noter »). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { placeId } from '#lib/reviewer.js';
  /** @type {{ place: any }} */
  let { place } = $props();
  const rate = (n) => window.dispatchEvent(new CustomEvent('avis-noter', { detail: { id: placeId(place), stars: n } }));
</script>

<div class="near">
  <p class="t">{tx('avis.votre_avis_sur_ce_lieu')}</p>
  <p class="s">{tx('avis.vous_etes_a_proximite')}</p>
  <div class="stars" role="group" aria-label={tx('avis.votre_note')}>
    {#each [1, 2, 3, 4, 5] as n}
      <button aria-label={tx('avis.n_etoiles', { n })} onclick={() => rate(n)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z" /></svg>
      </button>
    {/each}
  </div>
</div>

<style>
  .near { margin: 14px 0 0; padding: 12px 14px 8px 16px; border-radius: 16px; background: var(--fill); }
  .t { margin: 0; font-size: 15.5px; font-weight: 650; }
  .s { margin: 1px 0 0; font-size: 13.5px; color: var(--ink); }   /* gris sur fond gris : contraste insuffisant (axe) */
  .stars { display: flex; gap: 2px; margin: 4px 0 0 -8px; }
  .stars button { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: none; padding: 0; cursor: pointer; color: var(--muted); }
  .stars svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round; }
  .stars button:active svg { fill: #f2b01e; stroke: #f2b01e; }
</style>
