<!-- Pastille d'info trafic posée sur le numéro d'une ligne (orange : perturbé, rouge : interrompu), comme Citymapper. -->
<script>
  /** @type {{ level: 'red'|'orange' }} */
  let { level } = $props();
</script>

<span class="pip {level}" aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M5 2.2v3.4" /><circle cx="5" cy="7.6" r=".2" /></svg></span>

<style>
  .pip { position: absolute; top: -7px; right: -9px; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--card); display: grid; place-items: center; }
  .pip.orange { background: #d97000; }
  .pip.red { background: #c5221f; }
  svg { width: 9px; height: 9px; fill: none; stroke: #fff; stroke-width: 1.8; stroke-linecap: round; }
</style>
