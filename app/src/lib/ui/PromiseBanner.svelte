<!-- Promesse et sa preuve, à la toute première ouverture seulement (puis plus jamais : elle reste dans le bouton ⓘ).
     Décision du porteur, 16/10 : la ligne « 0 traceur · 0 cookie » sous la recherche disparaît, elle est ici. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { installWay, onInstallChange } from '#lib/install.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  function more() { app.closePromise(); app.aboutOpen = true; }
  // « c'est seulement sur internet ? » (porteur, 28/10) : dès la première ouverture, on propose d'installer l'app
  let way = $state(installWay());
  $effect(() => onInstallChange(() => (way = installWay())));
  function install() { app.closePromise(); app.startInstall?.(); }
</script>


  {#if app.showPromise && !app.place && !app.category && !app.directions && !app.importOpen && !app.editChips}
    <div class="promise" class:above-install={!!way} role="note">
      <p class="title">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
        {tx('promesse.une_carte_qui_ne_vous_piste_pas')}
      </p>
      <p>{tx('promesse.ni_compte_ni_publicite_rien_sur_vous')}</p>
      <ul class="proof">
        <li>{tx('promesse.zero_traceur')}</li><li>{tx('promesse.zero_cookie')}</li><li>{tx('promesse.code_ouvert')}</li>
      </ul>
      {#if way}
        <div class="row two">
          <button class="later" onclick={app.closePromise}>{tx('installer.plus_tard')}</button>
          <button class="ok" onclick={install}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" /></svg>{tx('installer.installer_app')}
          </button>
        </div>
      {:else}
        <div class="row">
          <span class="hint">{tx('promesse.pour_en_savoir_plus')}
            <button class="info" onclick={more} aria-label={tx('apropos.bouton')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".9" class="solid" /></svg>
            </button>
          </span>
          <button class="ok" onclick={app.closePromise}>{tx('promesse.compris')}</button>
        </div>
      {/if}
    </div>
  {/if}

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  svg .solid { fill: currentColor; stroke: none; }
  /* au-dessus des trois boutons ronds de la carte : rien n'est caché dessous (règle 10) */
  .promise {
    position: absolute; z-index: 4; left: 12px; right: 12px; bottom: calc(196px + env(safe-area-inset-bottom)); max-width: 420px; box-sizing: border-box;
    padding: 16px; background: var(--card); border-radius: 20px; box-shadow: var(--shadow-float); font-size: 15px; line-height: 1.4;
  }
  p { margin: 0; }
  .title { display: flex; gap: 10px; align-items: center; font-weight: 700; font-size: 16.5px; margin-bottom: 6px; }
  .title svg { width: 24px; height: 24px; color: var(--accent); flex: none; }
  .proof { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 10px 0 12px; padding: 0; }
  .proof li { font-size: 13px; font-weight: 600; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--card)); border-radius: 12px; padding: 5px 10px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .hint { display: inline-flex; align-items: center; gap: 2px; font-size: 13.5px; color: var(--muted); }
  .info { position: relative; width: 32px; height: 32px; border: 0; background: none; color: var(--accent); display: grid; place-items: center; cursor: pointer; padding: 0; }
  .info::after { content: ''; position: absolute; inset: -6px; }
  .info svg { width: 22px; height: 22px; }
  .row.two { gap: 10px; }
  .row.two button { flex: 1; min-height: 44px; border-radius: 22px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
  .row.two svg { width: 19px; height: 19px; }
  .later { border: 0; background: var(--fill); color: var(--accent); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
  .ok { border: 0; background: var(--accent-btn); color: #fff; font: inherit; font-size: 15px; font-weight: 600; border-radius: 20px; min-height: 40px; padding: 0 20px; cursor: pointer; }
  /* un bouton rond de plus (Installer) dans la pile de droite : le bandeau monte d'autant */
  .promise.above-install { bottom: calc(254px + env(safe-area-inset-bottom)); }
  @media (min-width: 768px) { .promise, .promise.above-install { left: auto; right: 76px; bottom: 16px; width: 380px; } }
</style>
