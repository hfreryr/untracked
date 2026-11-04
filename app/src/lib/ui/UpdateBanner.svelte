<!-- Nouvelle version en ligne (versioncheck.js) : à l'ouverture, l'app se recharge seule (porteur, 04/11) ; ensuite, un
     bandeau propose de recharger (choix du porteur, 22/10 : « bandeau », pas de rechargement silencieux qui couperait un
     guidage). L'app installée sur l'écran d'accueil de l'iPhone garde sinon
     l'ancienne version. SvelteKit lit notre propre fichier de version (_app/version.json) : aucun service tiers. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext, onMount } from 'svelte';
  import { updated } from '$app/state';
  import { version } from '$app/environment';
  import { latestVersion, isNewer, freshUrl, withoutV, reloadNow } from '#lib/versioncheck.js';

  const app = getContext('app');
  const t0 = Date.now();
  // version déjà demandée par un rechargement (?v=) : si la page reçue est encore l'ancienne, pas de second rechargement
  const tried = new URL(location.href).searchParams.get('v');
  let fresh = $state(null);            // version en ligne plus récente que celle-ci
  const busy = () => !!(app.place || app.nav || app.directions || app.category);
  const reload = (v) => location.replace(freshUrl(location.href, v || String(Date.now())));
  async function check() {
    const v = await latestVersion().catch(() => null);
    if (!isNewer(v, version)) return;
    // à l'ouverture, rien d'ouvert : on recharge sans rien demander ; sinon le bandeau (jamais pendant un guidage)
    if (v !== tried && reloadNow(Date.now() - t0, busy())) reload(v);
    else fresh = v;
  }
  onMount(() => {
    const clean = withoutV(location.href);
    if (clean) history.replaceState(history.state, '', clean);
    check();
    const onVis = () => { if (document.visibilityState === 'visible') check(); };   // retour dans l'app installée
    document.addEventListener('visibilitychange', onVis);
    const timer = setInterval(check, 600_000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(timer); };
  });
  // jamais pendant un guidage ni un itinéraire en cours : on attend la fin ; ni par-dessus un message passager (même place)
  const show = $derived((fresh || updated.current) && !app.nav && !app.directions && !app.toast);
</script>

{#if show}
  <div class="update" role="status">
    <span>{tx('maj.nouvelle_version')}</span>
    <button onclick={() => reload(fresh)}>{tx('maj.mettre_a_jour')}</button>
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
