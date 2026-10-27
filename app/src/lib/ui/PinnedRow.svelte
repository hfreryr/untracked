<!-- Rangée des raccourcis (recherche et accueil) : Maison, Travail, raccourcis personnels, puis « + Nouveau ».
     Toucher : itinéraire (ou demande de l'adresse si elle manque). Appui long : modifier, changer l'adresse, supprimer
     (maquette du 27/10/2026). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { SHORTCUT_ICONS } from '#lib/shortcuticons.js';
  import { longpress, pressed } from '#lib/longpress.js';
  import { popover } from '#lib/popover.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  let { inSearch } = $props();
  let menu = $state(null);            // { key, el } : raccourci dont le menu est ouvert
  // dans la recherche, le bouton ne prend pas le focus (le champ reste actif et la liste ne se ferme pas)
  const keep = (e) => { if (inSearch) e.preventDefault(); };
  const isFixed = (k) => k === 'home' || k === 'work';
  function act(fn) { const k = menu.key; menu = null; fn(k); }
  function removeFixed(k) {
    const old = app.shortcuts[k];
    app.setShortcut(k, null);
    app.say(tx('fiche.retire', { nom: app.SHORT_NAMES[k] }), { label: tx('resultats.annuler'), run: () => app.setShortcut(k, old) });
  }
</script>

<div class="pinned" role="list">
  {#each ['home', 'work'] as k}
    <div role="listitem">
      <button class="pin-btn" class:unset={!app.shortcuts[k]} data-sc={k} onmousedown={keep}
        use:longpress={() => { if (app.shortcuts[k]) menu = { key: k, el: document.querySelector(`[data-sc="${k}"]`) }; }}
        onclick={(e) => { if (!pressed(e)) app.useShortcut(k); }}>
        <span class="pin-circle">{#if k === 'home'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5M6.5 10v9.5h11V10" /><path d="M10.2 19.5v-4.8h3.6v4.8" /></svg>{:else}<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7.5" width="17" height="12" rx="2.5" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" /></svg>{/if}</span>
        <span class="pin-name">{app.SHORT_NAMES[k]}</span>
        <span class="pin-sub">{app.shortcuts[k] ? tx('fiche.itineraire') : tx('resultats.ajouter')}</span>
      </button>
    </div>
  {/each}
  {#each app.customs as c (c.id)}
    <div role="listitem">
      <button class="pin-btn" class:unset={!c.place} data-sc={c.id} onmousedown={keep} use:longpress={() => (menu = { key: c.id, el: document.querySelector(`[data-sc="${c.id}"]`) })}
        onclick={(e) => { if (!pressed(e)) app.useCustom(c.id); }}>
        <span class="pin-circle"><svg viewBox="0 0 24 24" aria-hidden="true">{@html SHORTCUT_ICONS[c.icon]}</svg></span>
        <span class="pin-name">{c.name}</span>
        <span class="pin-sub">{c.place ? tx('fiche.itineraire') : tx('resultats.ajouter')}</span>
      </button>
    </div>
  {/each}
  <div role="listitem">
    <button class="pin-btn add" onmousedown={keep} onclick={() => app.openShortcutDlg()}>
      <span class="pin-circle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg></span>
      <span class="pin-name">{tx('raccourcis.nouveau_court')}</span>
    </button>
  </div>
</div>

{#if menu}
  <div class="sc-menu" role="menu" aria-label={app.shortcutName(menu.key)} use:popover={{ trigger: () => menu?.el, close: () => (menu = null), place: 'below', align: 'start' }}>
    {#if !isFixed(menu.key)}
      <button role="menuitem" onmousedown={keep} onclick={() => act((k) => app.openShortcutDlg({ id: k }))}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>{tx('raccourcis.nom_et_icone')}
      </button>
    {/if}
    <button role="menuitem" onmousedown={keep} onclick={() => act((k) => app.askAddress(k))}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>{tx('raccourcis.changer_adresse')}
    </button>
    <button role="menuitem" class="danger" onmousedown={keep} onclick={() => act((k) => (isFixed(k) ? removeFixed(k) : app.deleteCustom(k)))}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" /></svg>{tx('raccourcis.supprimer')}
    </button>
  </div>
{/if}

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  /* ——— Raccourcis ——— */
  .pinned { display: flex; gap: 14px; overflow-x: auto; padding: 8px 2px 6px; scrollbar-width: none; }
  .pinned::-webkit-scrollbar { display: none; }
  .pin-btn { display: grid; justify-items: center; align-content: start; gap: 3px; width: 64px; flex: none;
    padding: 0; border: 0; background: none; cursor: pointer; grid-template-columns: none;
    -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
  .pin-circle { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--accent-btn); color: #fff; }
  .pin-circle svg { width: 22px; height: 22px; }
  .pin-btn.unset .pin-circle { background: var(--fill); color: var(--accent); }
  .pin-btn.add .pin-circle { background: none; border: 1.5px dashed var(--faint); color: var(--accent); }
  .pin-btn.add .pin-name { color: var(--accent); }
  .pin-name { font-size: 12.5px; font-weight: 600; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); }
  .pin-sub { font-size: 11.5px; color: var(--muted); }
  .pin-btn.unset .pin-sub { color: var(--accent); }
  .sc-menu { min-width: 220px; background: var(--card); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow-float); z-index: 60; }
  .sc-menu button { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 0 16px; border: 0; border-top: 1px solid var(--line);
    background: none; font: inherit; font-size: 15.5px; color: var(--ink); text-align: left; cursor: pointer; }
  .sc-menu button:first-child { border-top: 0; }
  .sc-menu svg { width: 19px; height: 19px; flex: none; }
  .sc-menu .danger { color: var(--closed); }
</style>
