<!-- Confirmation avant de supprimer une liste entière (porteur, 02/11/2026) : ses lieux qui ne sont dans aucune autre
     liste sont retirés de Mes lieux. Un lieu seul, lui, est retiré sans confirmation (« Annuler » dans le message). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import Dialog from './Dialog.svelte';
  /** @type {{ l: { name: string }, n: number, onconfirm: () => void, onclose: () => void }} */
  let { l, n, onconfirm, onclose } = $props();
</script>

<Dialog title={tx('liste.supprimer_la_liste_q', { name: l.name })} onclose={onclose}>
  <p>{n ? tx('liste.supprimer_la_liste_detail', { n }) : tx('liste.supprimer_la_liste_vide')}</p>
  <button class="del" onclick={() => { onconfirm(); onclose(); }}>{tx('liste.supprimer')}</button>
  <button class="keep" onclick={onclose}>{tx('resultats.annuler')}</button>
</Dialog>

<style>
  p { margin: 0 0 10px; font-size: 15px; line-height: 1.4; color: var(--muted); }
  .del { width: 100%; height: 46px; border: 0; border-radius: 14px; background: var(--closed); color: #fff; font: inherit; font-weight: 650; cursor: pointer; margin-top: 8px; }
  .keep { width: 100%; height: 44px; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; margin-top: 4px; }
</style>
