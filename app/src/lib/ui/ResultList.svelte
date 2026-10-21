<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { ALL_CATEGORIES } from '#lib/categories.js';
  import ListDot from '#lib/ui/ListDot.svelte';
  import PinnedRow from '#lib/ui/PinnedRow.svelte';
  import { brandOf } from '#lib/brandhit.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  // une enseigne (plusieurs lieux du même nom et du même type) : une ligne en tête mène à tous ses lieux, comme Google Maps
  const brand = $derived(!app.editing && !app.assigning && !app.catHit && app.activeQuery.trim().length >= 2 ? brandOf(app.results) : null);
</script>


  <ul class="results" aria-label={tx('resultats.liste_aria')}>
    {#if app.editing}
      <li class="note map-hint">{tx('resultats.ou_touchez_la_carte_pour_choisir_un')}</li>
    {/if}
    {#if app.editing === 'from'}
      <li class="opt">
        <button onmousedown={app.useMyPosition}>
          <span class="r-icon me-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 4 4 11l7 2 2 7z" class="solid" /></svg></span>
          <span class="r-text"><span class="r-name">{tx('resultats.votre_position')}</span><span class="r-meta">{tx('resultats.utiliser_la_localisation_du')}</span></span>
        </button>
      </li>
    {/if}
    {#if app.activeQuery.trim().length < 2}
      <li class="pinned-li"><PinnedRow inSearch={true} /></li>
    {/if}
    {#if app.assigning && app.activeQuery.trim().length < 2}
      <li class="note">{tx('resultats.tapez_adresse_de_votre_puis', { lieu: app.assigning === 'home' ? tx('resultats.maison') : tx('resultats.travail') })}
        <button class="link" onmousedown={(e) => { e.preventDefault(); app.assigning = null; }}>{tx('resultats.annuler')}</button></li>
    {/if}
    {#if app.activeQuery.trim().length < 2 && !app.editing && !app.assigning && !app.recents.length}
      <!-- exemples touchables, pour un nouvel utilisateur seulement : on ne devine pas qu'on peut écrire « restaurant ouvert
           demain dans le 8e » (retour du porteur). Ils laissent la place aux recherches récentes dès la première (16/10). -->
      {#each [tx('resultats.exemple_1'), tx('resultats.exemple_2'), tx('resultats.exemple_3')] as ex}
        <li class="opt example">
          <button onmousedown={(e) => { e.preventDefault(); app.query = ex; }}>
            <span class="r-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 20 20" /></svg></span>
            <span class="r-text"><span class="r-name">{ex}</span></span>
          </button>
        </li>
      {/each}
    {/if}
    {#if app.activeQuery.trim().length < 2 && app.favorites.length}
      <li class="note recents-head"><span>{tx('resultats.mes_lieux')}</span>
        {#if !app.editing}<button class="link" onmousedown={(e) => { e.preventDefault(); app.focused = false; document.activeElement?.blur(); app.pickCategory(ALL_CATEGORIES[0]); }}>{tx('resultats.tout_voir')}</button>{/if}</li>
      {#each app.favorites.slice(0, 5) as r (r.id + r.lat)}
        <li class="opt">
          <button onmousedown={() => app.pickResult(r)}>
            <ListDot l={app.listOf(r.lists?.[0])} size={32} />
            <span class="r-text">
              <span class="r-name">{r.name}</span>
              <span class="r-meta">{[r.type, r.address].filter(Boolean).join(' · ')}</span>
            </span>
          </button>
        </li>
      {/each}
    {/if}
    {#if app.activeQuery.trim().length < 2 && app.recents.length}
      <li class="note recents-head"><span>{tx('resultats.recents')}</span>
        <button class="link" onmousedown={(e) => { e.preventDefault(); app.forgetRecents(); }}>{tx('resultats.effacer')}</button></li>
      {#each app.recents as r (r.id)}
        <li class="opt">
          <button onmousedown={() => app.pickResult(r)}>
            <span class="r-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
            </span>
            <span class="r-text">
              <span class="r-name">{r.name}</span>
              <span class="r-meta">{[r.type, r.address].filter(Boolean).join(' · ')}</span>
            </span>
          </button>
        </li>
      {/each}
    {/if}
    {#if brand}
      <li class="opt brand">
        <button onmousedown={(e) => { e.preventDefault(); app.showBrand(brand.name); }}>
          <span class="r-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 20 20" /></svg></span>
          <span class="r-text">
            <span class="r-name">{brand.name}</span>
            <span class="r-meta">{tx('resultats.afficher_les_lieux')}</span>
          </span>
        </button>
      </li>
    {/if}
    {#if app.catHit}
      <li class="opt">
        <button onmousedown={app.openCategoryFromSearch}>
          <span class="r-icon cat-icon" style:--fam={app.famColor(app.catHit)} aria-hidden="true"></span>
          <span class="r-text">
            {#if app.catHit.when || app.catHit.area}
              <span class="r-name">{app.catHit.label}{app.catHit.when ? ` ${app.whenText(app.catHit.when)}` : ''}</span>
              <span class="r-meta">{app.catHit.area ? app.areaText(app.catHit.area) : tx('resultats.pres_de_vous_2')}{app.catHit.when ? tx('resultats.selon_les_horaires_connus') : ''}</span>
            {:else}
              <span class="r-name">{tx('resultats.pres_de_vous', { label: app.catHit.label })}</span>
              <span class="r-meta">{tx('resultats.les_plus_proches_avec_leurs_horaires')}</span>
            {/if}
          </span>
        </button>
      </li>
    {/if}
    {#each app.results as r, i (r.id)}
      <li class="opt">
        <button class:active={i === app.active} onmousedown={() => app.pickResult(r)}>
          <span class="r-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          </span>
          <span class="r-text">
            <span class="r-name">{r.name}</span>
            <span class="r-meta">{[r.type, r.address].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
      </li>
    {/each}
    {#if app.activeQuery.trim().length >= 2 && !app.searching && !app.results.length && !app.searchError && !app.catHit}
      <li class="note">{tx('resultats.aucun_resultat_pour_essayez_un_nom', { recherche: app.activeQuery.trim() })}</li>
    {/if}
    {#if app.searchError}<li class="note">{app.searchError}</li>{/if}
    {#if app.searching && !app.results.length}<li class="note">{tx('resultats.recherche')}</li>{/if}
    {#if !app.editing && app.activeQuery.trim().length < 2}
      <li class="list-foot">
        <button class="link" onmousedown={(e) => { e.preventDefault(); app.importOpen = true; app.focused = false; document.activeElement?.blur(); }}>{tx('resultats.importer_vos_lieux_depuis_google')}</button>
        <button class="link" onmousedown={(e) => { e.preventDefault(); app.editChips = true; app.focused = false; document.activeElement?.blur(); }}>{tx('recherche.personnaliser_les_raccourcis')}</button>
      </li>
    {/if}
  </ul>


<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  svg .solid { fill: currentColor; stroke: none; }

  .results { grid-column: 1 / -1; list-style: none; margin: 0; padding: 6px 0 8px; border-top: 1px solid var(--line); max-height: 60vh; overflow-y: auto; }
  .results button {
    display: grid; grid-template-columns: 48px 1fr; align-items: center; width: 100%; text-align: left;
    border: 0; background: none; padding: 9px 16px 9px 0; cursor: pointer;
  }
  .results button:hover, .results button.active { background: var(--fill); }
  .r-icon { justify-self: center; width: 32px; height: 32px; border-radius: 50%; background: var(--fill); display: grid; place-items: center; color: var(--muted); }
  .r-icon svg { width: 18px; height: 18px; }
  .r-icon.cat-icon::after { content: ''; width: 12px; height: 12px; border-radius: 50%; background: var(--fam); }
  .me-icon { background: var(--me-bg); color: var(--accent); }
  .r-text { display: grid; gap: 1px; min-width: 0; }
  .r-name { font-size: 16px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .r-meta { font-size: 14px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .note { padding: 12px 16px 12px 48px; color: var(--muted); font-size: 15px; line-height: 1.4; }
  .map-hint { color: var(--accent); font-size: 14px; padding-top: 10px; padding-bottom: 6px; }

  .results .recents-head { display: flex; padding-right: 16px; justify-content: space-between; align-items: center; font-weight: 600; color: var(--ink) !important; }
  .results .link { width: auto; flex: none; display: inline; padding: 4px 0; }
  .link { border: 0; background: none; color: var(--accent); font: inherit; font-weight: 500; cursor: pointer; padding: 4px 0; }
  .results .list-foot .link { min-height: 40px; }
  .results .pinned-li { padding: 4px 14px 2px; }
  .list-foot { display: grid; justify-items: start; gap: 2px; padding: 10px 16px 6px 48px; border-top: 1px solid var(--line); margin-top: 6px; }
  .results .list-foot .link { font-size: 14.5px; }
</style>
