<!-- Saisie des horaires jour par jour (HoursEditor.svelte, PlaceEditor.svelte) : toucher un jour l'ouvre ou le ferme,
     toucher une heure ouvre la roue du téléphone ; « + pause », « Lundi → mardi à vendredi », « Ouvert 24 h/24 ». -->
<script>
  import { tx } from '#lib/i18n/index.js';
  /** @type {{ week: any, onchange?: () => void }} */
  let { week = $bindable(), onchange = () => {} } = $props();
  const NAMES = () => [tx('horaires_edit.lun'), tx('horaires_edit.mar'), tx('horaires_edit.mer'), tx('horaires_edit.jeu'), tx('horaires_edit.ven'), tx('horaires_edit.sam'), tx('horaires_edit.dim')];
  function toggleDay(i) { week.days[i] = week.days[i].length ? [] : [['09:00', '19:00']]; week.allDay = false; onchange(); }
  function addBreak(i) { const [a, b] = week.days[i][0]; week.days[i] = [[a, '12:00'], ['14:00', b]]; }
  function dropBreak(i) { const d = week.days[i]; week.days[i] = [[d[0][0], d[d.length - 1][1]]]; }
  function copyMonday() { for (let i = 1; i <= 4; i++) week.days[i] = week.days[0].map((s) => [...s]); }
</script>

<ul class="days">
  {#each week.days as d, i}
    <li>
      <button class="d" class:on={d.length || week.allDay} aria-pressed={!!d.length} onclick={() => toggleDay(i)} aria-label={tx('horaires_edit.ouvrir_fermer', { jour: NAMES()[i] })}>{NAMES()[i].slice(0, 1)}</button>
      {#if week.allDay}<span class="closed">{tx('horaires_edit.ouvert_24_24')}</span>
      {:else if !d.length}<span class="closed">{tx('horaires_edit.ferme_maj')}</span>
      {:else}
        <span class="slots">
          {#each d as s, k}
            <span class="slot">
              <input type="time" bind:value={s[0]} aria-label={tx('horaires_edit.ouverture', { jour: NAMES()[i] })} />
              <span aria-hidden="true">–</span>
              <input type="time" bind:value={s[1]} aria-label={tx('horaires_edit.fermeture', { jour: NAMES()[i] })} />
            </span>
          {/each}
          {#if d.length === 1}<button class="lnk" onclick={() => addBreak(i)}>{tx('horaires_edit.plus_pause')}</button>
          {:else}<button class="lnk" onclick={() => dropBreak(i)}>{tx('horaires_edit.sans_pause')}</button>{/if}
        </span>
      {/if}
    </li>
  {/each}
</ul>
<div class="tools">
  <button class="chip" onclick={copyMonday} disabled={!week.days[0].length || week.allDay}>{tx('horaires_edit.copier_lundi')}</button>
  <button class="chip" class:on={week.allDay} aria-pressed={week.allDay} onclick={() => { week.allDay = !week.allDay; onchange(); }}>{tx('horaires_edit.ouvert_24_24_court')}</button>
</div>

<style>
  .days { list-style: none; margin: 0; padding: 0; }
  .days li { display: grid; grid-template-columns: 44px 1fr; gap: 10px; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--line); min-height: 50px; }
  .d { width: 40px; height: 34px; border-radius: 10px; border: 0; background: var(--fill); color: var(--ink); font: inherit; font-weight: 650; cursor: pointer; }
  .d.on { background: var(--accent-btn); color: #fff; }
  .slots { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .slot { display: inline-flex; align-items: center; gap: 4px; }
  .slot input { font: inherit; font-size: 15px; color: var(--ink); background: var(--fill); border: 0; border-radius: 9px; padding: 6px 8px; font-variant-numeric: tabular-nums; min-width: 0; width: 6.2em; }
  /* téléphone : on touche l'heure pour ouvrir la roue ; la petite horloge ne sert qu'à la souris */
  @media (pointer: coarse) { .slot input::-webkit-calendar-picker-indicator { display: none; } }
  .closed { color: var(--muted); font-size: 15px; }
  .lnk { border: 0; background: none; color: var(--accent); font: inherit; font-size: 14px; cursor: pointer; padding: 6px 2px; }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
  .chip { border: 1px solid var(--line); background: none; color: var(--ink); border-radius: 999px; padding: 8px 12px; font: inherit; font-size: 14px; cursor: pointer; }
  .chip.on { background: var(--accent-btn); border-color: var(--accent-btn); color: #fff; }
  .chip:disabled { opacity: 0.45; }
</style>
