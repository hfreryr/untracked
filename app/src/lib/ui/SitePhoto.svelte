<!-- Photo publiée par le site du lieu (décision du porteur, 01/11/2026), quand Wikimedia n'en a pas.
     Chargée directement depuis le site du lieu, sans la copier : c'est ce qui rend l'affichage possible sans accord
     (docs/photos-lieux.md). Le site voit l'adresse IP et l'appareil, rien d'autre : expliqué dans « Qui voit quoi ».
     On s'annonce (referrer « untrackedmaps.app ») : un site qui réserve ses images à lui-même peut refuser, et on
     respecte ce refus (la photo disparaît). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  /** @type {{ src: string, site?: string | null, alt: string }} */
  let { src, site = null, alt } = $props();
  let failed = $state(false);
  let loaded = $state(false);
  const host = $derived(site ? (() => { try { return new URL(site.startsWith('http') ? site : `https://${site}`).hostname.replace(/^www\./, ''); } catch { return null; } })() : null);
</script>

{#if !failed}
  <figure class="site-photo" class:loaded>
    <img {src} {alt} referrerpolicy="origin" decoding="async" onload={() => (loaded = true)} onerror={() => (failed = true)} />
    {#if loaded}
      <figcaption>
        {#if site}<a href={site.startsWith('http') ? site : `https://${site}`} target="_blank" rel="noopener">{tx('fiche.photo_du_site', { site: host || site })}</a>
        {:else}{tx('fiche.photo_du_site_court')}{/if}
      </figcaption>
    {/if}
  </figure>
{/if}

<style>
  .site-photo { margin: 16px 0 0; }
  .site-photo img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 16px; background: var(--fill); }
  .site-photo:not(.loaded) img { min-height: 0; }
  figcaption { margin-top: 6px; font-size: 12.5px; color: var(--muted); }
  figcaption a { color: inherit; }
</style>
