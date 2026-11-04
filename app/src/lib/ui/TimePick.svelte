<!-- Heure d'ouverture ou de fermeture (porteur, 04/11/2026 : « aucun restaurant ne ferme à 16 h 08 ») : deux roues, l'heure
     et les minutes par quart d'heure. La roue de l'iPhone (input type="time") ignore le pas de 15 min (WebKit, bogue
     215090) : deux listes déroulantes, qui ouvrent elles aussi une roue sur téléphone. Une heure déjà dans OSM qui ne tombe
     pas sur un quart d'heure (12:10) reste proposée. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  /** @type {{ value: string, label: string, onpick?: () => void }} */
  let { value = $bindable('09:00'), label, onpick = () => {} } = $props();
  const pad = (n) => String(n).padStart(2, '0');
  const HOURS = Array.from({ length: 25 }, (_, h) => pad(h));          // 24 : fermeture à minuit (« 24:00 » dans OSM)
  const h = $derived((value || '09:00').slice(0, 2));
  const m = $derived((value || '09:00').slice(3, 5));
  const MINUTES = $derived([...new Set(['00', '15', '30', '45', m])].sort());
  const set = (hh, mm) => { value = hh === '24' ? '24:00' : `${hh}:${mm}`; onpick(); };
</script>

<span class="tp" role="group" aria-label={label}>
  <select value={h} onchange={(e) => set(e.currentTarget.value, m)} aria-label={tx('horaires_edit.heure_de', { quoi: label })}>
    {#each HOURS as x}<option value={x}>{x}</option>{/each}
  </select><span aria-hidden="true">:</span><select value={m} onchange={(e) => set(h, e.currentTarget.value)} disabled={h === '24'} aria-label={tx('horaires_edit.minutes_de', { quoi: label })}>
    {#each MINUTES as x}<option value={x}>{x}</option>{/each}
  </select>
</span>

<style>
  .tp { display: inline-flex; align-items: center; gap: 1px; background: var(--fill); border-radius: 9px; padding: 0 4px; font-variant-numeric: tabular-nums; }
  select { appearance: none; -webkit-appearance: none; border: 0; background: none; font: inherit; font-size: 15px; color: var(--ink); padding: 6px 3px; cursor: pointer; text-align: center; }
  select:disabled { opacity: 0.6; }
</style>
