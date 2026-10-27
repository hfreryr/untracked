<!-- Icône d'info trafic : sens interdit (station non desservie) ou triangle (autre perturbation). Dessin maison. -->
<script>
  /** @type {{ skip?: boolean }} */
  let { skip = false } = $props();
</script>

<svg class="ti" viewBox="0 0 16 16" aria-hidden="true">
  {#if skip}
    <circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M4.5 8h7" stroke="var(--card)" stroke-width="2" stroke-linecap="round" />
  {:else}
    <path d="M8 1.6 15 14H1z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
    <path d="M8 6v3.4" stroke="var(--card)" stroke-width="1.8" stroke-linecap="round" /><circle cx="8" cy="11.7" r="1" fill="var(--card)" />
  {/if}
</svg>

<style>
  .ti { flex: none; width: 16px; height: 16px; margin-top: 1px; }
</style>
