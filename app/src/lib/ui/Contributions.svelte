<!-- Mes contributions (dans Mes lieux) : niveau, avis publiés, flèches de guidage gagnées, lieux sans avis autour de soi.
     Tout est calculé sur le téléphone (contrib.js, reviewer.js) ; pas de classement entre personnes (il faudrait un
     serveur et des identités). Maquette validée le 30/10/2026 ; badges, carte de mes avis et couleur du point
     « vous êtes ici » ajoutés le 01/11 (maquette du 31/10). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { levelOf, unlockedArrows, LEVELS, DOTS, readArrow, saveArrow, markAnnounced } from '#lib/contrib.js';
  import { loadReviewer, saveReviewer, placeId } from '#lib/reviewer.js';
  import { badgeProgress, badgesNotAnnounced, markBadges, topArea } from '#lib/badges.js';
  import { reviewPlaces, showMyReviews } from '#lib/reviewsmap.js';
  import { locateOld } from '#lib/reviewbackfill.js';
  import BadgeIcon from './BadgeIcon.svelte';
  import { badgeName, badgeSub } from '#lib/badgetext.js';
  import { placesInBounds } from '#lib/placestore.js';
  const app = getContext('app');
  let me = $state(loadReviewer());
  const n = me.mine.length;
  // ce qui est « Nouveau » est vu en ouvrant ce panneau : plus de pastille ni d'annonce ensuite
  const fresh = new Set(badgesNotAnnounced(me.mine));
  markAnnounced(n);
  markBadges(me.mine);
  const badges = $derived(badgeProgress(me.mine));
  const mapped = $derived(reviewPlaces(me.mine));
  const cities = $derived([...new Set(me.mine.map((r) => r.city).filter(Boolean))]);
  const area = $derived(topArea(me.mine));
  // avis d'avant le 01/11/2026 (sans position) : retrouvés dans l'index de recherche autour de soi
  locateOld(me, app.me || (app.map && { lat: app.map.getCenter().lat, lon: app.map.getCenter().lng })).then((r) => {
    if (!r) return;
    saveReviewer(r); me = r; markBadges(r.mine);
  }).catch(() => {});
  const lv = levelOf(n);
  const open = unlockedArrows(n);
  let arrow = $state(readArrow(n));
  const ALL = ['classique', ...LEVELS.map((l) => l.id)];
  const NAME = { classique: () => tx('contrib.classique'), eclaireur: () => tx('contrib.eclaireur'), passeur: () => tx('contrib.passeur'),
    vigie: () => tx('contrib.vigie'), phare: () => tx('contrib.phare') };
  const minOf = (id) => LEVELS.find((l) => l.id === id)?.min || 0;

  // lieux sans avis à moins de 300 m (restaurants, cafés, bars, musées…), les plus proches d'abord
  const KINDS = /^(restaurant|cafe|bar|pub|fast_food|ice_cream|bakery|museum|gallery|theatre|cinema|library)$/;
  const TYPES = { 1: 'node', 2: 'way', 3: 'relation' };
  let todo = $state([]);
  const at = app.me || (app.map && { lat: app.map.getCenter().lat, lon: app.map.getCenter().lng });
  if (at) {
    const dLat = 0.0027, dLon = 0.004;
    placesInBounds({ west: at.lon - dLon, east: at.lon + dLon, south: at.lat - dLat, north: at.lat + dLat }, 4).then((all) => {
      const d = (p) => Math.hypot((p.lon - at.lon) * 111320 * Math.cos((at.lat * Math.PI) / 180), (p.lat - at.lat) * 111320);
      todo = all.filter((p) => p.tags.name && !p.tags._rev && KINDS.test(p.tags.amenity || p.tags.tourism || p.tags.shop || '') && d(p) <= 300)
        .map((p) => ({ name: p.tags.name, lat: p.lat, lon: p.lon, osmType: TYPES[p.id % 10], osmId: Math.floor(p.id / 10), m: Math.round(d(p)) }))
        .filter((p) => !me.mine.some((m) => m.id === placeId(p))).sort((a, b) => a.m - b.m);
    }).catch(() => {});
  }
