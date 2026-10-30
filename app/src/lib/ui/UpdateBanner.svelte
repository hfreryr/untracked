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
  // jamais pendant un guidage ni un itinéraire en cours : on attend la fin ; ni par-dessus un message passager (même place)
  const show = $derived(updated.current && !app.nav && !app.directions && !app.toast);
</script>

{#if show}
  <div class="update" role="status">
    <span>{tx('maj.nouvelle_version')}</span>
    <button onclick={() => location.reload()}>{tx('maj.mettre_a_jour')}</button>
  </div>
{/if}

<style>
  /* En bas, comme les autres messages de l'app : en haut, il cachait les catégories sous la barre de recherche
     (capture du porteur, 30/10/2026), et le bouton débordait de l'écran quand le texte du téléphone est agrandi. */
  .update {
    position: absolute; z-index: 6; left: 12px; right: 72px; bottom: calc(52px + env(safe-area-inset-bottom)); max-width: 380px;
    display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; box-sizing: border-box;
    background: #1F2023; color: #fff; border-radius: 22px; box-shadow: var(--shadow-float); font-size: 14.5px; font-weight: 500;
  }
  .update span { flex: 1; min-width: 0; line-height: 1.25; }
  .update button { flex: none; min-height: 36px; padding: 0 14px; border: 0; border-radius: 18px; background: var(--accent-btn); color: #fff; font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
</style>
