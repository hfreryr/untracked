<script>
  import { warmSearch } from '#lib/geocode.js';
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import ResultList from '#lib/ui/ResultList.svelte';
  import { playHint } from '#lib/typedhint.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');

  // Exemples qui s'écrivent dans la barre vide, une fois, à l'ouverture (après l'écran de la promesse s'il s'affiche)
  const rest = tx('recherche.rechercher_un_lieu_ou_une_adresse');
  let hint = $state(rest);
  let stopHint = null, played = false;
  $effect(() => {
    if (played || app.showPromise || app.directions || app.query || app.focused) return;
    played = true;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    stopHint = playHint([tx('resultats.exemple_1'), tx('resultats.exemple_2')], (t) => (hint = t), rest, { reduce });
  });
  $effect(() => { if ((app.focused || app.query || app.directions) && stopHint) { stopHint(); stopHint = null; } });
  $effect(() => () => stopHint?.());
</script>


  {#if !app.directions}
    <header class="top">
      <div class="search" class:open={app.showList} bind:offsetHeight={app.searchH}>
        <svg class="lens" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 20 20" /></svg>
        <input id="search" type="search" placeholder={hint} aria-label={tx('recherche.rechercher_un_lieu_ou_une_adresse')}
          autocomplete="off" enterkeyhint="search" bind:value={app.query}
          onfocus={() => { warmSearch(app.me || (app.map && { lat: app.map.getCenter().lat, lon: app.map.getCenter().lng })); app.focused = true; app.editChips = false; app.importOpen = false; app.showModes = false; app.closePlace(); app.clearCategory(); }} onblur={() => setTimeout(() => (app.focused = false), 150)} onkeydown={app.onKey} />
        {#if app.query}
          <button class="icon-btn" onclick={app.clearSearch} aria-label={tx('recherche.effacer_la_recherche')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
          </button>
        {/if}
        <!-- pas de bouton « Itinéraire » ici : comme chez Citymapper, on cherche la destination, puis « Itinéraire » sur sa fiche (16/10) -->
        {#if app.showList}<ResultList />{/if}
      </div>

      {#if !app.showList && !app.place}
        <!-- masqués quand une fiche lieu est ouverte : ils ne servent pas à ce moment-là et cachent la carte -->
        <div class="chips-row">
        <nav class="chips" aria-label={tx('recherche.categories')}>
          {#each app.chipList as c (c.key)}
            <button class="chip" class:on={app.category?.key === c.key} onclick={() => app.pickCategory(c)} style:--fam={app.famColor(c)} aria-pressed={app.category?.key === c.key}>
              {#if c.saved}<svg class="chip-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3l-1.3-1.2C6 14.9 3 12.2 3 8.9 3 6.2 5.1 4 7.8 4c1.5 0 3 .7 4.2 1.9C13.2 4.7 14.7 4 16.2 4 18.9 4 21 6.2 21 8.9c0 3.3-3 6-7.7 10.2z" /></svg>
              {:else}<span class="chip-dot" aria-hidden="true"></span>{/if}{c.label}
            </button>
          {/each}
        </nav>
        <!-- toujours visible, hors du défilement : invite à choisir ses raccourcis (le crayon en bout de rangée passait inaperçu, tests P3 et P4) -->
        <button class="chip add" class:on-edit={app.editChips} onclick={() => { app.editChips = !app.editChips; app.importOpen = false; }} aria-label={tx('recherche.personnaliser_les_raccourcis')} aria-expanded={app.editChips}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        </div>
      {/if}
    </header>
  {:else if !app.nav}
    <header class="top dir" bind:offsetHeight={app.topH}>
      <div class="dir-card" class:open={app.editing}>
        <button class="icon-btn back" onclick={app.closeDirections} aria-label={tx('recherche.revenir_a_la_fiche_du_lieu')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div class="fields">
          {#each [['from', app.from, tx('recherche.choisir_un_point_de_depart')], ...(app.showVia ? [['via', app.via, tx('recherche.choisir_un_arret')]] : []), ['to', app.to, tx('recherche.choisir_une_destination')]] as [which, pt, ph] (which)}
            <div class="field" class:editing={app.editing === which} class:via-field={which === 'via'}>
              <span class="field-mark {which}" aria-hidden="true"></span>
              {#if app.editing === which}
                <input id={`field-${which}`} bind:this={app.fieldEl} bind:value={app.fieldQuery} placeholder={ph} autocomplete="off"
                  aria-label={{ from: tx('recherche.depart'), via: tx('itin.arret'), to: tx('recherche.arrivee') }[which]} onkeydown={app.onKey}
                  onblur={() => { app.lastEdit = { which, at: Date.now() }; setTimeout(() => { if (app.editing === which && app.pointOf(which)) app.editing = null; }, 250); }} />
              {:else}
                <button class="field-btn" class:placeholder={!pt} onclick={() => app.editField(which)}>
                  {pt ? pt.label : ph}
                </button>
              {/if}
              {#if which === 'via'}
                <button class="icon-btn rm-stop" onclick={app.removeStop} aria-label={tx('recherche.retirer_arret')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
                </button>
              {/if}
            </div>
          {/each}
        </div>
        <button class="icon-btn swap" onclick={app.swap} aria-label={tx('recherche.inverser_depart_et_arrivee')} disabled={!app.from || !app.to}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v15M4.5 7.5 8 4l3.5 3.5M16 20V5M12.5 16.5 16 20l3.5-3.5" /></svg>
        </button>
        {#if app.editing}<ResultList />{/if}
      </div>

    </header>
  {/if}

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  /* ——— Haut d'écran ——— */
  .top {
    position: absolute; z-index: 3; left: 0; right: 0;
    top: env(safe-area-inset-top); padding: 10px 12px 0; pointer-events: none;
    display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px;   /* minmax(0) : le contenu ne peut pas élargir la colonne */
  }
  .top > * { pointer-events: auto; min-width: 0; }
  .search {
    max-width: 440px;
    background: var(--card); border-radius: 28px; box-shadow: var(--shadow-float);
    display: grid; grid-template-columns: 48px 1fr auto; align-items: center;
  }
  .search.open { border-radius: 24px; }
  .lens { width: 20px; height: 20px; justify-self: center; color: var(--muted); stroke-width: 2.2; }
  input {
    border: 0; background: none; font: inherit; font-size: 17px; color: var(--ink);
    padding: 12px 16px 12px 0; min-width: 0; outline: none; width: 100%;   /* marge à droite : le texte ne touche plus le bord */
  }
  input::placeholder { color: var(--muted); }
  input::-webkit-search-cancel-button { display: none; }
  .icon-btn { border: 0; background: none; width: 46px; height: 46px; cursor: pointer; display: grid; place-items: center; color: var(--muted); }
  .icon-btn svg { width: 20px; height: 20px; stroke-width: 2; }
  .icon-btn:disabled { opacity: 0.35; cursor: default; }

  /* La zone qui défile garde de la place autour des boutons pour ne pas rogner leur ombre,
     et s'estompe à droite pour indiquer qu'on peut faire défiler. */
  .chips {
    display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
    margin: -4px -12px -16px; padding: 4px 12px 16px;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 32px), transparent);
            mask-image: linear-gradient(90deg, #000 calc(100% - 32px), transparent);
  }
  .chips::-webkit-scrollbar { display: none; }
  .chip {
    flex: none; display: inline-flex; align-items: center; gap: 7px;
    height: 32px; padding: 0 12px 0 10px; border: 0; border-radius: 16px;
    background: var(--card); box-shadow: var(--shadow-chip); font-size: 14px; font-weight: 500; cursor: pointer;
  }
  .chip-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--fam); }
  /* fond assombri : texte blanc lisible quelle que soit la famille (contraste ≥ 4,5:1, WCAG AA) */
  .chip.on { background: color-mix(in srgb, var(--fam) 76%, #000); color: #fff; }
  .chip.on .chip-dot { background: #fff; }

  /* ——— Panneau d'itinéraire ——— */
  .dir-card {
    background: var(--card); border-radius: 22px; box-shadow: var(--shadow-float);
    display: grid; grid-template-columns: 40px 1fr 44px; align-items: center; padding: 2px 0;
  }
  .back { width: 40px; color: var(--ink); }
  .fields { display: grid; position: relative; }
  .field { display: grid; grid-template-columns: 22px 1fr; align-items: center; min-height: 40px; }
  .field + .field { border-top: 1px solid var(--line); }
  .field-mark { width: 10px; height: 10px; border-radius: 50%; justify-self: center; }
  .field-mark.from { border: 2.5px solid var(--ink); width: 7px; height: 7px; }
  .field-mark.to { background: var(--end); }
  .fields::before {
    content: ''; position: absolute; left: 10px; top: 26px; bottom: 26px; width: 2px;
    background: repeating-linear-gradient(var(--rail) 0 2px, transparent 2px 5px);
  }
  .field-btn {
    border: 0; background: none; text-align: left; padding: 9px 8px 9px 6px; font-size: var(--fs-body); cursor: pointer;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .field-btn.placeholder { color: var(--muted); }
  .field input { padding: 9px 8px 9px 6px; font-size: 16px; }
  .field.editing { background: var(--fill); border-radius: 10px; }
  .swap svg { width: 22px; height: 22px; color: var(--ink); }
  .dir-card .results { margin-top: 4px; }
  .field.via-field { grid-template-columns: 22px 1fr 44px; }
  .field-mark.via { width: 7px; height: 7px; border-radius: 2px; border: 2.5px solid var(--muted); background: var(--card); }
  .rm-stop { width: 36px; height: 36px; color: var(--muted); }
  .rm-stop svg { width: 18px; height: 18px; }
  .rm-stop { width: 44px; height: 44px; }
  .chip-heart { width: 15px; height: 15px; fill: var(--fam); stroke: none; }
  .chip.on .chip-heart { fill: #fff; }
  /* rangée : raccourcis qui défilent + bouton « + » fixe à droite */
  .chips-row { display: flex; align-items: flex-start; gap: 6px; }
  .chips-row .chips { flex: 1; min-width: 0; margin-right: 0; }
  .chip.add { flex: none; width: 32px; padding: 0; justify-content: center; color: var(--accent); }
  .chip.add svg { width: 18px; height: 18px; stroke-width: 2.2; }
  .chip.add.on-edit { background: var(--accent-btn); color: #fff; }
  .opill.on { background: var(--accent-btn); border-color: var(--accent-btn); color: #fff; }

  /* ——— Grand écran : panneaux à gauche ——— */
  @media (min-width: 768px) {

    /* Grand écran : raccourcis à droite de la recherche, sur une ou deux lignes, sans défilement. */
    .top { padding: 16px 16px 0; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; right: 76px; }
    .top.dir { flex-direction: column; flex-wrap: nowrap; right: auto; }
    .search, .dir-card { width: 400px; flex: none; }
    .chips-row { flex: 1; min-width: 0; }
    .chips { flex: 1; min-width: 0; flex-wrap: wrap; overflow: visible; margin: 0; padding: 6px 0 0; -webkit-mask-image: none; mask-image: none; }
    .chip.add { margin-top: 6px; }
  }
</style>
