<!-- Saisie des horaires jour par jour (HoursEditor.svelte, PlaceEditor.svelte) : toucher un jour l'ouvre ou le ferme,
     toucher une heure ouvre la roue du téléphone (TimePick : heures, puis minutes par quart d'heure) ; « + pause »,
     « Lundi → mardi à vendredi », « Ouvert 24 h/24 ». Un jour qu'on ouvre reprend les horaires du jour ouvert précédent
     (porteur, 04/11/2026 : tout saisir jour par jour était fastidieux) ; « Copier sur les jours ouverts » sous le dernier jour modifié. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import TimePick from './TimePick.svelte';
  /** @type {{ week: any, onchange?: () => void }} */
  let { week = $bindable(), onchange = () => {} } = $props();
  const NAMES = () => [tx('horaires_edit.lun'), tx('horaires_edit.mar'), tx('horaires_edit.mer'), tx('horaires_edit.jeu'), tx('horaires_edit.ven'), tx('horaires_edit.sam'), tx('horaires_edit.dim')];
  // un jour ouvert reprend les horaires du jour ouvert le plus proche avant lui (sinon après), sinon 9 h–19 h
  function model(i) {
    for (const k of [...Array(7).keys()].map((x) => (i - 1 - x + 14) % 7)) if (k !== i && week.days[k].length) return week.days[k];
    return [['09:00', '19:00']];
  }
  function toggleDay(i) { week.days[i] = week.days[i].length ? [] : model(i).map((s) => [...s]); week.allDay = false; last = week.days[i].length ? i : null; onchange(); }
  let last = $state(null);     // dernier jour modifié : c'est lui qu'on propose de copier
  let copied = $state(null);   // jour dont les horaires viennent d'être copiés (message bref)
  function copyToAll(i) {
    for (let k = 0; k < 7; k++) if (k !== i && week.days[k].length) week.days[k] = week.days[i].map((s) => [...s]);
    copied = i; setTimeout(() => (copied = null), 1800); onchange();
  }
  function addBreak(i) { last = i; const [a, b] = week.days[i][0]; week.days[i] = [[a, '12:00'], ['14:00', b]]; }
  function dropBreak(i) { last = i; const d = week.days[i]; week.days[i] = [[d[0][0], d[d.length - 1][1]]]; }
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
              <TimePick bind:value={s[0]} label={tx('horaires_edit.ouverture', { jour: NAMES()[i] })} onpick={() => (last = i)} />
              <span aria-hidden="true">–</span>
              <TimePick bind:value={s[1]} label={tx('horaires_edit.fermeture', { jour: NAMES()[i] })} onpick={() => (last = i)} />
            </span>
          {/each}
          {#if d.length === 1}<button class="lnk" onclick={() => addBreak(i)}>{tx('horaires_edit.plus_pause')}</button>
          {:else}<button class="lnk" onclick={() => dropBreak(i)}>{tx('horaires_edit.sans_pause')}</button>{/if}
          {#if last === i && week.days.filter((x) => x.length).length > 1}<button class="lnk" onclick={() => copyToAll(i)}>{copied === i ? tx('horaires_edit.copie_faite') : tx('horaires_edit.copier_partout')}</button>{/if}
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
  .closed { color: var(--muted); font-size: 15px; }
  .lnk { border: 0; background: none; color: var(--accent); font: inherit; font-size: 14px; cursor: pointer; padding: 6px 2px; }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
  .chip { border: 1px solid var(--line); background: none; color: var(--ink); border-radius: 999px; padding: 8px 12px; font: inherit; font-size: 14px; cursor: pointer; }
  .chip.on { background: var(--accent-btn); border-color: var(--accent-btn); color: #fff; }
  .chip:disabled { opacity: 0.45; }
</style>
