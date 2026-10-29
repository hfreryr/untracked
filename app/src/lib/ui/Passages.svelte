<!-- Autres passages d'une étape (passages.js), dépliés en touchant l'horaire, comme Citymapper (porteur, 29/10/2026).
     Toucher un passage recalcule le trajet avec lui et les correspondances qui suivent. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { fmtTime } from '#lib/routing.js';
  import { legPassages } from '#lib/passages.js';
  /** @type {{ it: any, li: number, now: number, children: any }} */
  let { it, li, now, children } = $props();
  const app = getContext('app');
  const leg = $derived(it.legs[li]);
  let open = $state(false);
  let list = $state(null);               // null : en cours ; [] : rien ; sinon les passages
  let failed = $state(false);
  let key = '';
  $effect(() => {
    if (!open) return;
    const k = `${li}|${leg.tripId}|${+leg.start}`;
    if (k === key) return;
    key = k; list = null; failed = false;
    legPassages(it, li).then((r) => { if (key === k) list = r; }).catch(() => { if (key === k) { failed = true; list = []; } });
  });
  const mins = (t) => Math.round((+t - now) / 60000);
  // le RER change de terminus selon la mission : on l'affiche quand ce n'est pas celui du trajet
  const other = (p) => p.dest && p.dest !== leg.headsign;
</script>

<button class="deps" aria-expanded={open} onclick={() => (open = !open)} aria-label={open ? tx('itin.masquer_passages') : tx('itin.autres_passages')}>
  {@render children()}
  <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
</button>
{#if open}
  <div class="pas" aria-live="polite">
    {#if list === null}
      <p class="msg">{tx('itin.chargement_passages')}</p>
    {:else if failed}
      <p class="msg">{tx('itin.passages_indisponibles')}</p>
    {:else if !list.length}
      <p class="msg">{tx('itin.aucun_autre_passage')}</p>
    {:else}
      <ul>
        {#each list as p (+p.time)}
          <li>
            <button class:cur={p.current} disabled={p.current || app.retiming != null || app.showVia} aria-current={p.current ? 'true' : undefined}
              onclick={() => app.retimeLeg(li, p.time)}>
              <span class="t">{fmtTime(p.time)}</span>
              {#if p.realTime}<span class="live" title={tx('itin.horaire_en_temps_reel')}>●</span>{/if}
              {#if other(p)}<span class="dest">{tx('itin.vers', { dest: p.dest })}</span>{/if}
              <span class="r">{p.current ? tx('itin.passage_choisi') : mins(p.time) >= 0 && mins(p.time) < 60 ? tx('itin.dans_minutes', { mins: mins(p.time) }) : ''}</span>
            </button>
          </li>
        {/each}
      </ul>
      {#if app.retiming === li}<p class="msg">{tx('itin.calcul_de_itineraire')}</p>{/if}
    {/if}
  </div>
{/if}

<style>
  .deps { width: calc(100% - 40px); margin: 8px 0 0 40px; padding: 8px 10px; border: 0; border-radius: 10px; background: var(--fill);
    font: inherit; font-size: var(--fs-meta); color: var(--ink); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-variant-numeric: tabular-nums; text-align: left; cursor: pointer; }
  .deps :global(.mins) { color: var(--open); font-weight: 700; margin-left: auto; }
  .deps :global(.live), .live { color: var(--open); font-size: 10px; }
  .chev { width: 16px; height: 16px; flex: none; fill: none; stroke: var(--accent); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s; }
  .deps:not(:has(:global(.mins))) .chev { margin-left: auto; }
  .deps[aria-expanded='true'] .chev { transform: rotate(180deg); }
  .pas { margin: 4px 0 0 40px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li button { width: 100%; min-height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 0; border-bottom: 1px solid var(--line);
    background: none; font: inherit; font-size: var(--fs-body); color: var(--ink); text-align: left; cursor: pointer; font-variant-numeric: tabular-nums; }
  li button:disabled { cursor: default; }
  li button.cur { font-weight: 700; }
  .t { min-width: 46px; }
  .dest { font-size: var(--fs-meta); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .r { margin-left: auto; font-size: var(--fs-meta); color: var(--muted); white-space: nowrap; }
  .cur .r { color: var(--accent); }
  .msg { margin: 8px 0 0; font-size: var(--fs-meta); color: var(--muted); }
  @media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
</style>
