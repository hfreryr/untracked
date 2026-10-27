<!-- Fiche itinéraire : modes en onglets, résumé de l'itinéraire choisi (ce que montre l'aperçu),
     puis étapes et autres itinéraires en tirant la fiche. Modèle : Google Maps et Plans (voir docs/espace-ecran.md). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { tripFare, fmtEuros } from '#lib/fares.js';
  import { draggable } from '#lib/sheet.js';
  import { fmtDuration, fmtTime, fmtDistance } from '#lib/routing.js';
  import { getContext } from 'svelte';
  import { MODES, arrival, departure, departInfo, departText, transitTags, streetOpts, altTag } from '#lib/routeview.js';
  import LegCards from './LegCards.svelte';
  import ModeIcon from './ModeIcon.svelte';
  import LegChain from './LegChain.svelte';
  import TraficIcon from './TraficIcon.svelte';
  import { tripAlert } from '#lib/trafic.js';
  import WhenPicker from './WhenPicker.svelte';

  let { from, to, mode, routes, picked, pickedStreet, showVia, legExits,
    chooseMode, pickStreet, pickTransit, startNav, addStop, computeRoutes, transitPref = ['metro', 'rail', 'tram', 'bus'], setTransitPref, when = null } = $props();
  const current = $derived(routes[mode]);
  const app = getContext('app');   // transports : liste des propositions ou détail (transitDetail), étape choisie (focusLeg)
  // les comptes à rebours des départs (« dans 1, 4, 7 min ») avancent tout seuls, comme sur Citymapper
  let now = $state(Date.now());
  $effect(() => { const t = setInterval(() => (now = Date.now()), 15000); return () => clearInterval(t); });
</script>

