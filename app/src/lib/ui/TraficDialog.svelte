<!-- Détail de l'info trafic d'une étape (maquette du 27/10/2026, inspirée de Citymapper) : le texte complet du
     transporteur, la période et la source. Une ou plusieurs annonces ; fenêtre standard (Dialog.svelte). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { badge } from '#lib/routeview.js';
  import { lastDay } from '#lib/trafic.js';
  import Dialog from './Dialog.svelte';
  /** @type {{ alerts: any[], leg: any, onclose: () => void }} */
  let { alerts, leg, onclose } = $props();
  const day = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
</script>

<Dialog title={alerts.length === 1 ? alerts[0].title : tx('trafic.n_messages', { n: alerts.length })} {onclose}>
  {#snippet icon()}<span class="tb" style:background={leg.color} style:color={leg.textColor}>{badge(leg)}</span>{/snippet}
  <div class="tf">
    {#each alerts as a (a.key)}
      <section class="msg">
        {#if alerts.length > 1}<h3 class={a.level}>{a.title}</h3>{/if}
        {#if a.cause}<p class="cause {a.level}">{a.cause}</p>{/if}
        {#each a.text.split('\n') as para}<p>{para}</p>{/each}
        {#if a.from || a.until}
          <dl>
            {#if a.from}<div><dt>{tx('trafic.depuis')}</dt><dd>{day(a.from)}</dd></div>{/if}
            {#if a.until}<div><dt>{tx('trafic.jusqu_au_label')}</dt><dd>{day(lastDay(a.until))}</dd></div>{/if}
          </dl>
        {/if}
      </section>
    {/each}
    <p class="src">{tx('trafic.source')}</p>
  </div>
</Dialog>

<style>
  :global(.dlg-icon:has(.tb)) { background: none; }
  .tb { min-width: 30px; height: 30px; padding: 0 6px; border-radius: 15px; display: grid; place-items: center; font-size: 14px; font-weight: 800; }
  .tf { max-height: 60vh; overflow-y: auto; }
  .msg + .msg { border-top: 1px solid var(--line); margin-top: 12px; padding-top: 4px; }
  h3 { font-size: 16px; margin: 10px 0 2px; }
  .cause { font-weight: 700; font-size: var(--fs-meta); margin: 4px 0; }
  .red { color: var(--closed); }
  .orange { color: var(--warn); }
  p { font-size: 15px; line-height: 1.45; margin: 8px 0; }
  dl { margin: 10px 0 0; border-top: 1px solid var(--line); font-size: 14px; }
  dl div { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--line); }
  dt { color: var(--muted); }
  dd { margin: 0; }
  .src { font-size: var(--fs-small); color: var(--muted); margin-top: 12px; }
</style>
