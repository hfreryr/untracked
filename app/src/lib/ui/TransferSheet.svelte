<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { DEFAULT_LISTS } from '#lib/myplaces.js';
  import ListDot from '#lib/ui/ListDot.svelte';
  import { draggable } from '#lib/sheet.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
</script>


    <!-- glisser vers le bas = « Ignorer », comme les autres fiches (21/10) -->
    <section class="sheet" aria-label={tx('transfert.recuperer_vos_lieux')} use:draggable={{ key: 'transfer', onDismiss: () => (app.incoming = null) , modal: true }}>
      <h1>{tx('transfert.recuperer_vos_lieux')}</h1>
      <p class="kind">{tx('transfert.depuis_un_autre_appareil')}</p>
      <ul class="rows">
        <li class="row"><ListDot l={DEFAULT_LISTS[0]} size={24} /><span>{tx('transfert.lieu_dans_liste', { lieux: app.incoming.data.places.length, listes: app.incoming.data.lists.length })}</span></li>
        {#if app.incoming.data.shortcuts.home || app.incoming.data.shortcuts.work}
          <li class="row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5M6.5 10v9.5h11V10" /><path d="M10.2 19.5v-4.8h3.6v4.8" /></svg><span>{[app.incoming.data.shortcuts.home && tx('transfert.maison'), app.incoming.data.shortcuts.work && tx('transfert.travail')].filter(Boolean).join(' et ')}</span></li>
        {/if}
      </ul>
      <p class="credit">{tx('transfert.ils_ajoutent_a_ceux_de_cet_appareil')}</p>
      <button class="go wide done" onclick={() => { const n = app.applyIncoming(app.incoming.raw); app.incoming = null; app.say(tx('transfert.lieu_ajoute_a_mes_lieux', { n })); }}>{tx('transfert.ajouter_a_cet_appareil')}</button>
      <button class="link more" onclick={() => (app.incoming = null)}>{tx('transfert.ignorer')}</button>
    </section>

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  .link { border: 0; background: none; color: var(--accent); font: inherit; font-weight: 500; cursor: pointer; padding: 4px 0; }
  .go.wide.done { width: 100%; margin: 14px 0 4px; height: 46px; background: var(--accent-btn); }
  h1 { font-size: 24px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; margin: 2px 44px 2px 0; text-wrap: balance; }
  .kind { margin: 0; color: var(--muted); font-size: 15px; }
  .kind::first-letter { text-transform: uppercase; }

  .rows { list-style: none; margin: 16px 0 0; padding: 0; border-top: 1px solid var(--line); }
  .row { display: grid; grid-template-columns: 24px 1fr; gap: 16px; align-items: center; min-height: 52px; border-bottom: 1px solid var(--line); font-size: 15.5px; }
  .row > svg { width: 22px; height: 22px; color: var(--accent); }
</style>
