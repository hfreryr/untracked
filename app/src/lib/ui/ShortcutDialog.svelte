<!-- Fenêtre d'un raccourci personnel (maquette du 27/10/2026) : le nom et l'icône d'abord, l'adresse ensuite.
     Trois cas : « + Nouveau » (pas d'adresse : on la demande juste après), depuis la fiche d'un lieu (adresse
     connue), ou modification (appui long sur un raccourci). Icônes : shortcuticons.js, une par grande famille. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { SHORTCUT_ICONS, ICON_IDS } from '#lib/shortcuticons.js';
  import { NAME_MAX } from '#lib/customshortcuts.js';
  import Dialog from './Dialog.svelte';
  const app = getContext('app');
  const d = app.shortcutDlg;
  let name = $state(d.name);
  let icon = $state(d.icon);
  // pas de nom sous les icônes (choix du porteur, 27/10) : le nom de chaque icône sert aux lecteurs d'écran
  const LABELS = {
    sport: tx('raccourcis.icone_sport'), nature: tx('raccourcis.icone_nature'), loisirs: tx('raccourcis.icone_loisirs'),
    proches: tx('raccourcis.icone_proches'), etudes: tx('raccourcis.icone_etudes'), courses: tx('raccourcis.icone_courses'),
    manger: tx('raccourcis.icone_manger'), sante: tx('raccourcis.icone_sante'), transport: tx('raccourcis.icone_transport'),
    voyage: tx('raccourcis.icone_voyage'), demarches: tx('raccourcis.icone_demarches'), autre: tx('raccourcis.icone_autre')
  };
  const title = d.id ? tx('raccourcis.modifier') : d.place ? tx('raccourcis.ajouter_aux') : tx('raccourcis.nouveau');
  const action = d.id ? tx('raccourcis.enregistrer') : d.place ? tx('raccourcis.ajouter') : tx('raccourcis.choisir_adresse');
  const close = () => (app.shortcutDlg = null);
  function submit(e) {
    e.preventDefault();
    if (name.trim()) app.saveShortcutDlg(name, icon);
  }
</script>

<Dialog {title} onclose={close}>
  <form class="sc" onsubmit={submit}>
    {#if d.place && !d.id}
      <p class="addr">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
        <span>{d.place.name}{d.place.address && d.place.address !== d.place.name ? `, ${d.place.address}` : ''}</span>
      </p>
    {/if}
    <label class="lbl" for="sc-name">{tx('raccourcis.nom')}</label>
    <input id="sc-name" bind:value={name} maxlength={NAME_MAX} autocomplete="off" placeholder={tx('raccourcis.nom_exemple')} />
    <p class="lbl" id="sc-icon">{tx('raccourcis.icone')}</p>
    <div class="grid" role="radiogroup" aria-labelledby="sc-icon">
      {#each ICON_IDS as id}
        <button type="button" class="g" class:on={icon === id} role="radio" aria-checked={icon === id} aria-label={LABELS[id]} title={LABELS[id]} onclick={() => (icon = id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{@html SHORTCUT_ICONS[id]}</svg>
        </button>
      {/each}
    </div>
    {#if !d.place && !d.id}<p class="hint">{tx('raccourcis.adresse_ensuite')}</p>{/if}
    <button class="ok" disabled={!name.trim()}>{action}</button>
  </form>
</Dialog>

<style>
  .sc { display: grid; }
  .addr { display: flex; gap: 10px; align-items: center; margin: 0 0 4px; padding: 11px 14px; border-radius: 12px; background: var(--fill); font-size: 15px; }
  .addr svg { flex: none; width: 18px; height: 18px; color: var(--muted); }
  .lbl { margin: 12px 0 6px; font-size: var(--fs-meta); font-weight: 600; color: var(--muted); }
  input { height: 46px; padding: 0 14px; border: 0; border-radius: 12px; background: var(--fill); color: var(--ink); font: inherit; font-size: 16px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 0; justify-items: center; margin-top: 2px; }
  .g { width: 50px; height: 50px; border: 0; border-radius: 50%; display: grid; place-items: center; background: var(--fill); color: var(--ink); cursor: pointer; }
  .g svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .g.on { background: var(--accent-btn); color: #fff; box-shadow: 0 0 0 3px var(--card), 0 0 0 5px var(--accent-btn); }
  .hint { margin: 14px 0 0; font-size: var(--fs-meta); color: var(--muted); }
  .ok { margin-top: 16px; height: 50px; border: 0; border-radius: 14px; background: var(--accent-btn); color: #fff; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }
  .ok:disabled { opacity: 0.45; cursor: default; }
</style>
