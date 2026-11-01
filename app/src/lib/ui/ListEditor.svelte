<!-- « Modifier » une liste (maquette validée par le porteur, 02/11/2026) : nom modifié sur place, pictogrammes sur
     deux lignes de cinq dessinés dans la couleur de la liste, couleurs sur une ligne ; « Terminé » en bouton.
     La suppression de la liste est en bas, après les lieux (CategorySheet.svelte). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { GLYPHS } from '#lib/mapstyle.js';
  import { LIST_ICONS, LIST_COLORS } from '#lib/myplaces.js';
  import ListDot from './ListDot.svelte';
  /** @type {{ l: any }} */
  let { l } = $props();
  const app = getContext('app');
  let name = $state(l.name);
  const save = () => app.renameList(l, name);
</script>

<div class="ed-top">
  <button class="ed-back" onclick={() => { save(); app.listEditing = false; app.savedList = null; app.refreshSaved(); }}>{tx('liste.mes_lieux')}</button>
  <button class="done" onclick={() => { save(); app.listEditing = false; }}>{tx('enregistrer.termine')}</button>
</div>
<div class="ed-title">
  <ListDot l={l} size={52} />
  <label class="name">
    <input bind:value={name} maxlength="40" aria-label={tx('meslieux.nouveau_nom_de_la_liste')} onblur={save}
      onkeydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
  </label>
</div>
<div class="ed" role="group" aria-label={tx('liste.apparence_de_la_liste')}>
  <div class="grid5">
    {#each LIST_ICONS as ic}
      <button class="ic" class:on={l.icon === ic} style:--c={l.color} aria-pressed={l.icon === ic} aria-label={tx('liste.pictogramme', { nom: LIST_ICONS.indexOf(ic) + 1 })}
        onclick={() => app.setListStyle(l, { icon: ic })}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d={GLYPHS[ic] || GLYPHS.dot} /></svg>
      </button>
    {/each}
  </div>
  <div class="cols">
    {#each LIST_COLORS as col}
      <button class="sw" class:on={l.color === col} style:--c={col} aria-pressed={l.color === col} aria-label={tx('liste.couleur')}
        onclick={() => app.setListStyle(l, { color: col })}>
        {#if l.color === col}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9" /></svg>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .ed-top { display: flex; justify-content: space-between; align-items: center; margin: 2px 44px 12px 0; }
  .ed-back { border: 0; background: none; padding: 8px 0; color: var(--accent); font: inherit; font-size: 15px; cursor: pointer; }
  .done { border: 0; border-radius: 999px; background: var(--accent-btn); color: #fff; font: inherit; font-weight: 650; font-size: 15px; padding: 8px 18px; cursor: pointer; }
  .ed-title { display: flex; gap: 14px; align-items: center; }
  .name { flex: 1; display: flex; align-items: center; gap: 8px; background: var(--fill); border-radius: 12px; padding: 0 12px; min-width: 0; }
  .name input { flex: 1; min-width: 0; border: 0; background: none; font: inherit; font-size: 20px; font-weight: 700; color: var(--ink); padding: 10px 0; outline: none; }
  .name svg { width: 18px; height: 18px; flex: none; fill: none; stroke: var(--muted); stroke-width: 2; }
  .name:focus-within { box-shadow: 0 0 0 2px var(--accent); }
  .ed { display: grid; gap: 16px; margin: 18px 0 6px; }
  .grid5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; justify-items: center; }
  .ic { width: 46px; height: 46px; border-radius: 50%; border: 0; background: var(--fill); display: grid; place-items: center; cursor: pointer; padding: 0; }
  .ic svg { width: 24px; height: 24px; fill: var(--c); }
  .ic.on { background: var(--c); box-shadow: 0 0 0 3px var(--card), 0 0 0 5px var(--c); }
  .ic.on svg { fill: #fff; }
  .cols { display: flex; justify-content: space-between; }
  .sw { position: relative; width: 30px; height: 30px; border-radius: 50%; border: 0; background: var(--c); display: grid; place-items: center; cursor: pointer; padding: 0; }
  .sw::after { content: ''; position: absolute; inset: -7px; }   /* zone de toucher de 44 px */
  .sw.on { box-shadow: 0 0 0 3px var(--card), 0 0 0 5px var(--ink); }
  .sw svg { width: 16px; height: 16px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
</style>
