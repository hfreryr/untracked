<!-- « Corriger » un lieu (maquette « mélangée » validée par le porteur le 02/11/2026) : la page ressemble à la fiche, un
     crayon par ligne ; toucher un crayon n'ouvre que cette ligne ; les lignes corrigées sont marquées, puis un seul envoi
     à OpenStreetMap avec le compte de la personne (osmauth.js, osmedit.js), après confirmation (ancien → nouveau).
     Fermeture, travaux, autre chose : un message (note) aux bénévoles d'OSM, qui vérifient avant de changer la carte.
     Champs et étiquettes : placefields.js. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import Dialog from './Dialog.svelte';
  import WeekEditor from './WeekEditor.svelte';
  import AddressEdit from './AddressEdit.svelte';
  import { placeEdit, closePlaceEdit } from '#lib/placeeditstate.svelte.js';
  import { FIELDS, current, cleanValue, shown, tagsFor, noteText } from '#lib/placefields.js';
  import { parseHours, formatHours, checkWeek, emptyWeek } from '#lib/hoursedit.js';
  import { osmServer, osmAccount, osmLogin, osmLogout } from '#lib/osmauth.js';
  import { sendTags, sendNote } from '#lib/osmedit.js';
  import { recordEdit } from '#lib/osmcontrib.js';
  import { refOf } from '#lib/pendingedits.js';
  import { isOnSite } from '#lib/points.js';
  import RewardGain from './RewardGain.svelte';
  import { refreshInfo } from '#lib/placeflow.js';
  const app = getContext('app');
  const LABEL = { name: () => tx('corriger.nom'), address: () => tx('corriger.adresse'), website: () => tx('corriger.site'), phone: () => tx('corriger.telephone'),
    opening_hours: () => tx('corriger.horaires'), outdoor_seating: () => tx('corriger.terrasse'), wheelchair: () => tx('corriger.fauteuil') };
  const place = placeEdit.place;
  const tags = $derived(app.info?.tags || {});
  let editing = $state(null);          // champ ouvert
  let draft = $state('');
  let num = $state(''), street = $state('');   // adresse ouverte (AddressEdit)
  let week = $state(emptyWeek());
  let error = $state('');
  let account = $state(osmAccount());
  let link = $state(null);
  let noteKind = $state(null), noteDetail = $state('');
  const n = $derived(Object.keys(placeEdit.changes).length);
  // horaires détaillés (saisons…) : pas réécrits par l'app, pour ne rien perdre
  // adresse : seulement si le lieu porte la sienne (sinon c'est celle de l'immeuble ou de la recherche : on la signale)
  const editable = (f) => f.kind === 'address' ? !!tags['addr:street'] : f.kind !== 'hours' || !current(f, tags).value || !!parseHours(current(f, tags).value);

  function open(f) {
    error = ''; editing = f.key;
    const v = placeEdit.changes[f.key] ?? current(f, tags).value;
    draft = f.kind === 'url' ? shown(f, v) === tx('corriger.non_renseigne') ? '' : v : v;
    if (f.kind === 'hours') week = parseHours(v) || emptyWeek();
    if (f.kind === 'address') [num = '', street = ''] = (v || '|').split('|');
  }
  function ok(f) {
    const raw = f.kind === 'hours' ? (checkWeek(week) ? null : formatHours(week)) : f.kind === 'address' ? `${num}|${street}` : draft;
    if (raw == null) { error = checkWeek(week); return; }
    const r = cleanValue(f, raw);
    if (r.error) { error = r.error; return; }
    if (r.value === current(f, tags).value) delete placeEdit.changes[f.key];
    else placeEdit.changes[f.key] = r.value;
    editing = null; error = '';
  }
  async function send() {
    const s = osmServer();
    if (!account) { await osmLogin({ place, changes: { ...placeEdit.changes } }); return; }
    placeEdit.step = 'sending'; error = '';
    try {
      const names = Object.keys(placeEdit.changes).map((k) => LABEL[k]().toLowerCase()).join(', ');
      const sent = tagsFor(placeEdit.changes, tags);
      const r = await sendTags(place, sent, tx('corriger.commentaire', { nom: place.name, champs: names }), { api: s.api, token: account.token });
      link = `${s.web}/changeset/${r.changeset}`;
      recordEdit({ name: place.name, kind: 'corrections', changeset: r.changeset, server: s.web, ref: refOf(place), tags: sent, near: isOnSite(app.me, place) });
      refreshInfo(app, place);
      placeEdit.step = 'done';
    } catch (e) {
      if (e.code === 'acces') { osmLogout(); account = null; }
      error = e.code === 'conflit' ? tx('horaires_edit.conflit') : e.code === 'acces' ? tx('horaires_edit.reconnecter') : tx('horaires_edit.envoi_impossible');
      placeEdit.step = 'confirm';
    }
  }
  const toNote = (kind) => { noteKind = kind; noteDetail = ''; editing = null; error = ''; placeEdit.step = 'note'; };
  async function note() {
    const s = osmServer();
    placeEdit.step = 'sending'; error = '';
    try {
      const r = await sendNote(place, noteText(noteKind, place.name, noteDetail), { api: s.api });
      link = r.id ? `${s.web}/note/${r.id}` : null;
      recordEdit({ name: place.name, kind: 'signalement', note: r.id || null, server: s.web, ref: refOf(place), near: isOnSite(app.me, place) });
      placeEdit.step = 'notedone';
    } catch { error = tx('horaires_edit.envoi_impossible'); placeEdit.step = 'note'; }
  }
  const title = $derived({ list: tx('corriger.titre', { nom: place.name }), confirm: tx('horaires_edit.envoyer_titre'), sending: tx('horaires_edit.envoyer_titre'),
    done: tx('horaires_edit.merci'), closed: tx('corriger.que_se_passe'), note: tx('corriger.note_titre'), notedone: tx('horaires_edit.merci') }[placeEdit.step]);