</script>

<div class="lv">
  <div class="top">
    <div class="badge" aria-hidden="true">
      <svg viewBox="0 0 32 32"><path d="M12 28h8l-1.6-15h-4.8z" fill="#2a5bd7" /><path d="M13 13h6l-.4-3h-5.2z" fill="#1b3d8f" /><path d="M14 10V7h4v3" fill="#E39B17" /><path d="M19 8.5 29 5M19 8.5 29 12M13 8.5 3 5M13 8.5 3 12" stroke="#E39B17" stroke-width="1.6" stroke-linecap="round" /></svg>
    </div>
    <div>
      <h2>{lv.level ? NAME[lv.level.id]() : tx('contrib.pas_encore')}</h2>
      <p class="s">{lv.level ? tx('contrib.niveau_sur', { n: lv.rank }) : tx('contrib.premier_avis')}</p>
    </div>
  </div>
  {#if lv.next}
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(lv.progress * 100)} aria-label={tx('contrib.progression')}><i style:width={`${Math.round(lv.progress * 100)}%`}></i></div>
    <p class="n">{tx('contrib.encore', { n: lv.remaining, niveau: NAME[lv.next.id]() })}</p>
  {/if}
  {#if n}<p class="quote">{tx('contrib.servent_a_tous', { n })}</p>{/if}
</div>

<div class="stats"><div class="stat"><b>{n}</b><span>{tx('contrib.avis_publies', { n })}</span></div></div>

<h3 class="h">{tx('badges.titre')}</h3>
<ul class="badges">
  {#each badges as b (b.id)}
    <li class="bdg" class:done={b.done}>
      <BadgeIcon id={b.id} size={44} off={!b.done} />
      <b>{badgeName(b.id)}{#if fresh.has(b.id)} <span class="new">{tx('contrib.nouveau')}</span>{/if}</b>
      <small>{b.done ? (b.id === 'quartier' && area ? tx('badges.obtenu_ou', { ou: area.arr ? tx('badges.arrondissement', { n: area.arr }) : area.city }) : tx('badges.obtenu_court'))
        : badgeSub(b.id, b.n, b.goal)}</small>
    </li>
  {/each}
</ul>

<h3 class="h">{tx('badges.carte_titre')}</h3>
{#if mapped.length}
  <button class="map-card" onclick={() => showMyReviews(app)}>
    <span class="mini" aria-hidden="true"><i style:left="22%" style:top="40%"></i><i style:left="62%" style:top="28%"></i><i style:left="44%" style:top="66%"></i></span>
    <span class="mc-t"><b>{tx('badges.lieux_notes', { n: mapped.length })}</b><small>{[cities.slice(0, 3).join(', '), tx('badges.voir_sur_la_carte')].filter(Boolean).join(' · ')}</small></span>
  </button>
  {#if mapped.length < n}<p class="muted">{tx('badges.sans_position', { n: n - mapped.length })}</p>{/if}
{:else}
  <p class="muted">{n ? tx('badges.sans_position', { n }) : tx('badges.carte_vide')}</p>
{/if}

<h3 class="h">{tx('contrib.fleches')}</h3>
<p class="muted sub">{tx('contrib.couleur_aide')}</p>
<div class="grid" role="radiogroup" aria-label={tx('contrib.fleches')}>
  {#each ALL as id}
    {@const ok = open.includes(id)}
    <button class="un" class:lock={!ok} class:on={arrow === id} role="radio" aria-checked={arrow === id} disabled={!ok}
      onclick={() => { arrow = id; saveArrow(id); app.meMarker?.getElement().style.setProperty('--me-color', DOTS[id]); }}>
      <span class="pt" style:--c={DOTS[id]} aria-hidden="true"></span>
      <span>{NAME[id]()}</span>
      {#if !ok}<small>{tx('contrib.a_partir_de', { n: minOf(id) })}</small>{/if}
    </button>
  {/each}
</div>

<h3 class="h">{tx('contrib.pres_de_vous')}</h3>
{#if todo.length}
  <ul class="todo">
    {#each todo.slice(0, 5) as p (p.osmId)}
      <li><button onclick={() => app.openPlace(p)}><span>{p.name}</span><small>{p.m} m</small></button></li>
    {/each}
  </ul>
{:else}
  <p class="muted">{tx('contrib.rien_pres')}</p>
{/if}

<style>
  .lv { padding: 18px; border-radius: 20px; background: var(--fill); }
  .top { display: flex; gap: 14px; align-items: center; }
  .badge { width: 56px; height: 56px; border-radius: 18px; background: var(--card); display: grid; place-items: center; flex: none; }
  .badge svg { width: 34px; height: 34px; }
  h2 { margin: 0; font-size: 22px; }
  .s { margin: 2px 0 0; font-size: 14px; color: var(--ink); }   /* (gris clair sur fond gris : contraste insuffisant) */
  .bar { height: 8px; border-radius: 4px; background: var(--card); margin: 16px 0 6px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); }
  .n { margin: 0; font-size: 13.5px; color: var(--ink); }
  .quote { margin: 14px 0 0; font-size: 14.5px; line-height: 1.45; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
  .stat { background: var(--fill); border-radius: 16px; padding: 12px 14px; }
  .stat b { display: block; font-size: 22px; }
  .stat span { font-size: 13px; color: var(--ink); }
  .h { margin: 24px 0 10px; font-size: 17px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 10px; }
  .un { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px 8px; border: 2px solid transparent; border-radius: 16px;
    background: var(--fill); font: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer; min-height: 44px; }
  .un.on { border-color: var(--accent); }
  .un.lock { opacity: 0.55; cursor: default; }
  .un small { font-size: 11px; color: var(--muted); }
  .pt { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: var(--card); }
  .pt::after { content: ''; width: 18px; height: 18px; border-radius: 50%; background: var(--c); border: 2.5px solid #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.3); }
  .sub { margin: -4px 0 10px; }
  .badges { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .bdg { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 4px 10px; border-radius: 16px; background: var(--fill); text-align: center; }
  .bdg b { font-size: 14px; font-weight: 650; }
  .bdg small { font-size: 12px; color: var(--ink); line-height: 1.3; }
  .new { display: inline-block; padding: 1px 6px; border-radius: 999px; background: var(--accent-btn); color: #fff; font-size: 11px; font-weight: 650; vertical-align: 1px; }
  .map-card { width: 100%; display: flex; gap: 14px; align-items: center; padding: 12px; border: 0; border-radius: 16px; background: var(--fill); font: inherit; color: var(--ink); text-align: left; cursor: pointer; }
  .mini { position: relative; width: 84px; height: 62px; flex: none; border-radius: 12px; overflow: hidden;
    background: linear-gradient(115deg, transparent 46%, var(--line) 46% 53%, transparent 53%), #efe8d8; }
  .mini i { position: absolute; width: 11px; height: 11px; border-radius: 50%; background: #e39b17; border: 2px solid #fff; }
  .mc-t { display: grid; gap: 2px; }
  .mc-t b { font-size: 16px; }
  .mc-t small { font-size: 13.5px; color: var(--ink); }
  .todo { list-style: none; margin: 0; padding: 0; }
  .todo button { width: 100%; min-height: 48px; display: flex; align-items: center; gap: 8px; border: 0; border-bottom: 1px solid var(--line); background: none;
    font: inherit; font-size: 15.5px; color: var(--ink); text-align: left; cursor: pointer; padding: 0 2px; }
  .todo small { margin-left: auto; color: var(--muted); font-size: 13px; }
  .muted { color: var(--muted); font-size: 14px; }
</style>
