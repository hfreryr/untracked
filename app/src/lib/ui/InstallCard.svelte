<!-- Rappel d'installation (install.js) : une carte après un signe d'usage (lieu, raccourci, catégories, import,
     guidage, 3e jour), et la fenêtre des gestes sur iPhone (ouverte aussi depuis le bandeau d'accueil, le bouton rond et ⓘ). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import { canOffer, installWay, isStandalone, laterTapped, onInstallChange, promptInstall, readDismissed, isEngaged, noteDay, readSigns } from '#lib/install.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  let way = $state(installWay());
  let closed = $state(false);          // fermée pour cette fois (« Plus tard » ou « Installer »)
  noteDay();
  let signs = $state(readSigns());
  $effect(() => onInstallChange(() => { way = installWay(); signs = readSigns(); }));
  const engaged = $derived(isEngaged({ saved: app.favorites.length, shortcuts: (app.shortcuts.home ? 1 : 0) + (app.shortcuts.work ? 1 : 0) + app.customs.length, signs }));
  const show = $derived(!closed && !!way && canOffer({ standalone: isStandalone(), saved: engaged, dismissed: readDismissed(), now: Date.now(), installable: !!way })
    && !app.place && !app.category && !app.directions && !app.nav && !app.showPromise && !app.importOpen && !app.editChips && !app.aboutOpen && !app.focused);

  // « Installer » : la fenêtre du téléphone (Android), sinon les deux gestes (iPhone)
  app.startInstall = async () => {
    closed = true;
    if (installWay() === 'prompt') { if (await promptInstall()) app.say(tx('installer.merci')); }
    else app.installSteps = installWay();       // la fenêtre adaptée au navigateur
  };
</script>

{#if show}
  <div class="install" role="note">
    <div class="t">
      <img src="icon-192.png" alt="" width="44" height="44" />
      <div><p class="h">{tx('installer.titre')}</p><p>{tx('installer.pourquoi')}</p></div>
    </div>
    <div class="row">
      <button class="later" onclick={() => { laterTapped(); closed = true; }}>{tx('installer.plus_tard')}</button>
      <button class="go" onclick={app.startInstall}>{tx('installer.installer')}</button>
    </div>
  </div>
{/if}

{#if app.installSteps}
  {@const w = app.installSteps}
  {@const ios = w === 'ios' || w === 'ios-other'}
  <Dialog title={w === 'firefox' ? tx('installer.firefox_titre') : ios ? tx('installer.iphone_titre') : tx('installer.installer_app')} onclose={() => (app.installSteps = false)}>
    {#if ios}
      <p class="sub">{tx('installer.iphone_sous_titre')}</p>
      <!-- relevé sur l'iPhone du porteur (iOS, 21/10) : Partager, puis « En voir plus », puis « Sur l'écran d'accueil » ;
           autres navigateurs de l'iPhone : Partager est parfois dans leur menu, et « En voir plus » n'existe pas -->
      <ol class="steps">
        <li><span class="n" aria-hidden="true">1</span><span>{tx('installer.etape_1')}
          <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 15V4M8.5 7.5 12 4l3.5 3.5" /><path d="M8 10.5H6.5v9.5h11v-9.5H16" /></svg></span>
          <strong>{tx('installer.partager')}</strong> <small>{w === 'ios' ? tx('installer.etape_1_suite') : tx('installer.etape_1_autres')}</small></span></li>
        {#if w === 'ios'}
          <li><span class="n" aria-hidden="true">2</span><span>{tx('installer.etape_2')}
            <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></span>
            <strong>{tx('installer.en_voir_plus')}</strong></span></li>
        {/if}
        <li><span class="n" aria-hidden="true">{w === 'ios' ? 3 : 2}</span><span>{tx('installer.etape_3')}
          <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></svg></span>
          <strong>{tx('installer.sur_ecran_accueil')}</strong>{tx('installer.etape_3_suite')} <strong>{tx('installer.ajouter')}</strong></span></li>
      </ol>
      {#if app.favorites.length}<p class="note">{tx('installer.iphone_lieux')}</p>{/if}
    {:else if w === 'firefox'}
      <!-- Firefox Android ne prévient pas le site qu'il sait installer : son menu, puis « Installer » (ou l'ancien nom) -->
      <p class="sub">{tx('installer.firefox_sous_titre')}</p>
      <ol class="steps">
        <li><span class="n" aria-hidden="true">1</span><span>{tx('installer.etape_1')}
          <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="18.5" r="1.2" /></svg></span>
          <strong>{tx('installer.le_menu')}</strong></span></li>
        <li><span class="n" aria-hidden="true">2</span><span>{tx('installer.etape_1')}
          <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" /></svg></span>
          <strong>{tx('installer.installer')}</strong> <small>{tx('installer.firefox_autre_nom')}</small></span></li>
      </ol>
    {:else}
      <!-- DuckDuckGo sur Android, Brave sur iPhone : pas d'installation possible ici (docs/installation-navigateurs.md) -->
      <p class="msg">{w === 'ios-brave' ? tx('installer.ouvrir_dans_safari') : tx('installer.ouvrir_dans_autre')}</p>
      <button class="copy" onclick={async () => { try { await navigator.clipboard.writeText(location.origin + '/'); app.say(tx('installer.lien_copie')); } catch { /* refusé */ } }}>{tx('installer.copier_le_lien')}</button>
    {/if}
  </Dialog>
{/if}

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  /* au-dessus des trois boutons ronds de la carte, comme le bandeau de la première ouverture (rien n'est caché dessous) */
  .install {
    position: absolute; z-index: 4; left: 12px; right: 12px; bottom: calc(196px + env(safe-area-inset-bottom)); max-width: 420px; box-sizing: border-box;
    padding: 16px; background: var(--card); border-radius: 20px; box-shadow: var(--shadow-float);
  }
  .t { display: flex; gap: 12px; align-items: center; }
  .t img { border-radius: 11px; border: 1px solid var(--line); flex: none; }
  p { margin: 0; font-size: 14px; line-height: 1.35; color: var(--ink); }
  .h { font-size: 16px; font-weight: 700; margin-bottom: 3px; }
  .row { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 12px; }
  .later { border: 0; background: none; color: var(--accent); font: inherit; font-size: 15px; font-weight: 600; min-height: 40px; padding: 0 10px; cursor: pointer; }
  .go { border: 0; background: var(--accent-btn); color: #fff; font: inherit; font-size: 15px; font-weight: 600; border-radius: 20px; min-height: 40px; padding: 0 20px; cursor: pointer; }
  .sub { color: var(--muted); margin-bottom: 8px; }
  .msg { font-size: 15.5px; line-height: 1.45; }
  .copy { display: block; width: 100%; margin-top: 16px; min-height: 48px; border: 0; border-radius: 14px; background: var(--accent-btn); color: #fff; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }
  .steps { list-style: none; margin: 0; padding: 0; }
  .steps small { display: block; color: var(--muted); font-size: 13px; }
  .steps li { display: flex; gap: 14px; align-items: center; padding: 12px 0; border-top: 1px solid var(--line); font-size: 15.5px; line-height: 1.4; }
  .n { width: 28px; height: 28px; border-radius: 50%; flex: none; display: grid; place-items: center; font-weight: 700; font-size: 14px;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--card)); }
  .ic { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: var(--fill); color: var(--accent); vertical-align: middle; margin: 0 3px; }
  .ic svg { width: 18px; height: 18px; }
  .note { margin-top: 12px !important; padding: 10px 12px; border-radius: 12px; font-size: 13.5px; background: color-mix(in srgb, #E0862F 14%, var(--card)); }
  @media (min-width: 768px) { .install { left: auto; right: 76px; bottom: 16px; width: 380px; } }
</style>
