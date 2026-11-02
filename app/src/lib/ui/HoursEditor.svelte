<!-- « Ajouter » ou « Corriger les horaires » d'un lieu, envoyés à OpenStreetMap avec le compte de la personne (maquette
     validée par le porteur le 02/11/2026) : saisie jour par jour, aperçu en clair, confirmation (rappel : ce qu'on voit
     sur place, rien de recopié d'une autre carte), puis merci. Texte OSM produit et vérifié par hoursedit.js ; connexion
     osmauth.js ; envoi osmedit.js ; la modification compte dans « Mes contributions » (osmcontrib.js). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import Dialog from './Dialog.svelte';
  import { hoursEdit, closeHoursEdit } from '#lib/hourseditstate.svelte.js';
  import { parseHours, formatHours, previewHours, checkWeek, emptyWeek } from '#lib/hoursedit.js';
  import { osmServer, osmAccount, osmLogin, osmLogout } from '#lib/osmauth.js';
  import { sendTags } from '#lib/osmedit.js';
  import { recordEdit } from '#lib/osmcontrib.js';
  const app = getContext('app');
  const NAMES = () => [tx('horaires_edit.lun'), tx('horaires_edit.mar'), tx('horaires_edit.mer'), tx('horaires_edit.jeu'), tx('horaires_edit.ven'), tx('horaires_edit.sam'), tx('horaires_edit.dim')];
  let week = $state(parseHours(hoursEdit.oh) || emptyWeek());
  let error = $state('');
  let account = $state(osmAccount());
  let changeset = $state(null);
  const preview = $derived(previewHours(week));
  const place = hoursEdit.place;

  function toggleDay(i) { week.days[i] = week.days[i].length ? [] : [['09:00', '19:00']]; week.allDay = false; error = ''; }
  function addBreak(i) { const [a, b] = week.days[i][0]; week.days[i] = [[a, '12:00'], ['14:00', b]]; }
  function dropBreak(i) { const d = week.days[i]; week.days[i] = [[d[0][0], d[d.length - 1][1]]]; }
  function copyMonday() { for (let i = 1; i <= 4; i++) week.days[i] = week.days[0].map((s) => [...s]); }
  function next() { error = checkWeek(week) || ''; if (!error) hoursEdit.step = 'confirm'; }
  async function send() {
    const s = osmServer();
    if (!account) { await osmLogin({ place, oh: formatHours(week) }); return; }
    hoursEdit.step = 'sending'; error = '';
    try {
      const today = new Date().toISOString().slice(0, 10);
      const r = await sendTags(place, { opening_hours: formatHours(week), 'check_date:opening_hours': today },
        tx('horaires_edit.commentaire', { nom: place.name }), { api: s.api, token: account.token });
      changeset = `${s.web}/changeset/${r.changeset}`;
      recordEdit({ name: place.name, kind: 'horaires', changeset: r.changeset, server: s.web });
      hoursEdit.step = 'done';
    } catch (e) {
      if (e.code === 'acces') { osmLogout(); account = null; }
      error = e.code === 'conflit' ? tx('horaires_edit.conflit') : e.code === 'acces' ? tx('horaires_edit.reconnecter') : tx('horaires_edit.envoi_impossible');
      hoursEdit.step = 'confirm';
    }
  }
</script>

<Dialog title={hoursEdit.step === 'done' ? tx('horaires_edit.merci') : hoursEdit.step === 'edit' ? tx('horaires_edit.titre', { nom: place.name }) : tx('horaires_edit.envoyer_titre')}
  sub={hoursEdit.step === 'edit' ? tx('horaires_edit.sous_titre') : hoursEdit.step === 'done' ? '' : tx('horaires_edit.osm_explication')} onclose={closeHoursEdit}>
  {#if hoursEdit.step === 'edit'}
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
      <button class="chip" class:on={week.allDay} aria-pressed={week.allDay} onclick={() => { week.allDay = !week.allDay; error = ''; }}>{tx('horaires_edit.ouvert_24_24_court')}</button>
    </div>
    <div class="prev"><small>{tx('horaires_edit.apercu')}</small>{preview}</div>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    <button class="go" onclick={next}>{tx('horaires_edit.continuer')}</button>
  {:else if hoursEdit.step === 'confirm' || hoursEdit.step === 'sending'}
    <div class="prev"><small>{tx('horaires_edit.horaires_de', { nom: place.name })}</small>{preview}</div>
    {#if account}
      <div class="acct"><span class="av" aria-hidden="true">{(account.name || '?').slice(0, 1).toUpperCase()}</span>
        <span>{tx('horaires_edit.avec_votre_compte')}<b>{account.name}</b></span>
        <button class="lnk out" onclick={() => { osmLogout(); account = null; }}>{tx('horaires_edit.se_deconnecter')}</button></div>
    {/if}
    <p class="note">{tx('horaires_edit.rappel_sur_place')}</p>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    <button class="go" onclick={send} disabled={hoursEdit.step === 'sending'}>{hoursEdit.step === 'sending' ? tx('horaires_edit.envoi') : account ? tx('horaires_edit.envoyer') : tx('horaires_edit.se_connecter')}</button>
    <button class="sec" onclick={() => (hoursEdit.step = 'edit')}>{tx('horaires_edit.modifier')}</button>
  {:else}
    <div class="ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></div>
    <p class="center">{tx('horaires_edit.merci_detail', { nom: place.name })}</p>
    <p class="note">{tx('horaires_edit.visible_quand')}</p>
    <p class="note">{tx('horaires_edit.compte_dans_contributions')}</p>
    {#if changeset}<a class="sec" href={changeset} target="_blank" rel="noopener">{tx('horaires_edit.voir_modification')}</a>{/if}
    <button class="go" onclick={closeHoursEdit}>{tx('enregistrer.termine')}</button>
  {/if}
</Dialog>

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
  .prev { background: var(--fill); border-radius: 14px; padding: 12px 14px; margin: 12px 0; font-size: 15px; line-height: 1.45; }
  .prev small { display: block; color: var(--muted); font-size: 12.5px; margin-bottom: 2px; }
  .acct { display: grid; grid-template-columns: 34px 1fr auto; gap: 10px; align-items: center; background: var(--fill); border-radius: 14px; padding: 10px 12px; font-size: 14.5px; }
  .acct b { display: block; }
  .av { width: 34px; height: 34px; border-radius: 50%; background: #3f7d32; color: #fff; display: grid; place-items: center; font-weight: 700; }
  .out { font-size: 13px; }
  .note { font-size: 13.5px; color: var(--muted); line-height: 1.4; margin: 10px 2px; }
  .err { color: var(--closed); font-size: 14px; margin: 8px 2px; }
  .go { display: block; width: 100%; height: 48px; border: 0; border-radius: 14px; background: var(--accent-btn); color: #fff; font: inherit; font-weight: 650; font-size: 16px; cursor: pointer; margin-top: 8px; }
  .go:disabled { opacity: 0.6; }
  .sec { display: block; width: 100%; text-align: center; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 600; padding: 12px; cursor: pointer; text-decoration: none; }
  .ok { width: 64px; height: 64px; border-radius: 50%; background: #1e8e3e; display: grid; place-items: center; margin: 8px auto 12px; }
  .ok svg { width: 34px; height: 34px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .center { text-align: center; font-size: 15.5px; margin: 0 0 6px; }
</style>
