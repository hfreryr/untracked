<!-- Listes de « Mes lieux » (porteur, 02/11/2026) : Favoris en tête, les autres par dernière utilisation (listorder.js) ;
     glisser une liste vers la gauche découvre la corbeille, la tirer jusqu'au bout la supprime, après confirmation
     (swiperow.js, ConfirmDeleteList.svelte). Favoris ne se supprime pas. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { sortLists, usedLabel } from '#lib/listorder.js';
  import { swipeRow } from '#lib/swiperow.js';
  import ListDot from './ListDot.svelte';
  import ConfirmDeleteList from './ConfirmDeleteList.svelte';
  const app = getContext('app');
  let open = $state(null);        // liste dont la corbeille est découverte
  let asking = $state(null);      // liste dont on demande confirmation de la suppression
  const count = (l) => app.favorites.filter((f) => f.lists.includes(l.id)).length;
</script>

{#each sortLists(app.lists) as l (l.id)}
  {@const used = usedLabel(l)}
  <li class="swipe-row" use:swipeRow={{ enabled: l.id !== 'fav', open: open === l.id, onOpen: (v) => (open = v ? l.id : null), onDelete: () => { open = null; asking = l; } }}>
    {#if l.id !== 'fav'}
      <button class="swipe-act" onclick={() => { open = null; asking = l; }} aria-label={tx('liste.supprimer_la_liste_q', { name: l.name })} tabindex={open === l.id ? 0 : -1}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M10.5 10.5v6M13.5 10.5v6" /></svg>
      </button>
    {/if}
    <button class="swipe-content" onclick={() => { if (open) { open = null; return; } app.openSavedList(l.id); }}>
      <ListDot l={l} size={34} />
      <span class="pl-name">{l.name}{#if used}<small>{used}</small>{/if}</span>
      <span class="pl-count">{count(l)}</span>
      <svg class="chev-r" viewBox="0 0 24 24" aria-hidden="true"><path d="m10 7 5 5-5 5" /></svg>
    </button>
  </li>
{/each}
{#if asking}<ConfirmDeleteList l={asking} n={count(asking)} onconfirm={() => app.deleteList(asking)} onclose={() => (asking = null)} />{/if}

<style>
  .swipe-row { position: relative; overflow: hidden; }
  .swipe-content { position: relative; z-index: 1; display: grid; grid-template-columns: 34px 1fr auto auto; gap: 12px; align-items: center; width: 100%;
    min-height: 52px; border: 0; background: var(--card); padding: 6px 0; text-align: left; cursor: pointer; border-bottom: 1px solid var(--line);
    font: inherit; font-size: 16px; color: var(--ink); }
  .pl-name { display: grid; min-width: 0; }
  .pl-name small { color: var(--muted); font-size: 13px; margin-top: 1px; }
  .pl-count { color: var(--muted); font-size: 14px; font-variant-numeric: tabular-nums; }
  .chev-r { width: 18px; height: 18px; color: var(--faint); fill: none; stroke: currentColor; stroke-width: 2; }
  /* corbeille derrière la ligne : sa largeur suit le doigt ; tirée assez loin, elle s'élargit (on peut lâcher) */
  .swipe-act { position: absolute; top: 0; bottom: 1px; right: 0; width: max(var(--dx, 0px), 84px); border: 0; padding: 0 30px;
    background: var(--closed); color: #fff; display: flex; align-items: center; justify-content: flex-end; cursor: pointer; }
  .swipe-act svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; flex: none; transition: transform 0.15s; }
  :global(.swipe-row.far) .swipe-act svg { transform: scale(1.15); }
</style>