</script>

<Dialog {title} sub={placeEdit.step === 'list' ? tx('corriger.sous_titre') : placeEdit.step === 'confirm' ? tx('horaires_edit.osm_explication') : placeEdit.step === 'closed' ? place.name : ''} onclose={closePlaceEdit}>
  {#if placeEdit.step === 'list'}
    <ul class="fields">
      {#each FIELDS as f (f.key)}
        {@const cur = current(f, tags)}
        {@const changed = f.key in placeEdit.changes}
        <li>
          {#if editing === f.key}
            <div class="lab">{LABEL[f.key]()}</div>
            {#if f.kind === 'hours'}<WeekEditor bind:week onchange={() => (error = '')} />
            {:else if f.kind === 'address'}<AddressEdit bind:num bind:street onenter={() => ok(f)} onmisplaced={() => toNote('position')} />
            {:else if f.kind === 'choice'}
              <div class="chips" role="radiogroup" aria-label={LABEL[f.key]()}>
                {#each f.options as o}<button class="chip" class:on={draft === o} role="radio" aria-checked={draft === o} onclick={() => (draft = o)}>{shown(f, o)}</button>{/each}
              </div>
            {:else}
              <!-- svelte-ignore a11y_autofocus -->
              <input class="edit" bind:value={draft} autofocus aria-label={LABEL[f.key]()} inputmode={f.kind === 'tel' ? 'tel' : f.kind === 'url' ? 'url' : 'text'}
                type={f.kind === 'tel' ? 'tel' : 'text'} autocapitalize={f.kind === 'text' ? 'sentences' : 'off'} onkeydown={(e) => { if (e.key === 'Enter') ok(f); }} />
            {/if}
            {#if error}<p class="err" role="alert">{error}</p>{/if}
            <div class="mini"><button class="lnk strong" onclick={() => ok(f)}>{tx('corriger.ok')}</button><button class="lnk muted" onclick={() => { editing = null; error = ''; }}>{tx('corriger.annuler')}</button></div>
          {:else}
            <div class="val">
              <span class="lab">{LABEL[f.key]()}{#if changed}<span class="done">● {tx('corriger.corrige')}</span>{/if}</span>
              <span class="txt">{f.kind === 'address' && !cur.value ? app.address || shown(f, '') : shown(f, placeEdit.changes[f.key] ?? cur.value)}</span>
              {#if changed && cur.value}<s class="old">{shown(f, cur.value)}</s>{/if}
              {#if f.kind === 'address' && !cur.value}<span class="hint">{tx('corriger.adresse_immeuble')} <button class="lnk inline" onclick={() => toNote('adresse')}>{tx('corriger.signalez_la')}</button></span>{/if}
            </div>
            {#if editable(f)}<button class="pen" onclick={() => open(f)} aria-label={tx('corriger.modifier_x', { champ: LABEL[f.key]() })} disabled={!!editing}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg></button>{/if}
          {/if}
        </li>
      {/each}
    </ul>
    <button class="sec" onclick={() => (placeEdit.step = 'closed')}>{tx('corriger.ferme_ou_nom')}</button>
    {#if n && !editing}<button class="go sticky" onclick={() => (placeEdit.step = 'confirm')}>{tx('corriger.envoyer_n', { n })}</button>{/if}
  {:else if placeEdit.step === 'confirm' || (placeEdit.step === 'sending' && !noteKind)}
    <ul class="chg">
      {#each Object.entries(placeEdit.changes) as [k, v]}
        {@const f = FIELDS.find((x) => x.key === k)}
        <li><small>{LABEL[k]()}</small>{#if current(f, tags).value}<s>{shown(f, current(f, tags).value)}</s>{' → '}{/if}{shown(f, v)}</li>
      {/each}
    </ul>
    {#if account}
      <div class="acct"><span class="av" aria-hidden="true">{(account.name || '?').slice(0, 1).toUpperCase()}</span>
        <span>{tx('horaires_edit.avec_votre_compte')}<b>{account.name}</b></span>
        <button class="lnk small" onclick={() => { osmLogout(); account = null; }}>{tx('horaires_edit.se_deconnecter')}</button></div>
    {/if}
    <p class="note">{tx('horaires_edit.rappel_sur_place')}</p>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    <button class="go" onclick={send} disabled={placeEdit.step === 'sending'}>{placeEdit.step === 'sending' ? tx('horaires_edit.envoi') : account ? tx('horaires_edit.envoyer') : tx('horaires_edit.se_connecter')}</button>
    <button class="sec" onclick={() => (placeEdit.step = 'list')}>{tx('horaires_edit.modifier')}</button>
  {:else if placeEdit.step === 'closed'}
    <ul class="pick">
      <li><button onclick={() => { noteKind = 'ferme'; placeEdit.step = 'note'; }}><b>{tx('corriger.choix_ferme')}</b><small>{tx('corriger.choix_ferme_detail')}</small></button></li>
      <li><button onclick={() => { placeEdit.step = 'list'; open(FIELDS[0]); }}><b>{tx('corriger.choix_nom')}</b></button></li>
      <li><button onclick={() => { noteKind = 'travaux'; placeEdit.step = 'note'; }}><b>{tx('corriger.choix_travaux')}</b></button></li>
      <li><button onclick={() => toNote('position')}><b>{tx('corriger.choix_position')}</b><small>{tx('corriger.choix_autre_detail')}</small></button></li>
      <li><button onclick={() => { noteKind = 'autre'; placeEdit.step = 'note'; }}><b>{tx('corriger.choix_autre')}</b><small>{tx('corriger.choix_autre_detail')}</small></button></li>
    </ul>
  {:else if placeEdit.step === 'note' || placeEdit.step === 'sending'}
    <p class="note">{tx('corriger.note_aide')}</p>
    <textarea class="edit area" bind:value={noteDetail} rows="4" maxlength="1000" placeholder={tx('corriger.note_placeholder')} aria-label={tx('corriger.note_placeholder')}></textarea>
    <p class="note">{tx('horaires_edit.rappel_sur_place')}</p>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    <button class="go" onclick={note} disabled={placeEdit.step === 'sending' || ((noteKind === 'autre' || noteKind === 'adresse') && noteDetail.trim().length < 10)}>{placeEdit.step === 'sending' ? tx('horaires_edit.envoi') : tx('corriger.note_envoyer')}</button>
    <button class="sec" onclick={() => (placeEdit.step = noteKind === 'adresse' ? 'list' : 'closed')}>{tx('corriger.annuler')}</button>
  {:else}
    <div class="ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></div>
    <RewardGain />
    <p class="center">{placeEdit.step === 'notedone' ? tx('corriger.note_merci') : tx('corriger.merci_detail', { n, nom: place.name })}</p>
    {#if link}<a class="sec" href={link} target="_blank" rel="noopener">{tx('horaires_edit.voir_modification')}</a>{/if}
    <button class="go" onclick={closePlaceEdit}>{tx('enregistrer.termine')}</button>
  {/if}
</Dialog>

<style>
  .fields { list-style: none; margin: 0; padding: 0; }
  .fields li { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .val { flex: 1; min-width: 0; display: grid; }
  .lab { font-size: 13px; color: var(--muted); margin-bottom: 2px; width: 100%; }
  .val .lab { width: auto; }
  .txt { font-size: 15.5px; overflow-wrap: anywhere; }
  .old { color: var(--muted); font-size: 13px; }
  .done { color: var(--open); font-weight: 600; font-size: 12px; margin-left: 6px; }
  .pen { flex: none; width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--fill); color: var(--accent); display: grid; place-items: center; cursor: pointer; position: relative; }
  .pen::after { content: ''; position: absolute; inset: -3px; }
  .pen:disabled { opacity: 0.4; }
  .pen svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .edit { width: 100%; font: inherit; font-size: 16px; color: var(--ink); background: var(--fill); border: 0; border-radius: 12px; padding: 11px 12px; box-shadow: 0 0 0 2px var(--accent); outline: none; }
  .area { resize: vertical; min-height: 96px; }
  .mini { display: flex; gap: 16px; width: 100%; }
  .lnk { border: 0; background: none; color: var(--accent); font: inherit; font-size: 15px; cursor: pointer; padding: 8px 0; }
  .lnk.strong { font-weight: 650; } .lnk.muted { color: var(--muted); } .lnk.small { font-size: 13px; }
  .chips { display: flex; gap: 8px; }
  .chip { border: 1px solid var(--line); background: none; color: var(--ink); border-radius: 999px; padding: 8px 14px; font: inherit; font-size: 15px; cursor: pointer; }
  .chip.on { background: var(--accent-btn); border-color: var(--accent-btn); color: #fff; }
  .chg, .pick { list-style: none; margin: 4px 0 10px; padding: 4px 14px; background: var(--fill); border-radius: 14px; }
  .chg li { padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 15px; overflow-wrap: anywhere; }
  .chg li:last-child, .pick li:last-child button { border-bottom: 0; }
  .chg small, .pick small { display: block; color: var(--muted); font-size: 12.5px; font-weight: 400; }
  .chg s { color: var(--muted); }
  .pick { padding: 0 14px; }
  .pick button { display: block; width: 100%; text-align: left; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--ink); font: inherit; font-size: 15.5px; padding: 13px 0; cursor: pointer; }
  .pick b { font-weight: 600; }
  .acct { display: grid; grid-template-columns: 34px 1fr auto; gap: 10px; align-items: center; background: var(--fill); border-radius: 14px; padding: 10px 12px; font-size: 14.5px; }
  .acct b { display: block; }
  .av { width: 34px; height: 34px; border-radius: 50%; background: #3f7d32; color: #fff; display: grid; place-items: center; font-weight: 700; }
  .note { font-size: 13.5px; color: var(--muted); line-height: 1.4; margin: 10px 2px; }
  .hint { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; }
  .lnk.inline { padding: 2px 0; font-size: 13px; font-weight: 600; }
  .err { color: var(--closed); font-size: 14px; margin: 6px 2px; width: 100%; }
  .go { display: block; width: 100%; height: 48px; border: 0; border-radius: 14px; background: var(--accent-btn); color: #fff; font: inherit; font-weight: 650; font-size: 16px; cursor: pointer; margin-top: 8px; }
  .go:disabled { opacity: 0.6; }
  .go.sticky { position: sticky; bottom: 8px; box-shadow: 0 4px 16px rgb(0 0 0 / 0.25); }
  .sec { display: block; width: 100%; text-align: center; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 600; padding: 12px; cursor: pointer; text-decoration: none; }
  .ok { width: 64px; height: 64px; border-radius: 50%; background: #1e8e3e; display: grid; place-items: center; margin: 8px auto 12px; }
  .ok svg { width: 34px; height: 34px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .center { text-align: center; font-size: 15.5px; margin: 0 0 6px; }
</style>
