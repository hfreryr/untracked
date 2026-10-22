<!-- Nouvelle version en ligne : un bandeau propose de recharger (choix du porteur, 22/10 : « bandeau », pas de
     rechargement silencieux qui couperait un guidage). L'app installée sur l'écran d'accueil de l'iPhone garde sinon
     l'ancienne version. SvelteKit lit notre propre fichier de version (_app/version.json) : aucun service tiers. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext, onMount } from 'svelte';
  import { updated } from '$app/state';

  const app = getContext('app');
  // à l'ouverture (SvelteKit revérifie aussi à chaque retour dans l'app, et toutes les 10 min)
  onMount(() => { updated.check().catch(() => {}); });
  // jamais pendant un guidage ni un itinéraire en cours : on attend la fin
  const show = $derived(updated.current && !app.nav && !app.directions);
</script>

{#if show}
  <div class="update" role="status">
    <span>{tx('maj.nouvelle_version')}</span>
    <button onclick={() => location.reload()}>{tx('maj.mettre_a_jour')}</button>
  </div>
{/if}

<style>
  .update {
    position: absolute; z-index: 6; left: 50%; transform: translateX(-50%); top: calc(78px + env(safe-area-inset-top));
    display: flex; align-items: center; gap: 12px; padding: 6px 6px 6px 16px; max-width: calc(100% - 24px); box-sizing: border-box;
    background: #1F2023; color: #fff; border-radius: 24px; box-shadow: var(--shadow-float); font-size: 14.5px; font-weight: 500; white-space: nowrap;
  }
  .update button { height: 36px; padding: 0 14px; border: 0; border-radius: 18px; background: var(--accent-btn); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  @media (min-width: 768px) { .update { top: 16px; } }
</style>
