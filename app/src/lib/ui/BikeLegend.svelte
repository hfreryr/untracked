<!-- Légende de la carte vélo (maquette validée le 22/10) : trois traits, et le détail derrière (i). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import Dialog from '#lib/ui/Dialog.svelte';

  const app = getContext('app');
  let info = $state(false);
  // seulement sur la carte nue : une fiche ouverte occupe le bas de l'écran (règle 10 : rien de caché dessous)
  const show = $derived(app.mapMode === 'bike' && !app.place && !app.category && !app.directions && !app.nav);
</script>

{#if show}
  <div class="bike-legend" role="note" aria-label={tx('velo.legende')}>
    <span class="row"><span class="sw" aria-hidden="true"></span>{tx('velo.piste')}</span>
    <span class="row"><span class="sw lane" aria-hidden="true"></span>{tx('velo.bande')}</span>
    <span class="row"><span class="sw dash" aria-hidden="true"></span>{tx('velo.autorise')}</span>
    <button class="more" onclick={() => (info = true)} aria-haspopup="dialog">
      {tx('velo.en_savoir_plus')}
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".9" class="solid" /></svg>
    </button>
  </div>
{/if}
{#if info}
  <Dialog title={tx('velo.titre')} onclose={() => (info = false)}>
    <p>{tx('velo.explication_pistes')}</p>
    <p>{tx('velo.explication_bandes')}</p>
    <p>{tx('velo.explication_autorise')}</p>
    <p>{tx('velo.explication_limites')}</p>
    <p class="src">{tx('velo.source')}</p>
  </Dialog>
{/if}

<style>
  .bike-legend {
    position: absolute; z-index: 2; left: 12px; bottom: calc(20px + env(safe-area-inset-bottom)); max-width: calc(100% - 96px);
    display: grid; gap: 6px; padding: 10px 12px 6px; background: var(--card); border-radius: 16px; box-shadow: var(--shadow-float);
    font-size: 13.5px; font-weight: 500; color: var(--ink);
  }
  .row { display: flex; align-items: center; gap: 8px; }
  .sw { width: 26px; border-top: 4px solid var(--bike, #1C8B3C); border-radius: 2px; }
  .sw.lane { border-top: 3px solid var(--bike-lane, #6CC07A); }
  .sw.dash { border-top: 3px dashed var(--bike-soft, #3FA35C); }
  .more { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 36px; padding: 4px 0 0; border: 0;
    border-top: 1px solid var(--line); background: none; color: var(--muted); font: inherit; font-size: 12.5px; cursor: pointer; }
  .more svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; }
  .more svg .solid { fill: currentColor; stroke: none; }
  p { margin: 0 0 10px; line-height: 1.45; }
  .src { font-size: 13px; color: var(--muted); }
  @media (prefers-color-scheme: dark) { :global(:root:not([data-theme="light"])) .bike-legend { --bike: #3DBE6A; --bike-soft: #7FD69B; --bike-lane: #A4E3B2; } }
  :global(:root[data-theme="dark"]) .bike-legend { --bike: #3DBE6A; --bike-soft: #7FD69B; --bike-lane: #A4E3B2; }
  @media (min-width: 768px) { .bike-legend { left: auto; right: 76px; bottom: 16px; } }
</style>
