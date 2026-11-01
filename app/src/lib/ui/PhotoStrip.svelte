<!-- Bandeau de photos sous l'en-tête de la fiche, comme Plans (capture du porteur, 01/11/2026) : deux grandes vignettes
     visibles, les autres en faisant glisser ; plein écran au toucher, avec l'auteur et la licence (PhotoViewer.svelte).
     Pas de source écrite sur les vignettes (porteur, 01/11 : « c'est moche » ; Wikipédia ne crédite aussi qu'au toucher).
     Pendant la recherche des photos, des cadres gris réservent leur place ; chaque photo apparaît en fondu.
     Photos : placephotos.js (avis Mangrove, Wikimedia, site du lieu). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  /** @type {{ photos: any[], pending?: boolean }} */
  let { photos, pending = false } = $props();
  const app = getContext('app');
  let broken = $state(new Set());
  let loaded = $state(new Set());
  const show = (src) => { if (!loaded.has(src)) loaded = new Set([...loaded, src]); };
  // image déjà en cache : « load » a pu partir avant l'écoute ; on regarde aussi si elle est déjà là
  const ready = (img, src) => { if (img.complete && img.naturalWidth) show(src); };
  const shown = $derived(photos.map((p, i) => ({ p, i })).filter(({ p }) => !broken.has(p.src)));
</script>

{#if shown.length || pending}
  <div class="pstrip" class:one={shown.length === 1 && !pending} aria-busy={pending}>
    {#each shown as { p, i } (p.src)}
      <button class="pcard" onclick={() => (app.viewer = i)} aria-label={tx('fiche.voir_la_photo_sur_en_plein_ecran', { i: i + 1, n: photos.length })}>
        <img src={p.src} alt={i === 0 ? app.title : ''} loading={i < 2 ? 'eager' : 'lazy'} decoding="async"
          crossorigin={p.cors ? 'anonymous' : undefined} referrerpolicy={p.referrer}
          class:in={loaded.has(p.src)} onload={() => show(p.src)} use:ready={p.src}
          onerror={() => (broken = new Set([...broken, p.src]))} />
      </button>
    {/each}
    {#if pending}{#each { length: Math.max(0, 2 - shown.length) } as _}<div class="pcard wait" aria-hidden="true"></div>{/each}{/if}
  </div>
{/if}

<style>
  .pstrip { display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: var(--gutter); margin: 14px calc(-1 * var(--gutter)) 0;
    padding: 0 var(--gutter); scrollbar-width: none; }
  .pstrip::-webkit-scrollbar { display: none; }
  .pcard { position: relative; flex: none; width: calc((100% - 8px) / 2.15); aspect-ratio: 4 / 4.4; padding: 0; border: 0;
    border-radius: 18px; overflow: hidden; background: var(--fill); scroll-snap-align: start; cursor: zoom-in; }
  .pstrip.one .pcard { width: 100%; aspect-ratio: 16 / 10; }
  .pcard img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.25s; }
  .pcard img.in { opacity: 1; }
  .wait { cursor: default; animation: breathe 1.2s ease-in-out infinite alternate; }
  @keyframes breathe { to { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .pcard img { transition: none; } .wait { animation: none; } }
</style>
