<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { applyTheme } from '#lib/theme.js';
  import { popover } from '#lib/popover.js';
  import AboutDialog from '#lib/ui/AboutDialog.svelte';
  import MapCredit from '#lib/ui/MapCredit.svelte';
  import BikeLegend from '#lib/ui/BikeLegend.svelte';
  let layersBtn = $state();

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  // Thème au choix (P5 n'avait pas vu le mode clair) : automatique, clair ou sombre, retenu sur l'appareil
  function setTheme(pref) {
    app.themePref = pref;
    applyTheme(pref, true);
    app.restyle();
  }
</script>


  {#if !app.directions}
    <div class="modes-ctl">
      {#if Math.abs(app.bearing) > 1 || app.pitch > 1}
        <button class="round-btn compass" onclick={() => app.map.easeTo({ bearing: 0, pitch: 0, duration: 500 })} aria-label={tx('carte.remettre_le_nord_en_haut')}>
          <svg viewBox="0 0 24 24" aria-hidden="true" style:transform={`rotate(${-app.bearing}deg)`}><path d="M12 3 15.5 12h-7z" class="solid north" /><path d="M8.5 12h7L12 21z" /></svg>
        </button>
      {/if}
      {#if app.showModes}
        <div class="modes-pop" role="menu" aria-label={tx('carte.type_de_carte')} use:popover={{ trigger: () => layersBtn, close: () => (app.showModes = false), place: 'above', align: 'end' }}>
          <!-- 4 types de carte en grille 2 × 2, comme Plans (porteur, 22/10 : « 3 et 1 ce n'est pas logique ») -->
          <div class="modes-grid">
          <button role="menuitemradio" aria-checked={app.mapMode === 'plan'} class:on={app.mapMode === 'plan'} onclick={() => app.setMapMode('plan')}>
            <span class="thumb plan" aria-hidden="true"></span>{tx('carte.plan')}
          </button>
          <button role="menuitemradio" aria-checked={app.mapMode === 'transit'} class:on={app.mapMode === 'transit'} onclick={() => app.setMapMode('transit')}>
            <span class="thumb transit" aria-hidden="true"></span>{tx('carte.transports')}
          </button>
          <button role="menuitemradio" aria-checked={app.mapMode === 'satellite'} class:on={app.mapMode === 'satellite'} onclick={() => app.setMapMode('satellite')}>
            <span class="thumb satellite" aria-hidden="true"></span>{tx('carte.satellite')}
          </button>
          <button role="menuitemradio" aria-checked={app.mapMode === 'bike'} class:on={app.mapMode === 'bike'} onclick={() => app.setMapMode('bike')}>
            <span class="thumb bike" aria-hidden="true"></span>{tx('carte.velo')}
          </button>
          </div>
          <div class="theme" role="radiogroup" aria-label={tx('carte.theme')}>
            <span class="theme-label">{tx('carte.theme')}</span>
            {#each [['auto', tx('carte.theme_auto')], ['light', tx('carte.theme_clair')], ['dark', tx('carte.theme_sombre')]] as [id, label]}
              <button role="radio" aria-checked={app.themePref === id} class:on={app.themePref === id} onclick={() => setTheme(id)}>{label}</button>
            {/each}
          </div>
          <label class="saved-toggle">
            <input type="checkbox" checked={app.showSaved} onchange={(e) => { app.showSaved = e.currentTarget.checked; try { localStorage.setItem('mes-lieux-carte', app.showSaved ? 'oui' : 'non'); } catch { /* rien */ } }} />
            {tx('carte.mes_lieux_sur_la_carte')}
          </label>
        </div>
      {/if}
      <button class="round-btn" bind:this={layersBtn} onclick={() => (app.showModes = !app.showModes)} aria-label={tx('carte.type_de_carte')} aria-expanded={app.showModes} aria-haspopup="menu">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z" /><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" /></svg>
      </button>
    </div>
  {/if}
  <button class="locate" class:busy={app.locating} class:following={app.followMode !== 'none'} onclick={app.locate}
    aria-label={app.followMode === 'follow' ? tx('carte.orienter_la_carte_dans_votre') : app.followMode === 'heading' ? tx('carte.remettre_le_nord_en_haut') : tx('carte.me_localiser')}>
    {#if app.followMode === 'heading'}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 17 13H7z" class="solid" /><path d="M7 13h10l-5 8.5z" /><circle cx="12" cy="13" r="1.3" class="solid" /></svg>
    {:else}
      <svg viewBox="0 0 24 24" aria-hidden="true" class:hollow={app.followMode === 'none'}><path d="M20 4 4 11l7 2 2 7z" class="solid" /></svg>
    {/if}
  </button>
  <!-- 3e bouton, même taille que les deux autres (choix du porteur, 16/10) : la promesse, les sources, aider -->
  <button class="about-btn" onclick={() => (app.aboutOpen = true)} aria-label={tx('apropos.bouton')} aria-haspopup="dialog">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".9" class="solid" /></svg>
  </button>
  <MapCredit />
  <BikeLegend />
  {#if app.aboutOpen}<AboutDialog onclose={() => (app.aboutOpen = false)} />{/if}

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  svg .solid { fill: currentColor; stroke: none; }
  input {
    border: 0; background: none; font: inherit; font-size: 17px; color: var(--ink);
    padding: 12px 0; min-width: 0; outline: none; width: 100%;
  }
  input::placeholder { color: var(--muted); }
  input::-webkit-search-cancel-button { display: none; }


  /* ——— Localisation et messages ——— */
  /* trois boutons ronds empilés à droite : types de carte, position, À propos */
  .about-btn {
    position: absolute; z-index: 2; right: 12px; bottom: calc(20px + env(safe-area-inset-bottom));
    width: 48px; height: 48px; border-radius: 50%; border: 0; background: var(--card); box-shadow: var(--shadow-float);
    display: grid; place-items: center; cursor: pointer; color: var(--ink);
  }
  .about-btn svg { width: 22px; height: 22px; }
  :global(.routing) .about-btn, :global(.navigating) .about-btn { display: none; }
  .locate {
    position: absolute; z-index: 2; right: 12px; bottom: calc(78px + env(safe-area-inset-bottom));
    width: 48px; height: 48px; border-radius: 50%; border: 0; background: var(--card); box-shadow: var(--shadow-float);
    display: grid; place-items: center; cursor: pointer; color: var(--accent);
  }
  :global(.routing) .locate { display: none; }
  .modes-ctl { position: absolute; z-index: 2; right: 12px; bottom: calc(136px + env(safe-area-inset-bottom)); display: grid; justify-items: end; gap: 10px; }
  .round-btn {
    width: 48px; height: 48px; border-radius: 50%; border: 0; background: var(--card); box-shadow: var(--shadow-float);
    display: grid; place-items: center; cursor: pointer; color: var(--ink);
  }
  .round-btn svg { width: 22px; height: 22px; }
  .modes-pop { display: flex; gap: 10px; padding: 14px; background: var(--card); border-radius: 20px; box-shadow: var(--shadow-float);
    width: min(330px, calc(100vw - 24px)); box-sizing: border-box; }
  .modes-pop button {
    display: grid; justify-items: center; gap: 6px; border: 0; background: none; cursor: pointer; font-size: 13px; font-weight: 600; padding: 0;
  }
  .modes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 10px; width: 100%; }
  .modes-grid button { width: 100%; }
  .thumb { width: 100%; height: 70px; border-radius: 12px; border: 2px solid transparent; background-size: cover; }
  .modes-pop .on .thumb { border-color: var(--accent); }
  .modes-pop .on { color: var(--accent); }
  .thumb.plan { background: linear-gradient(115deg, transparent 45%, #fff 45% 52%, transparent 52%), linear-gradient(25deg, transparent 60%, #fff 60% 66%, transparent 66%), radial-gradient(circle at 25% 70%, #d4ebcb 0 18%, transparent 19%), #f1eee8; }
  .thumb.transit { background: linear-gradient(110deg, transparent 40%, #ffbe00 40% 46%, transparent 46%), linear-gradient(20deg, transparent 52%, #0055c8 52% 58%, transparent 58%), linear-gradient(160deg, transparent 62%, #e3051c 62% 68%, transparent 68%), linear-gradient(75deg, transparent 28%, #00643c 28% 34%, transparent 34%), #f1eee8; }
  .locate svg { width: 21px; height: 21px; }
  .locate svg.hollow .solid { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
  .locate.following { color: var(--accent); }
  .locate.busy svg { animation: pulse 1s ease-in-out infinite; }
  /* ——— Choix de l'itinéraire ——— */

  /* ——— Guidage ——— */
  :global(.navigating) .modes-ctl, :global(.navigating) .locate { display: none; }
  .saved-toggle { display: flex; align-items: center; gap: 10px; font-size: 15px; padding: 14px 0 6px; cursor: pointer; }
  .saved-toggle input { width: 20px; height: 20px; accent-color: var(--accent-btn); }
  /* vignette de la photo aérienne : toits, cour, arbres (dessin, pas une capture) */
  .thumb.satellite { background: radial-gradient(circle at 30% 35%, #4f6b3a 0 14%, transparent 15%), radial-gradient(circle at 72% 70%, #5b7445 0 12%, transparent 13%),
    linear-gradient(115deg, transparent 44%, #9a9a94 44% 50%, transparent 50%), linear-gradient(25deg, #7d746a 0 30%, #a39686 30% 62%, #6f6a62 62%); }
  /* vignette de la carte vélo : pistes en vert plein, voie autorisée en pointillés (dessin maison) */
  .thumb.bike { background: linear-gradient(115deg, transparent 46%, #1C8B3C 46% 51%, transparent 51%), linear-gradient(28deg, transparent 58%, #1C8B3C 58% 62%, transparent 62%),
    repeating-linear-gradient(90deg, #3FA35C 0 6px, transparent 6px 11px) 0 38px / 100% 3px no-repeat, #F1EDE2; }
  .theme { grid-column: 1 / -1; flex-basis: 100%; border-top: 1px solid var(--line); padding-top: 12px; margin-top: 2px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
  .theme-label { margin-right: auto; }
  .modes-pop .theme button { display: inline-flex; align-items: center; flex: none; height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid var(--line); background: var(--card); font-size: 13px; }
  .modes-pop .theme button.on { background: var(--accent-btn); border-color: var(--accent-btn); color: #fff; }
  .modes-pop .saved-toggle { grid-column: 1 / -1; font-size: 13px; font-weight: 600; padding: 4px 0 0; }
  .modes-pop { flex-wrap: wrap; }
  .compass svg { width: 24px; height: 24px; transition: transform 0.1s; }
  .compass .north { fill: var(--closed); }

  /* ——— Grand écran : panneaux à gauche ——— */
  @media (min-width: 768px) {

    .about-btn { bottom: 16px; right: 16px; }
    .locate { bottom: 74px; right: 16px; }
    .modes-ctl { bottom: 132px; right: 16px; }
  }

  @media (prefers-reduced-motion: reduce) {

    .locate.busy svg { animation: none; }
  }
</style>
