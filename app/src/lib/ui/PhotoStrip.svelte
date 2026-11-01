<!-- Bandeau de photos sous l'en-tête de la fiche, comme Plans (capture du porteur, 01/11/2026) : deux grandes vignettes
     visibles, les autres en faisant glisser ; la source de chaque photo écrite dessus ; plein écran au toucher.
     Photos : placephotos.js (avis Mangrove, Wikimedia, site du lieu). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  /** @type {{ photos: any[] }} */
  let { photos } = $props();
  const app = getContext('app');
  let broken = $state(new Set());
  const shown = $derived(photos.map((p, i) => ({ p, i })).filter(({ p }) => !broken.has(p.src)));
</script>

{#if shown.length}
  <div class="pstrip" class:one={shown.length === 1}>
    {#each shown as { p, i } (p.src)}
      <button class="pcard" onclick={() => (app.viewer = i)} aria-label={tx('fiche.voir_la_photo_sur_en_plein_ecran', { i: i + 1, n: photos.length })}>
        <img src={p.src} alt={i === 0 ? app.title : ''} loading={i < 2 ? 'eager' : 'lazy'} decoding="async"
          crossorigin={p.cors ? 'anonymous' : undefined} referrerpolicy={p.referrer}
          onerror={() => (broken = new Set([...broken, p.src]))} />
        <span class="psrc">{p.source}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .pstrip { display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: var(--gutter); margin: 14px calc(-1 * var(--gutter)) 0;
    padding: 0 var(--gutter); scrollbar-width: none; }
  .pstrip::-webkit-scrollbar { display: none; }
  .pcard { position: relative; flex: none; width: calc((100% - 8px) / 2.15); aspect-ratio: 4 / 4.4; padding: 0; border: 0;
    border-radius: 18px; overflow: hidden; background: var(--fill); scroll-snap-align: start; cursor: zoom-in; }
  .pstrip.one .pcard { width: 100%; aspect-ratio: 16 / 10; }
  .pcard img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .psrc { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); max-width: calc(100% - 16px); overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; padding: 3px 10px; border-radius: 999px; background: rgb(0 0 0 / 0.55);
    color: #fff; font-size: 12.5px; font-weight: 600; }
</style>
