<!-- Guidage, inspiré de Plans (maquette validée le 21/10) : panneau gris-noir en haut avec la manœuvre en grand
     et, collée dessous, la suivante (« Puis ») ; en bas, trois chiffres ; on remonte la barre pour les étapes, la voix
     et « Terminer ». Dessins maison, aucune icône reprise d'Apple. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { arrowAngle, isRoundabout } from '#lib/nav.js';
  import { badge } from '#lib/routeview.js';
  import ModeIcon from './ModeIcon.svelte';
  import { etaParts } from '#lib/navglide.js';
  import { speakFr, hush } from '#lib/speech.js';

  let { nav, navBanner, navRemaining, to, navFollow, navList = $bindable(), voice = $bindable(), endNav, recenter, manual = false, stepBy } = $props();
  let barOpen = $state(false);         // barre du bas remontée : étapes, voix, Terminer
  const parts = $derived(etaParts(navRemaining.left ?? 0, navRemaining.meters ?? 0));
  // glisser la barre vers le haut l'ouvre, vers le bas la referme (comme les fiches de l'app)
  function swipeBar(node) {
    let y0 = null;
    const start = (e) => { y0 = e.touches[0].clientY; };
    const end = (e) => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0;
      y0 = null;
      if (dy < -25) barOpen = true;
      else if (dy > 25) barOpen = false;
    };
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchend', end);
    return { destroy() { node.removeEventListener('touchstart', start); node.removeEventListener('touchend', end); } };
  }
</script>

