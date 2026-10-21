<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { draggable } from '#lib/sheet.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
</script>


    <section class="sheet" aria-label={tx('recherche.personnaliser_les_raccourcis')} use:draggable={{ key: 'chips', onDismiss: () => (app.editChips = false) , modal: true }}>
      <button class="grip" aria-label={tx('liste.agrandir_la_fiche')}></button>
      <button class="close" onclick={() => (app.editChips = false)} aria-label={tx('photos.fermer')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
      </button>
      <h1>{tx('raccourcis.raccourcis')}</h1>
      <p class="kind">{tx('raccourcis.choisissez_ceux_qui_affichent_leur')}</p>
      <ul class="chip-edit">
        {#each app.chipPrefs as pr, i (pr.key)}
          {#if i === app.chipPrefs.findIndex((x) => x.hidden) && i > 0}<li class="ce-head">{tx('raccourcis.autres_raccourcis_disponibles')}</li>{/if}
          {@const c = app.catOf(pr.key)}
          <li class:off={pr.hidden}>
            <button class="ce-toggle" onclick={() => app.toggleChip(i)} role="switch" aria-checked={!pr.hidden} aria-label={tx('raccourcis.afficher', { label: c.label })}
              style:--fam={app.famColor(c)}><span></span></button>
            <input value={pr.label ?? ''} placeholder={c.label} aria-label={tx('raccourcis.nom_du_raccourci', { label: c.label })}
              onchange={(e) => app.renameChip(i, e.currentTarget.value)} maxlength="20" />
            <button class="icon-btn" onclick={() => app.moveChip(i, -1)} disabled={i === 0} aria-label={tx('raccourcis.monter', { label: c.label })}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5" /></svg></button>
            <button class="icon-btn" onclick={() => app.moveChip(i, 1)} disabled={i === app.chipPrefs.length - 1} aria-label={tx('raccourcis.descendre', { label: c.label })}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></button>
          </li>
        {/each}
      </ul>
      <button class="link more" onclick={app.resetChips}>{tx('raccourcis.revenir_aux_raccourcis_origine')}</button>
    </section>

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  input {
    border: 0; background: none; font: inherit; font-size: 17px; color: var(--ink);
    padding: 12px 0; min-width: 0; outline: none; width: 100%;
  }
  input::placeholder { color: var(--muted); }
  input::-webkit-search-cancel-button { display: none; }
  .icon-btn { border: 0; background: none; width: 46px; height: 46px; cursor: pointer; display: grid; place-items: center; color: var(--muted); }
  .icon-btn svg { width: 20px; height: 20px; stroke-width: 2; }
  .icon-btn:disabled { opacity: 0.35; cursor: default; }

  .link { border: 0; background: none; color: var(--accent); font: inherit; font-weight: 500; cursor: pointer; padding: 4px 0; }

  /* ——— Fiches ——— */
  .close {
    position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 50%;
    border: 0; background: var(--fill); cursor: pointer; display: grid; place-items: center; color: var(--muted);
  }
  .close svg { width: 16px; height: 16px; stroke-width: 2.4; }
  /* Zone de toucher d'au moins 44 px autour des petits boutons ronds */
  .close::after { content: ''; position: absolute; inset: -6px; }
  .close ~ h1 { margin-right: 44px; }
  h1 { font-size: 24px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; margin: 2px 44px 2px 0; text-wrap: balance; }
  .kind { margin: 0; color: var(--muted); font-size: 15px; }
  .kind::first-letter { text-transform: uppercase; }
  .chip-edit { list-style: none; margin: 12px 0 8px; padding: 0; }
  .chip-edit li.ce-head { display: block; min-height: 0; padding: 18px 0 6px; font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .chip-edit li { display: grid; grid-template-columns: 44px 1fr 40px 40px; align-items: center; gap: 4px; border-bottom: 1px solid var(--line); min-height: 52px; }
  .chip-edit input { border: 0; background: none; font: inherit; font-size: 16px; color: var(--ink); padding: 10px 0; min-width: 0; }
  .chip-edit input::placeholder { color: var(--ink); }
  .chip-edit li.off input, .chip-edit li.off input::placeholder { color: var(--faint); }
  .chip-edit .icon-btn { width: 40px; height: 40px; }
  .chip-edit .icon-btn:disabled { opacity: 0.25; }
  .ce-toggle { width: 38px; height: 24px; border-radius: 12px; border: 0; background: var(--fam); position: relative; cursor: pointer; padding: 0; }
  .ce-toggle span { position: absolute; top: 3px; left: 17px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.15s; }
  li.off .ce-toggle { background: var(--line); }
  li.off .ce-toggle span { left: 3px; }
</style>
