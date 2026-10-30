<!-- « Comment était X ? » : une carte au retour dans l'app, 1 h à 2 jours après un guidage terminé à un lieu (contrib.js).
     Une seule fois par lieu ; ✕ la ferme pour de bon. Toucher une étoile ouvre la fiche du lieu et la fenêtre d'avis
     avec cette note (Reviews.svelte). Maquette validée le 30/10/2026. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { readAsks, saveAsks, dueAsk, asked, setIntent } from '#lib/contrib.js';
  import { loadReviewer } from '#lib/reviewer.js';
  const app = getContext('app');
  let ask = $state(dueAsk(readAsks(), loadReviewer()));
  const show = $derived(!!ask && !app.place && !app.category && !app.directions && !app.nav && !app.showPromise && !app.focused && !app.aboutOpen);
  $effect(() => { app.reviewAskOn = show; });
  const when = $derived(ask ? new Date(ask.t) : null);
  const dayWord = (d) => { const n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1);
    return d.toDateString() === n.toDateString() ? tx('avis.aujourd_hui') : d.toDateString() === y.toDateString() ? tx('avis.hier') : d.toLocaleDateString('fr-FR', { weekday: 'long' }); };
  function close() { saveAsks(asked(readAsks(), ask.id)); ask = null; }
  function rate(n) {
    const a = ask;
    close();
    setIntent(a.id, n);
    app.openPlace({ id: a.id, name: a.name, lat: a.lat, lon: a.lon, osmType: a.osmType, osmId: a.osmId });
  }
</script>

{#if show}
  <div class="ask" role="region" aria-label={tx('avis.comment_etait', { nom: ask.name })}>
    <button class="x" onclick={close} aria-label={tx('photos.fermer')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg></button>
    <p class="h">{tx('avis.comment_etait', { nom: ask.name })}</p>
    <p class="s">{dayWord(when)} · {tx('avis.une_note_suffit')}</p>
    <div class="row" role="group" aria-label={tx('avis.votre_note')}>
      {#each [1, 2, 3, 4, 5] as n}
        <button class="star" onclick={() => rate(n)} aria-label={tx('avis.n_etoiles', { n })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z" /></svg>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .ask { position: absolute; z-index: 4; left: 12px; right: 12px; bottom: calc(196px + env(safe-area-inset-bottom)); max-width: 420px; box-sizing: border-box;
    padding: 14px 16px 8px; background: var(--card); color: var(--ink); border-radius: 20px; box-shadow: var(--shadow-float); }
  .h { margin: 0 40px 2px 0; font-size: 16.5px; font-weight: 700; line-height: 1.3; }
  .s { margin: 0 0 2px; font-size: var(--fs-meta); color: var(--muted); }
  .s::first-letter { text-transform: uppercase; }
  .x { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border-radius: 16px; border: 0; background: var(--fill); display: grid; place-items: center; cursor: pointer; color: var(--muted); }
  .x::after { content: ''; position: absolute; inset: -6px; }
  .x svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; }
  .row { display: flex; gap: 2px; margin-left: -8px; }
  .star { width: 44px; height: 44px; border: 0; background: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: #B26A00; }
  .star svg { width: 30px; height: 30px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round; }
  @media (min-width: 768px) { .ask { left: auto; right: 76px; bottom: 16px; width: 380px; } }
</style>