<div class="nav-top" class:arrived={navBanner.arrived} role="status" aria-live="polite">
  <div class="nav-main">
    <span class="nav-icon" aria-hidden="true">
      {#if navBanner.arrived || navBanner.icon === 'arrive' || navBanner.icon === 'stop'}
        <svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" class="solid" /><circle cx="12" cy="9.5" r="2.6" class="hole" /></svg>
      {:else if navBanner.icon === 'walk'}<ModeIcon id="walk" />
      {:else if navBanner.icon === 'board' || navBanner.icon === 'alight'}
        <span class="badge" class:round={navBanner.line?.mode === 'SUBWAY' || navBanner.line?.mode === 'METRO'} style:background={navBanner.line?.color} style:color={navBanner.line?.textColor}>{navBanner.line ? badge(navBanner.line) : ''}</span>
      {:else if isRoundabout(navBanner.icon)}
        <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="4.5" /><path d="M12 8.5V3M9 6l3-3 3 3M12 17.5V22" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" style:transform={`rotate(${arrowAngle(navBanner.icon)}deg)`}><path d="M12 21V6M6.5 11.5 12 6l5.5 5.5" /></svg>
      {/if}
    </span>
    <span class="nav-txt">
      {#if navBanner.dist}<span class="nav-dist">{navBanner.dist}</span>{/if}
      <span class="nav-text">{navBanner.text}</span>
      {#if navBanner.sub}<span class="nav-sub">{navBanner.sub}</span>{/if}
    </span>
  </div>
  {#if navBanner.then && !navBanner.arrived}<p class="nav-then"><span class="then-label">{tx('guidage.puis_label')}</span> {navBanner.then}</p>{/if}
  {#if manual && !navBanner.arrived}
    <!-- sans position, le guidage ne peut pas avancer seul : on passe les étapes à la main -->
    <div class="nav-manual" role="group" aria-label={tx('guidage.etapes_a_la_main')}>
      <span class="nav-manual-why">{tx('guidage.position_indisponible')}</span>
      <button onclick={() => stepBy(-1)} disabled={nav.k === 0} aria-label={tx('guidage.etape_precedente')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
      <button onclick={() => stepBy(1)} disabled={nav.k >= nav.steps.length - 1} aria-label={tx('guidage.etape_suivante')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
    </div>
  {/if}
</div>
{#if !navFollow}
  <button class="nav-recenter" onclick={recenter}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 19 20l-7-4-7 4z" class="solid" /></svg>{tx('guidage.recentrer')}
  </button>
{/if}
{#if navList}
  <section class="sheet nav-list" aria-label={tx('guidage.etapes_du_trajet')}>
    <!-- P6 ne savait pas comment refermer la liste : une croix, comme sur les autres fiches -->
    <button class="close" onclick={() => (navList = false)} aria-label={tx('guidage.fermer_les_etapes')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
    </button>
    <h1>{tx('itin.etapes')}</h1>
    <ol class="steps">
      {#each nav.steps as st, i}
        <li class:done={i < nav.k + (nav.kind === 'transit' ? 0 : 1)} class:now={i === (nav.kind === 'transit' ? nav.k : nav.k + 1)}>
          <span>{st.text}{#if st.sub}<small class="why">{st.sub}</small>{/if}</span>
        </li>
      {/each}
      <li class="arrive"><span>{tx('itin.arrivee_3', { label: to.label })}</span></li>
    </ol>
  </section>
{/if}
<div class="nav-bottom" class:open={barOpen || navBanner.arrived} use:swipeBar>
  <button class="nav-stats" onclick={() => (barOpen = !barOpen)} aria-expanded={barOpen || navBanner.arrived}>
    <span class="nav-grip" aria-hidden="true"></span>
    {#if navBanner.arrived}
      <span class="stat wide"><b>{tx('guidage.arrive')}</b><small>{to.label}</small></span>
    {:else}
      <span class="stat"><b>{navRemaining.eta}</b><small>{tx('guidage.unite_arrivee')}</small></span>
      {#each parts as p}<span class="stat"><b>{p.v}</b><small>{p.u}</small></span>{/each}
    {/if}
  </button>
  {#if barOpen || navBanner.arrived}
    <div class="nav-more">
      <button class="nav-row" onclick={() => { navList = !navList; barOpen = false; }} aria-expanded={navList}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" class="solid" /><circle cx="4.5" cy="12" r="1" class="solid" /><circle cx="4.5" cy="18" r="1" class="solid" /></svg>
        {tx('guidage.etapes_du_trajet')}
      </button>
      <button class="nav-row nav-btn" onclick={() => { voice = !voice; if (voice) speakFr(tx('guidage.voix_activee')); else hush(); }} aria-pressed={voice}>
        {#if voice}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></svg>
        {:else}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></svg>{/if}
        {voice ? tx('guidage.voix_activee') : tx('guidage.voix_coupee')}
      </button>
      <button class="nav-end" onclick={endNav}>{tx('guidage.terminer')}</button>
    </div>
  {/if}
</div>

<style>
  /* panneau gris-noir, presque toute la largeur ; « Puis » collé dessous, dans le même bloc */
  .nav-top {
    position: absolute; z-index: 5; left: 8px; right: 8px; top: calc(8px + env(safe-area-inset-top));
    background: #1F2023; color: #fff; border-radius: 24px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.28); max-width: 560px; overflow: hidden;
  }
  .nav-top.arrived { background: #1E7A3E; }
  .nav-main { display: grid; grid-template-columns: 60px 1fr; gap: 14px; align-items: center; padding: 18px 20px 18px 14px; }
  .nav-icon { width: 60px; height: 60px; display: grid; place-items: center; }
  .nav-icon :global(svg) { width: 54px; height: 54px; stroke-width: 3; transition: transform 0.2s; }
  .nav-icon .solid { fill: #fff; }
  .nav-icon .hole { fill: #1F2023; stroke: none; }
  .nav-icon .badge { font-size: 17px; min-width: 44px; height: 44px; }
  .nav-txt { display: grid; gap: 3px; min-width: 0; }
  .nav-dist { font-size: 40px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
  .nav-text { font-size: 21px; font-weight: 600; line-height: 1.2; }
  .nav-sub { font-size: 15px; color: rgb(255 255 255 / 0.78); }
  .nav-then { margin: 0; padding: 11px 20px 12px; background: #2B2D31; font-size: 16px; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .then-label { color: rgb(255 255 255 / 0.66); font-weight: 500; margin-right: 4px; }
  /* barre du bas : trois chiffres ; remontée, les options */
  .nav-bottom {
    position: absolute; z-index: 5; left: 0; right: 0; bottom: 0; padding: 0 18px calc(14px + env(safe-area-inset-bottom));
    background: var(--card); box-shadow: 0 -6px 22px rgb(0 0 0 / 0.14); border-radius: 26px 26px 0 0;
  }
  .nav-stats { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; padding: 8px 0 4px; border: 0; background: none; cursor: pointer; color: var(--ink); font: inherit; }
  .nav-grip { grid-column: 1 / -1; justify-self: center; width: 36px; height: 5px; border-radius: 3px; background: var(--line); margin-bottom: 10px; }
  .stat { display: grid; justify-items: center; gap: 1px; min-width: 0; }
  .stat.wide { grid-column: 1 / -1; }
  .stat b { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; line-height: 1.15; }
  .stat small { font-size: 14px; color: var(--muted); font-weight: 500; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-more { display: grid; padding-top: 10px; }
  .nav-row { display: flex; align-items: center; gap: 12px; min-height: 50px; padding: 0 2px; border: 0; border-top: 1px solid var(--line);
    background: none; color: var(--ink); font: inherit; font-size: 16px; font-weight: 500; cursor: pointer; text-align: left; }
  .nav-row svg { width: 22px; height: 22px; }
  .nav-end { margin-top: 12px; height: 54px; border: 0; border-radius: 16px; background: var(--closed); color: #fff; font-weight: 700; font-size: 18px; cursor: pointer; }
  .nav-recenter { position: absolute; z-index: 5; left: 50%; transform: translateX(-50%); bottom: calc(112px + env(safe-area-inset-bottom));
    display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border: 0; border-radius: 22px;
    background: var(--card); color: var(--accent); font-weight: 700; box-shadow: var(--shadow-float); cursor: pointer; }
  .nav-recenter svg { width: 16px; height: 16px; }
  .nav-list { bottom: calc(96px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; z-index: 4; }
  .nav-list h1 { margin-top: 8px; }
  .close {
    position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 50%;
    border: 0; background: var(--fill); cursor: pointer; display: grid; place-items: center; color: var(--muted);
  }
  .close svg { width: 16px; height: 16px; stroke-width: 2.4; fill: none; stroke: currentColor; stroke-linecap: round; }
  .close::after { content: ''; position: absolute; inset: -6px; }
  h1 { font-size: 24px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; margin: 2px 44px 2px 0; }
  .why { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; line-height: 1.35; }
  .steps li.done { color: var(--faint); }
  .steps li.now { font-weight: 700; color: var(--accent); }
  .nav-manual { display: flex; align-items: center; gap: 6px; padding: 10px 16px 12px; border-top: 1px solid rgb(255 255 255 / 0.14); }
  .nav-manual-why { flex: 1; font-size: 13.5px; color: rgb(255 255 255 / 0.85); }
  .nav-manual button { width: 44px; height: 40px; border: 0; border-radius: 12px; background: rgb(255 255 255 / 0.16); color: #fff; display: grid; place-items: center; cursor: pointer; }
  .nav-manual button:disabled { opacity: 0.35; cursor: default; }
  .nav-manual svg { width: 20px; height: 20px; stroke-width: 2.2; }
</style>
