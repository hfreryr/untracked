<!-- Nouveau niveau de contribution : annoncé une fois, avec ce qu'il débloque (porteur, 31/10/2026 : passé Passeur sans
     le savoir, ni que la flèche de guidage se choisit). Montré à l'ouverture d'une fiche et juste après un avis. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { ARROWS, levelToAnnounce, markAnnounced } from '#lib/contrib.js';
  import { ALL_CATEGORIES } from '#lib/categories.js';
  import Dialog from './Dialog.svelte';
  /** @type {{ count: number }} */
  let { count } = $props();
  const app = getContext('app');
  const NAME = { eclaireur: () => tx('contrib.eclaireur'), passeur: () => tx('contrib.passeur'), vigie: () => tx('contrib.vigie'), phare: () => tx('contrib.phare') };
  const level = $derived(levelToAnnounce(count));
  let closed = $state(false);
  function close() { markAnnounced(count); closed = true; }
  function chooseArrow() {
    close();
    app.closePlace?.();
    const saved = ALL_CATEGORIES.find((c) => c.key === 'saved');
    if (app.category?.key !== 'saved') app.pickCategory(saved);
    app.hubPanel = 'contrib';
  }
</script>

{#if level && !closed}
  <Dialog title={tx('contrib.nouveau_niveau', { niveau: NAME[level.id]() })} onclose={close}>
    <div class="arrow" style:--c={ARROWS[level.id]} aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M12 3 20 20l-8-4.5L4 20z" /></svg>
    </div>
    <p>{tx('contrib.merci_n_avis', { n: count })}</p>
    <p>{tx('contrib.fleche_debloquee')}</p>
    <button class="go" onclick={chooseArrow}>{tx('contrib.choisir_ma_fleche')}</button>
    <button class="later" onclick={close}>{tx('contrib.plus_tard')}</button>
  </Dialog>
{/if}

<style>
  .arrow { display: grid; place-items: center; margin: 4px 0 10px; }
  .arrow svg { width: 56px; height: 56px; fill: var(--c); stroke: #fff; stroke-width: 1.2; stroke-linejoin: round; }
  p { margin: 0 0 8px; font-size: 15px; line-height: 1.4; }
  .go { width: 100%; height: 46px; border: 0; border-radius: 14px; background: var(--accent-btn); color: #fff; font: inherit; font-weight: 650; cursor: pointer; margin-top: 8px; }
  .later { width: 100%; height: 44px; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; margin-top: 4px; }
</style>
