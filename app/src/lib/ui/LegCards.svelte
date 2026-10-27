<!-- Détail d'un trajet en transport : une carte par étape (marcher, prendre la ligne, descendre, marcher), comme
     Citymapper (retour d'une utilisatrice, 21/10) : peu de texte, la rame dessinée, les arrêts dépliables.
     Toucher une étape la cadre sur la carte et estompe le reste (directionsflow.focusOnLeg). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { fmtDuration, fmtTime, fmtDistance, MODE_NAMES } from '#lib/routing.js';
  import { badge } from '#lib/routeview.js';
  import { exitLabel, bestExit } from '#lib/exits.js';
  import { exitForQuay } from '#lib/rame.js';
  import { legCards, nextDepartures } from '#lib/legcards.js';
  import ModeIcon from './ModeIcon.svelte';
  import Rame from './Rame.svelte';
  import TraficIcon from './TraficIcon.svelte';
  import TraficDialog from './TraficDialog.svelte';
  import { alertSub } from '#lib/trafic.js';

  /** @type {{ it: any, picked: number, legExits: Record<string, any>, from: any, to: any, now: number }} */
  let { it, picked, legExits, from, to, now } = $props();
  const app = getContext('app');
  const cards = $derived(legCards(it.legs, to?.label || ''));
  let open = $state({});                 // étapes dont la liste des arrêts est dépliée
  let traf = $state(null);               // info trafic ouverte { alerts, leg }
  let entry = $state(null);              // meilleure entrée de la première station { key, exit }

  // Meilleure entrée de la station de départ : l'accès RATP le plus proche du point de départ, sinon l'entrée OSM.
  $effect(() => {
    const first = cards.find((c) => c.kind === 'walk' && c.toRide);
    const ride = first && it.legs[first.li + 1];
    const key = `${picked}|${ride?.fromStop}`;
    if (!ride?.fromPos || entry?.key === key) return;
    const start = it.legs[first.li].coords?.[0];
    const goal = start ? { lon: start[0], lat: start[1] } : from;
    if (!goal) return;
    entry = { key, exit: null };
    exitForQuay(ride.fromStop, goal).catch(() => null)
      .then((r) => r?.exit || bestExit(ride.fromPos, goal).catch(() => null))
      .then((e) => { if (entry?.key === key) entry = { key, exit: e || null }; });
  });
  const tipOf = (li) => legExits[`${picked}|${li}|${it.legs[li].to}`];
  const WHERE = { Avant: tx('itin.rame_avant'), Milieu: tx('itin.rame_milieu'), Arrière: tx('itin.rame_arriere') };
</script>

<ol class="cards" aria-label={tx('itin.etapes')}>
  {#each cards as c (c.kind + c.li)}
    {@const leg = it.legs[c.li]}
    <li class="card {c.kind}" class:sel={app.focusLeg === c.li} data-leg={c.kind === 'off' ? null : c.li}>
      {#if c.kind === 'walk'}
        <button class="head" onclick={() => app.focusOnLeg(c.li)} aria-pressed={app.focusLeg === c.li}>
          <span class="ico walk" aria-hidden="true"><ModeIcon id="walk" /></span>
          <span class="title">{c.final ? tx('itin.marcher_jusqua', { lieu: c.target }) : c.transfer ? tx('itin.correspondance_a_pied', { lieu: c.target }) : tx('itin.marcher_jusqua', { lieu: c.target })}</span>
        </button>
        {#if c.toRide && entry?.exit && exitLabel(entry.exit)}
          <p class="sub"><span class="k">{tx('itin.meilleure_entree')}</span><b>{exitLabel(entry.exit)}</b></p>
        {/if}
        <p class="sub row"><span>{leg.distance ? fmtDistance(leg.distance) : ''}</span><b>{fmtDuration(leg.duration)}</b></p>
      {:else if c.kind === 'stop'}
        <button class="head" onclick={() => app.focusOnLeg(c.li)}>
          <span class="ico stop" aria-hidden="true"></span>
          <span class="title">{tx('itin.arret_2', { from: leg.from })}</span>
        </button>
        <p class="sub">{tx('itin.reprise_a', { fmtTime: fmtTime(leg.end), suite: leg.duration > 90 ? tx('itin.sur_place', { fmtDuration: fmtDuration(leg.duration) }) : '' })}</p>
      {:else if c.kind === 'ride'}
        {@const tip = tipOf(c.li)}
        {@const deps = c.first ? nextDepartures(it, now) : null}
        <button class="head" onclick={() => app.focusOnLeg(c.li)} aria-pressed={app.focusLeg === c.li}
          aria-label={tx('itin.prendre_ligne', { ligne: `${MODE_NAMES[leg.mode] || tx('itin.ligne')} ${leg.line}`, headsign: leg.headsign, from: leg.from })}>
          <span class="badge" style:background={leg.color} style:color={leg.textColor}>{badge(leg)}</span>
          <span class="title"><span class="arrow" aria-hidden="true">→</span> {leg.headsign}</span>
        </button>
        <p class="sub">{tx('itin.depuis', { from: leg.from })}</p>
        {@const tf = leg.trafic}
        {#each (tf?.all || []).slice(0, 2) as a (a.key)}
          <!-- info trafic au plus près de l'action, comme Citymapper (maquette du 27/10/2026) -->
          <button class="al {a.level}" onclick={() => (traf = { alerts: [a], leg })}>
            <TraficIcon skip={a.skip} />
            <span class="al-t"><b>{a.title}</b>{alertSub(a, new Date(now))}</span>
            <span class="al-more">{tx('trafic.details')}</span>
          </button>
        {/each}
        {#if (tf?.all.length || 0) > 2}
          <button class="more al-all" onclick={() => (traf = { alerts: tf.all, leg })}>{tx('trafic.autres_messages', { n: tf.all.length - 2 })}</button>
        {/if}
        {#if deps?.length}
          <p class="deps">
            {#if it.board?.realTime}<span class="live" title={tx('itin.horaire_en_temps_reel')}>●</span>{/if}
            <span>{tx('itin.prochains_passages')}</span>
            <b class="mins">{tx('itin.dans_minutes', { mins: deps.join(', ') })}</b>
          </p>
        {:else}
          <p class="deps"><span>{tx('itin.depart_a', { heure: fmtTime(leg.start) })}</span>{#if leg.realTime}<span class="live" title={tx('itin.horaire_en_temps_reel')}>●</span>{/if}</p>
        {/if}
        {#if tip?.place}
          <div class="board">
            <span>{tx('itin.ou_monter')} <b>{WHERE[tip.place.where] || ''}</b></span>
            <Rame place={tip.place} color={leg.color} />
          </div>
        {/if}
        <button class="more" aria-expanded={!!open[c.li]} onclick={() => (open[c.li] = !open[c.li])}>
          {tx('itin.n_arrets', { n: (leg.stops || 0) + 1 })} · {fmtDuration(leg.duration)}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
        </button>
        {#if open[c.li]}
          <ul class="stops" style:--c={leg.color}>
            <li>{leg.from}<span>{fmtTime(leg.start)}</span></li>
            {#each leg.stopNames || [] as s}
              {#if leg.trafic?.skipped.includes(s)}<li class="mid x"><s>{s}</s><span>{tx('trafic.non_desservie')}</span></li>
              {:else}<li class="mid">{s}</li>{/if}
            {/each}
            <li>{leg.to}<span>{fmtTime(leg.end)}</span></li>
          </ul>
        {/if}
        {#each leg.trafic?.lifts || [] as a (a.key)}<p class="lift">{a.header}</p>{/each}
      {:else if c.kind === 'off'}
        {@const tip = tipOf(c.li)}
        <button class="head" onclick={() => app.focusOnLeg(c.li)}>
          <span class="ico off" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5v14M19 12H9m4-4-4 4 4 4" /></svg></span>
          <span class="title">{tx('itin.descendre_a', { station: leg.to })}</span>
          <span class="time">{fmtTime(leg.end)}</span>
        </button>
        {#if tip?.exit && exitLabel(tip.exit)}
          <p class="sub"><span class="k">{tx('itin.meilleure_sortie')}</span><b>{exitLabel(tip.exit)}</b></p>
        {:else if tip?.transfer}
          <p class="sub">{tx('itin.restez_dans_la_station')}</p>
        {/if}
      {/if}
    </li>
  {/each}
  <li class="card end">
    <span class="ico end" aria-hidden="true"></span>
    <span class="title">{to?.label}</span>
    <span class="time">{fmtTime(it.end)}</span>
  </li>
</ol>
{#if traf}<TraficDialog alerts={traf.alerts} leg={traf.leg} onclose={() => (traf = null)} />{/if}

<style>
  .cards { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 8px; }
  .card { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px 12px; }
  /* trait discret qui relie les étapes, comme une ligne de temps */
  .card + .card::before { content: ''; position: absolute; left: 25px; top: -9px; width: 3px; height: 8px; background: var(--line); border-radius: 2px; }
  .card.sel { border-color: var(--accent); box-shadow: 0 0 0 1.5px var(--accent); }
  .head { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 32px; padding: 0; border: 0; background: none; text-align: left; cursor: pointer; color: var(--ink); font: inherit; }
  .title { flex: 1; min-width: 0; font-size: 16px; font-weight: 700; line-height: 1.25; }
  .arrow { font-weight: 600; }
  .time { font-size: var(--fs-meta); color: var(--muted); font-variant-numeric: tabular-nums; }
  .ico { flex: none; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; background: var(--fill); color: var(--ink); }
  .ico :global(svg), .ico svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .ico :global(svg .solid) { fill: currentColor; stroke: none; }
  .ico.off { background: #2E7D4F; color: #FFFFFF; }
  .ico.stop::after { content: ''; width: 10px; height: 10px; border: 2.5px solid var(--muted); border-radius: 3px; }
  .ico.end::after { content: ''; width: 12px; height: 12px; border-radius: 50%; background: var(--end); }
  .card.end { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; }
  .badge { flex: none; min-width: 30px; height: 30px; padding: 0 6px; border-radius: 15px; display: grid; place-items: center; font-size: 14px; font-weight: 800; }
  .sub { margin: 6px 0 0 40px; font-size: var(--fs-meta); color: var(--muted); display: grid; gap: 1px; }
  .sub b { color: var(--ink); font-weight: 600; }
  .sub .k { font-size: var(--fs-small); }
  .sub.row { display: flex; justify-content: space-between; gap: 8px; }
  .deps { margin: 8px 0 0 40px; padding: 8px 10px; border-radius: 10px; background: var(--fill); font-size: var(--fs-meta); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-variant-numeric: tabular-nums; }
  .deps .mins { color: var(--open); font-weight: 700; margin-left: auto; }
  .live { color: var(--open); font-size: 10px; }
  .board { margin: 10px 0 0 40px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: var(--fs-meta); }
  .board b { font-weight: 700; }
  .more { display: inline-flex; align-items: center; gap: 2px; margin: 8px 0 0 40px; min-height: 32px; padding: 0; border: 0; background: none; color: var(--accent); font: inherit; font-size: var(--fs-meta); font-weight: 600; cursor: pointer; }
  .more svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s; }
  .more[aria-expanded='true'] svg { transform: rotate(180deg); }
  .stops { list-style: none; margin: 4px 0 0 40px; padding: 0 0 0 14px; border-left: 4px solid var(--c); font-size: var(--fs-meta); }
  .stops li { display: flex; justify-content: space-between; padding: 4px 0; font-weight: 600; }
  .stops li.mid { font-weight: 400; color: var(--muted); }
  .stops span { color: var(--muted); font-weight: 400; font-variant-numeric: tabular-nums; }
  /* info trafic (trafic.js) */
  .al { display: flex; gap: 8px; align-items: flex-start; width: calc(100% - 40px); margin: 9px 0 0 40px; padding: 9px 10px; border: 0; border-radius: 10px;
    font: inherit; font-size: var(--fs-meta); line-height: 1.3; text-align: left; cursor: pointer; }
  .al.orange { background: var(--warn-bg); color: var(--warn); }
  .al.red { background: var(--closed-bg); color: var(--closed); }
  .al-t { flex: 1; min-width: 0; color: var(--ink); }
  .al-t b { display: block; font-weight: 700; }
  .al.orange .al-t b { color: var(--warn); }
  .al.red .al-t b { color: var(--closed); }
  .al-more { align-self: center; font-weight: 600; color: var(--accent); white-space: nowrap; }
  .stops li.x { color: var(--warn); font-weight: 600; }
  .stops li.x s { color: var(--muted); font-weight: 400; }
  .stops li.x span { color: var(--warn); font-weight: 600; }
  .lift { margin: 8px 0 0 40px; font-size: var(--fs-small); color: var(--muted); }
  @media (prefers-reduced-motion: reduce) { .more svg { transition: none; } }
</style>
