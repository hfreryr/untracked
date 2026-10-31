<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import ListDot from '#lib/ui/ListDot.svelte';
  import { draggable } from '#lib/sheet.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  // Un seul endroit pour garder un lieu (porteur, 31/10/2026) : les listes (« Mes lieux ») et les raccourcis de l'accueil
  // (Maison, Travail, personnalisés), qui se créaient avant par trois boutons différents.
  function toggleFixed(k, on) {
    const old = app.shortcuts[k];
    app.setShortcut(k, on ? app.place : null);
    if (!on) app.say(tx('fiche.retire', { nom: app.SHORT_NAMES[k] }), { label: tx('resultats.annuler'), run: () => app.setShortcut(k, old) });
  }
  function otherShortcut() {
    const c = app.placeCustom;
    app.listPicker = false;
    app.openShortcutDlg(c ? { id: c.id } : { place: app.place });
  }
</script>


    <section class="sheet" aria-label={tx('enregistrer.enregistrer_dans')} use:draggable={{ key: 'picker', onDismiss: () => (app.listPicker = false), modal: true, start: 'full' }}>
      <button class="grip" aria-label={tx('liste.agrandir_la_fiche')}></button>
      <button class="close" onclick={() => (app.listPicker = false)} aria-label={tx('photos.fermer')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
      </button>
      <h1>{tx('enregistrer.enregistrer')}</h1>
      <p class="kind">{app.place.name}</p>
      <h2>{tx('enregistrer.dans_une_liste')} <small>{tx('enregistrer.dans_une_liste_aide')}</small></h2>
      <ul class="pick-lists">
        {#each app.lists as l (l.id)}
          {@const on = !!app.savedEntry?.lists.includes(l.id)}
          <li><label>
            <ListDot l={l} size={32} />
            <span class="pl-name">{l.name}</span>
            <span class="pl-count">{app.favorites.filter((f) => f.lists.includes(l.id)).length}</span>
            <input type="checkbox" checked={on} onchange={(e) => app.setMembership(l.id, e.currentTarget.checked)} />
          </label></li>
        {/each}
      </ul>
      <form class="new-list" onsubmit={(e) => { e.preventDefault(); app.createList(app.newListName, (id) => app.setMembership(id, true)); app.newListName = ''; }}>
        <input bind:value={app.newListName} placeholder={tx('liste.nouvelle_liste')} aria-label={tx('liste.nom_de_la_nouvelle_liste')} maxlength="40" />
        <button class="link" disabled={!app.newListName.trim()}>{tx('liste.creer')}</button>
      </form>
      <h2>{tx('enregistrer.comme_raccourci')} <small>{tx('enregistrer.comme_raccourci_aide')}</small></h2>
      <ul class="pick-lists shortcuts">
        {#each ['home', 'work'] as k}
          {@const on = app.placeShortcut === k}
          <li><label>
            <span class="sc-ico" aria-hidden="true">{#if k === 'home'}<svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5M6.5 10v9.5h11V10" /><path d="M10.2 19.5v-4.8h3.6v4.8" /></svg>{:else}<svg viewBox="0 0 24 24"><rect x="3.5" y="7.5" width="17" height="12" rx="2.5" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" /></svg>{/if}</span>
            <span class="pl-name">{app.SHORT_NAMES[k]}<small>{app.shortcuts[k] && !on ? app.shortcuts[k].name : on ? '' : tx('enregistrer.pas_encore_defini')}</small></span>
            <span></span>
            <input type="checkbox" checked={on} onchange={(e) => toggleFixed(k, e.currentTarget.checked)} />
          </label></li>
        {/each}
        <li><button class="other" onclick={otherShortcut}>
          <span class="sc-ico" aria-hidden="true">{#if app.placeCustom}<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>{:else}<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" /></svg>{/if}</span>
          <span class="pl-name">{app.placeCustom ? app.placeCustom.name : tx('enregistrer.autre_raccourci')}<small>{tx('enregistrer.nom_et_icone_au_choix')}</small></span>
        </button></li>
      </ul>
      <button class="go wide done" onclick={() => (app.listPicker = false)}>{tx('enregistrer.termine')}</button>
    </section>

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  input {
    border: 0; background: none; font: inherit; font-size: 17px; color: var(--ink);
    padding: 12px 0; min-width: 0; outline: none; width: 100%;
  }
  input::placeholder { color: var(--muted); }
  input::-webkit-search-cancel-button { display: none; }

  .link { border: 0; background: none; color: var(--accent); font: inherit; font-weight: 500; cursor: pointer; padding: 4px 0; }

  /* ——— Fiches ——— */
  .close {
    position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 50%;
    border: 0; background: var(--fill); cursor: pointer; display: grid; place-items: center; color: var(--muted);
  }
  .close svg { width: 16px; height: 16px; stroke-width: 2.4; }
  /* Zone de toucher d'au moins 44 px autour des petits boutons ronds */
  .close::after { content: ''; position: absolute; inset: -6px; }
  .pick-lists { list-style: none; margin: 0; padding: 0; }
  .pick-lists label {   /* (pas le bouton « Créer » du champ de nouvelle liste : il écrasait le champ à 0 px) */ display: grid; grid-template-columns: 34px 1fr auto auto; gap: 12px; align-items: center; width: 100%;
    min-height: 52px; border: 0; background: none; padding: 0; text-align: left; cursor: pointer; border-bottom: 1px solid var(--line); font-size: 16px; }
  .pick-lists label { grid-template-columns: 32px 1fr auto 28px; }
  .pick-lists input { width: 22px; height: 22px; accent-color: var(--accent-btn); }
  .pl-count { color: var(--muted); font-size: 14px; font-variant-numeric: tabular-nums; }
  .new-list { display: flex; gap: 8px; align-items: center; min-height: 50px; border-bottom: 1px solid var(--line); }
  .new-list input { flex: 1; border: 0; background: none; font: inherit; font-size: 16px; color: var(--ink); padding: 10px 0; min-width: 0; }
  .new-list .link:disabled { opacity: 0.4; }
  .go.wide.done { width: 100%; margin: 14px 0 4px; height: 46px; background: var(--accent-btn); }
  .close ~ h1 { margin-right: 44px; }
  h1 { font-size: 24px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; margin: 2px 44px 2px 0; text-wrap: balance; }
  .kind { margin: 0; color: var(--muted); font-size: 15px; }
  .kind::first-letter { text-transform: uppercase; }
  h2 { margin: 18px 0 2px; font-size: 15px; font-weight: 650; }
  h2 small { display: block; font-size: 13px; font-weight: 500; color: var(--muted); }
  .pl-name small { display: block; font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pl-name { min-width: 0; }
  .sc-ico { width: 32px; height: 32px; border-radius: 50%; background: var(--fill); display: grid; place-items: center; color: var(--ink); }
  .sc-ico svg { width: 18px; height: 18px; }
  .other { display: grid; grid-template-columns: 32px 1fr; gap: 12px; align-items: center; width: 100%; min-height: 52px; border: 0; background: none;
    padding: 0; text-align: left; cursor: pointer; border-bottom: 1px solid var(--line); font: inherit; font-size: 16px; color: var(--ink); }
</style>
