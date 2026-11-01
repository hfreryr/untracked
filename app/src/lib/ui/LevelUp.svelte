<!-- Nouveau niveau ou nouveau badge : annoncé une fois, juste après l'avis qui le donne (porteur, 31/10/2026 : passé
     Passeur sans le savoir). Jamais à l'ouverture d'une autre fiche (retour du 01/11 : pop-up surgi sur un lieu sans
     rapport) ; ce qui a été obtenu autrement (avis d'avant cette annonce) est signalé par « Nouveau » dans Mes lieux. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { DOTS, markAnnounced } from '#lib/contrib.js';
  import { BADGES, markBadges } from '#lib/badges.js';
  import { ALL_CATEGORIES } from '#lib/categories.js';
  import Dialog from './Dialog.svelte';
  import BadgeIcon from './BadgeIcon.svelte';
  import { badgeName, badgeThanks } from '#lib/badgetext.js';
  /** @type {{ earned: { level: any, badges: string[] }, mine: any[], onclose: () => void }} */
  let { earned, mine, onclose } = $props();
  const app = getContext('app');
  const NAME = { eclaireur: () => tx('contrib.eclaireur'), passeur: () => tx('contrib.passeur'), vigie: () => tx('contrib.vigie'), phare: () => tx('contrib.phare') };
  const badge = $derived(earned.level ? null : earned.badges[0]);
  function close() { markAnnounced(mine.length); markBadges(mine); onclose(); }
  function openContrib() {
    close();
    app.closePlace?.();
    const saved = ALL_CATEGORIES.find((c) => c.key === 'saved');
    if (app.category?.key !== 'saved') app.pickCategory(saved);
    app.hubPanel = 'contrib';
  }
</script>

{#if earned.level}
  <Dialog title={tx('contrib.nouveau_niveau', { niveau: NAME[earned.level.id]() })} onclose={close}>
    <div class="dot" style:--c={DOTS[earned.level.id]} aria-hidden="true"></div>
    <p>{tx('contrib.merci_n_avis', { n: mine.length })}</p>
    <p>{tx('contrib.couleur_debloquee')}</p>
    <button class="go" onclick={openContrib}>{tx('contrib.choisir_ma_couleur')}</button>
    <button class="later" onclick={close}>{tx('contrib.plus_tard')}</button>
  </Dialog>
{:else if badge}
  <Dialog title={tx('badges.obtenu', { nom: badgeName(badge) })} onclose={close}>
    <div class="icon" aria-hidden="true"><BadgeIcon id={badge} size={64} /></div>
    <p>{badgeThanks(badge, BADGES.find((b) => b.id === badge).goal)}</p>
    <button class="go" onclick={openContrib}>{tx('badges.voir_mes_badges')}</button>
    <button class="later" onclick={close}>{tx('contrib.plus_tard')}</button>
  </Dialog>
{/if}

<style>
  .dot { width: 44px; height: 44px; margin: 6px auto 14px; border-radius: 50%; background: var(--c); border: 5px solid #fff;
    box-shadow: 0 0 0 10px color-mix(in srgb, var(--c) 18%, transparent), 0 2px 6px rgb(0 0 0 / 0.3); }
  .icon { display: grid; place-items: center; margin: 4px 0 10px; }
  p { margin: 0 0 8px; font-size: 15px; line-height: 1.4; }
  .go { width: 100%; height: 46px; border: 0; border-radius: 14px; background: var(--accent-btn); color: #fff; font: inherit; font-weight: 650; cursor: pointer; margin-top: 8px;
    display: grid; place-items: center; text-align: center; }   /* centré aussi sur iPhone (capture du 01/11) */
  .later { width: 100%; height: 44px; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; margin-top: 4px; text-align: center; }
</style>
