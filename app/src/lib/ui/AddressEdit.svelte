<!-- Adresse d'un lieu dans « Corriger » (maquette du 04/11/2026) : numéro et rue ; code postal et ville non modifiables
     (une erreur de ville ne vient presque jamais du lieu). Lien vers une note si c'est la position qui est fausse. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  /** @type {{ num: string, street: string, onenter: () => void, onmisplaced: () => void }} */
  let { num = $bindable(''), street = $bindable(''), onenter, onmisplaced } = $props();
  const key = (e) => { if (e.key === 'Enter') onenter(); };
</script>

<div class="addr">
  <input class="edit n" bind:value={num} aria-label={tx('corriger.numero')} placeholder={tx('corriger.numero')} inputmode="text" autocapitalize="off" onkeydown={key} />
  <!-- svelte-ignore a11y_autofocus -->
  <input class="edit" bind:value={street} autofocus aria-label={tx('corriger.rue')} placeholder={tx('corriger.rue')} autocapitalize="words" onkeydown={key} />
</div>
<p class="hint">{tx('corriger.mal_place')} <button class="lnk" onclick={onmisplaced}>{tx('corriger.signalez_le')}</button></p>

<style>
  .addr { display: flex; gap: 8px; width: 100%; }
  .addr .n { width: 84px; flex: none; }
  .edit { width: 100%; min-width: 0; font: inherit; font-size: 16px; color: var(--ink); background: var(--fill); border: 0; border-radius: 12px; padding: 11px 12px; box-shadow: 0 0 0 2px var(--accent); outline: none; }
  .hint { width: 100%; font-size: 13.5px; color: var(--muted); margin: 6px 2px 0; }
  .lnk { border: 0; background: none; color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; padding: 4px 0; }
</style>
