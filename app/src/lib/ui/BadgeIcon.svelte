<!-- Pictos des badges (badges.js), dessinés pour l'app : pas d'émojis (rendu différent selon le téléphone). -->
<script>
  /** @type {{ id: string, size?: number, off?: boolean }} */
  let { id, size = 48, off = false } = $props();
  const STYLE = {
    gourmet: ['#fde4d6', '#b9502a'], explorateur: ['#dce7fb', '#2a5bd7'], quartier: ['#dcf1e3', '#2a7a4b'],
    culture: ['#ebe5fb', '#6a46c8'], cafe: ['#f2e6d8', '#87582a'], nuit: ['#e2e5f3', '#34437f']
  };
  const [bg, fg] = $derived(STYLE[id] || ['#eee', '#555']);
</script>

<svg class:off width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style:--bg={bg} style:--fg={fg}>
  <circle cx="24" cy="24" r="23" fill="var(--bg)" />
  <g fill="none" stroke="var(--fg)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    {#if id === 'gourmet'}
      <circle cx="24" cy="25" r="8.5" /><circle cx="24" cy="25" r="4.5" />
      <path d="M11 14v6.5a2.2 2.2 0 0 0 4.4 0V14M13.2 14v22" /><path d="M36.5 14c-2.6 1.6-3.2 5.4-3.2 9.5h3.2V36" />
    {:else if id === 'explorateur'}
      <circle cx="24" cy="24" r="12" /><path d="m28.8 19.2-3.2 6.4-6.4 3.2 3.2-6.4z" fill="var(--fg)" />
      <path d="M24 9.5v3M24 35.5v3M9.5 24h3M35.5 24h3" />
    {:else if id === 'quartier'}
      <path d="M9 36V24l7-6 7 6v12M23 36V20l8-6 8 6v16M7 36h34" /><path d="M14 36v-5h4v5M29 25h4M29 30h4" />
    {:else if id === 'culture'}
      <path d="M10 19 24 11l14 8zM11 36h26M10 39h28" /><path d="M14 22v11M21 22v11M27 22v11M34 22v11" />
    {:else if id === 'cafe'}
      <path d="M12 21h20v7a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" /><path d="M32 23.5h2.5a3.5 3.5 0 0 1 0 7H31" />
      <path d="M18 11c-1.5 2 1.5 3.5 0 5.5M24 10c-1.5 2 1.5 3.5 0 5.5" />
    {:else}
      <path d="M30.5 32.5A11 11 0 0 1 22 13a11 11 0 1 0 13.5 15.6 11 11 0 0 1-5 3.9z" />
      <path d="M32 12.5v4M30 14.5h4M37 19.5v2.6M35.7 20.8h2.6" />
    {/if}
  </g>
</svg>

<style>
  svg { display: block; flex: none; }
  .off { filter: grayscale(1); opacity: 0.55; }
</style>