{#snippet depart(o)}
  <!-- comme Citymapper : signe « temps réel » devant, puis « dans 1, 4, 7 min de Château Rouge » ou l'heure du train -->
  {@const d = departInfo(o, when, now)}
  <span class="sum-sub depart">{#if d.live}<span class="live" title={tx('itin.horaire_en_temps_reel')}>●</span>{' '}{/if}{departText(d)}</span>
{/snippet}

<section class="sheet route-sheet" aria-label={tx('fiche.itineraire')} use:draggable={{ key: `${from?.lat},${to?.lat},${mode},${app.transitDetail}`, start: app.transitDetail ? 'half' : 'peek', min: true, tease: 58 }}>
  <button class="grip" aria-label={tx('liste.agrandir_la_fiche')}></button>
  <div class="mode-tabs" data-min-end role="tablist" aria-label={tx('itin.mode_de_deplacement')}>
    {#each MODES as m}
      {@const r = routes[m.id]}
      <button class="mode-tab" class:on={mode === m.id} role="tab" aria-selected={mode === m.id} onclick={() => chooseMode(m.id)} aria-label={m.label}>
        <ModeIcon id={m.id} />
        <span class="mode-time">
          {#if !r}{m.label}
          {:else if r.status === 'loading'}<span class="dots" aria-label={tx('itin.calcul_en_cours')}></span>
          {:else if r.status === 'ok'}{fmtDuration(m.id === 'transit' ? (r.data[m.id === mode ? picked : 0] || r.data[0]).duration
            : (streetOpts(r.data)[m.id === mode ? pickedStreet : 0] || r.data).duration)}
          {:else}–{/if}
        </span>
      </button>
    {/each}
  </div>
  <!-- détail d'une proposition : l'heure et les modes se règlent depuis la liste (place gagnée pour les étapes) -->
  {#if !(mode === 'transit' && app.transitDetail)}<WhenPicker />{/if}
  {#if mode === 'transit' && setTransitPref && !app.transitDetail}
    <!-- chaque mode se retire d'un toucher (P4 : « seulement le métro » ; P5 : « je ne veux pas prendre le bus ») -->
    <div class="t-prefs" role="group" aria-label={tx('itin.modes_de_transport')}>
      {#each [['metro', tx('itin.metro')], ['rail', tx('itin.rer_et_train')], ['tram', tx('itin.tram')], ['bus', tx('itin.bus')]] as [id, label]}
        <button class="t-pref" class:on={transitPref.includes(id)} aria-pressed={transitPref.includes(id)} onclick={() => setTransitPref(id)}>
          {#if transitPref.includes(id)}<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>{/if}{label}
        </button>
      {/each}
    </div>
  {/if}
  {#if !from}
    <p class="empty" data-peek-end>{tx('itin.choisissez_un_point_de_depart_pour')}</p>
  {:else if !current || current.status === 'loading'}
    <p class="empty" data-peek-end>{tx('itin.calcul_de_itineraire')}</p>
  {:else if current.status === 'none' && mode === 'transit' && routes.walk?.status === 'ok'}
    <div data-peek-end>
      <p class="empty">{tx('itin.pas_de_transport_utile_sur_ce_trajet', { fmtDuration: fmtDuration(routes.walk.data.duration) })}</p>
      <button class="retry" onclick={() => chooseMode('walk')}>{tx('itin.voir_le_trajet_a_pied')}</button>
    </div>
  {:else if current.status === 'none'}
    <p class="empty" data-peek-end>{tx('itin.aucun_itineraire_trouve_entre_ces', { mode: mode === 'transit' ? tx('itin.en_transports_en_commun') : mode === 'bike' ? tx('itin.a_velo') : mode === 'car' ? tx('itin.en_voiture') : tx('itin.a_pied') })}</p>
  {:else if current.status === 'error'}
    <div data-peek-end>
      <p class="empty">{tx('itin.le_service_itineraire_ne_repond_pas')}</p>
      <button class="retry" onclick={computeRoutes}>{tx('itin.reessayer')}</button>
    </div>
  {:else if mode !== 'transit'}
    {@const opts = streetOpts(current.data)}
    {@const sel = opts[pickedStreet] || opts[0]}
    <div class="sum" data-peek-end>
      <div class="sum-text">
        <span class="sum-dur">{fmtDuration(sel.duration)}</span>
        <span class="sum-sub">{when?.arrive ? tx('itin.partez_a', { depart: departure(sel.duration, when), fmtDistance: fmtDistance(sel.distance) })
          : tx('itin.arrivee', { arrival: arrival(sel.duration, when), fmtDistance: fmtDistance(sel.distance) })}</span>
        <span class="sum-tag" class:best={pickedStreet === 0}>{pickedStreet === 0 ? (opts.length > 1 ? tx('itin.le_plus_rapide') : '') : altTag(sel, opts[0])}</span>
      </div>
      <div class="sum-actions">
        <button class="go" onclick={() => startNav(sel)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 19 20l-7-4-7 4z" class="solid" /></svg>{tx('itin.aller')}
        </button>
        {#if !showVia}<button class="soft-btn" onclick={addStop}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>{tx('itin.arret')}</button>{/if}
      </div>
    </div>
    {#if opts.length > 1}
      <h3 class="sub-h">{tx('itin.autres_itineraires')} <small>{tx('itin.aussi_sur_la_carte')}</small></h3>
      <ul class="alt-list">
        {#each opts as r, i}
          {#if i !== pickedStreet}
            <li><button onclick={() => pickStreet(i)}>
              <span class="alt-dur">{fmtDuration(r.duration)}</span>
              <span class="alt-sub">{when?.arrive ? tx('itin.partez_a_2', { depart: departure(r.duration, when), fmtDistance: fmtDistance(r.distance), etiquette: i === 0 ? tx('itin.le_plus_rapide_2') : altTag(r, opts[0]).toLowerCase() })
                : tx('itin.arrivee_2', { arrival: arrival(r.duration, when), fmtDistance: fmtDistance(r.distance), etiquette: i === 0 ? tx('itin.le_plus_rapide_2') : altTag(r, opts[0]).toLowerCase() })}</span>
            </button></li>
          {/if}
        {/each}
      </ul>
    {/if}
    {#if mode === 'bike'}
      <p class="traffic-note">{tx('itin.itineraire_adapte_aux_velos_pistes')}</p>
    {/if}
    {#if mode === 'car'}
      <p class="traffic-note">{tx('itin.apres_les_capteurs_de_la_ville_de', { estimation: sel.traffic ? tx('itin.estimation_avec_le', { traffic: sel.traffic }) : tx('itin.estimation_sur_route_fluide') })}</p>
    {/if}
    <h3 class="sub-h">{tx('itin.etapes')}</h3>
    <ol class="steps">
      {#each sel.steps as st}
        <li class:stop={st.stop}><span>{st.text}</span>{#if st.distance >= 10}<span class="step-dist">{fmtDistance(st.distance)}</span>{/if}</li>
      {/each}
      <li class="arrive"><span>{tx('itin.arrivee_3', { label: to.label })}</span></li>
    </ol>
  {:else if !app.transitDetail}
    <!-- Les propositions (comme Citymapper et Plans) : pictogrammes, prix, durée, prochains départs ; toucher → le détail -->
    {@const tags = transitTags(current.data, !!when?.arrive)}
    <ul class="t-opts" aria-label={tx('itin.propositions')}>
      {#each current.data as o, i}
        {@const fare = tripFare(o.legs)}
        {@const ta = tripAlert(o)}
        <li data-peek-end={i === 0 ? '' : null}>
          <button class="t-opt" class:sel={i === picked} onclick={() => app.openTransit(i)}>
            <span class="opt-top">
              <LegChain it={o} />
              {#if fare != null}<span class="fare" title={tx('itin.prix_detail')}>{fmtEuros(fare)}</span>{/if}
              <span class="big-dur">{fmtDuration(o.duration)}</span>
            </span>
            {@render depart(o)}
            {#if ta}<span class="t-alert {ta.alert.level}"><TraficIcon skip={ta.alert.skip} />{ta.alert.station ? ta.alert.title : ta.alert.header}</span>{/if}
            {#if tags[i]}<span class="sum-tag best">{tags[i]}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
    {#if !showVia}<button class="soft-btn add-stop" onclick={addStop}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>{tx('itin.ajouter_un_arret')}</button>{/if}
  {:else}
    {@const it = current.data[picked] || current.data[0]}
    {@const fare = tripFare(it.legs)}
    <div class="t-head" data-peek-end>
      <div class="t-top">
        <button class="back" onclick={app.closeTransit} aria-label={tx('itin.retour_aux_propositions')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
        </button>
        <span class="t-sum">
          <span class="sum-dur">{fmtDuration(it.duration)}</span>
          <span class="sum-sub">{fmtTime(it.start)} → {fmtTime(it.end)}{#if fare != null}<span title={tx('itin.prix_detail')}>{tx('itin.prix', { prix: fmtEuros(fare) })}</span>{/if}</span>
        </span>
      </div>
      <div class="sum-actions">
        <button class="go" onclick={() => startNav(it)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 19 20l-7-4-7 4z" class="solid" /></svg>{tx('itin.aller')}
        </button>
        {#if !showVia}<button class="soft-btn" onclick={addStop}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>{tx('itin.arret')}</button>{/if}
      </div>
    </div>
    <LegCards {it} {picked} {legExits} {from} {to} {now} />
    <p class="credit">{tx('fiche.horaires')} <a href="https://transitous.org/sources/" target="_blank" rel="noopener">{tx('fiche.transitous_et_reseaux_de_transport')}</a> {tx('itin.place_dans_la_rame_ratp_ile_de')}</p>
  {/if}
</section>

<style>
  /* info trafic sous une proposition (trafic.js) : une seule ligne, la plus grave */
  .t-alert { display: flex; gap: 6px; align-items: flex-start; margin-top: 6px; font-size: var(--fs-meta); font-weight: 600; line-height: 1.3; text-align: left; }
  .t-alert.orange { color: var(--warn); }
  .t-alert.red { color: var(--closed); }
  /* Onglets des modes, en tête de fiche (comme Google Maps) : icône + temps, trait sous le mode choisi */
  .mode-tabs { display: flex; margin: 0 -16px; padding: 0 8px; border-bottom: 1px solid var(--line); }
  .mode-tab {
    flex: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 42px; padding: 0 2px;
    border: 0; background: none; cursor: pointer; color: var(--muted); font-size: var(--fs-meta); font-weight: 600;
    font-variant-numeric: tabular-nums; white-space: nowrap; position: relative;
  }
  .mode-tab :global(svg) { width: 18px; height: 18px; flex: none; }
  .mode-tab.on { color: var(--accent); }
  .mode-tab.on::after { content: ''; position: absolute; left: 14%; right: 14%; bottom: -1px; height: 3px; border-radius: 3px 3px 0 0; background: var(--accent); }
  .route-sheet .empty, .route-sheet [data-peek-end] > .empty { margin-top: 12px; }
  /* Résumé de l'itinéraire choisi : ce que l'aperçu montre */
  .sum { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 10px 0 2px; }
  .sum-text { display: grid; gap: 1px; min-width: 0; }
  .sum-dur { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.2; }
  .sum-dur.small { font-size: 18px; white-space: nowrap; }
  .sum-sub { font-size: var(--fs-meta); color: var(--muted); font-variant-numeric: tabular-nums; }
  .sum-sub strong { color: var(--ink); font-weight: 600; }
  .sum-tag { font-size: var(--fs-small); color: var(--muted); font-weight: 500; }
  .sum-tag.best { color: var(--open); font-weight: 600; }
  .sum-tag:empty { display: none; }
  .sum-actions { display: flex; gap: 8px; }
  .sum-actions .go { flex: 1; justify-content: center; }
  .soft-btn { display: inline-flex; align-items: center; gap: 4px; height: 40px; padding: 0 14px; border: 0; border-radius: 12px;
    background: var(--fill); color: var(--accent); font-size: var(--fs-body); font-weight: 600; cursor: pointer; }
  .soft-btn svg { width: 16px; height: 16px; stroke-width: 2.2; }
  .sub-h { font-size: var(--fs-meta); font-weight: 700; color: var(--muted); text-transform: none; margin: 16px 0 6px; }
  .sub-h small { font-weight: 500; }
  .alt-list { list-style: none; margin: 0 -16px; padding: 0; }
  .alt-list li + li { border-top: 1px solid var(--line); }
  .alt-list button { display: grid; gap: 2px; width: 100%; padding: 9px 16px; border: 0; background: none; text-align: left; cursor: pointer; }
  .alt-list button:active { background: var(--fill); }
  .alt-dur { font-size: var(--fs-body); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .alt-sub { font-size: var(--fs-small); color: var(--muted); font-variant-numeric: tabular-nums; }
  .alt-sub.tag { color: var(--open); font-weight: 600; }
  /* étapes du trajet en transport : pleine largeur de la fiche, sans fond */
  .route-sheet :global(.legs) { margin: 0 calc(-1 * var(--gutter)); padding: 4px var(--gutter) 6px; background: none; }
  /* Transports : propositions en cartes, puis le détail */
  .t-opts { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 8px; }
  .t-opt { display: grid; gap: 3px; width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); text-align: left; cursor: pointer; color: var(--ink); font: inherit; }
  .t-opt.sel { border-color: var(--accent); }
  .t-opt:active { background: var(--fill); }
  .opt-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .opt-top :global(.chain) { flex: 1; min-width: 0; }
  .fare { font-size: var(--fs-meta); font-weight: 600; color: var(--accent); white-space: nowrap; }
  .big-dur { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .add-stop { margin-top: 10px; }
  .t-head { display: grid; gap: 10px; padding: 10px 0 4px; }
  .t-top { display: flex; align-items: center; gap: 6px; }
  .t-sum { display: grid; gap: 1px; }
  .back { flex: none; width: 40px; height: 40px; margin-left: -10px; border: 0; border-radius: 50%; background: none; color: var(--accent); display: grid; place-items: center; cursor: pointer; }
  .back svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  .t-prefs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 10px 16px 2px; margin: 0 -16px; }
  .t-pref { flex: none; height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer; }
  .t-pref { display: inline-flex; align-items: center; gap: 4px; }
  .t-pref:not(.on) { color: var(--muted); text-decoration: line-through; }
  .t-pref.on { background: var(--soft-accent); border-color: var(--accent); color: var(--accent); }
  .t-pref .tick { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
</style>
