<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { draggable } from '#lib/sheet.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
</script>


    <section class="sheet" aria-label={tx('import.importer_vos_lieux')} use:draggable={{ key: 'import', onDismiss: () => (app.importOpen = false) , modal: true }}>
      <button class="grip" aria-label={tx('liste.agrandir_la_fiche')}></button>
      <button class="close" onclick={() => (app.importOpen = false)} aria-label={tx('photos.fermer')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
      </button>
      <h1>{tx('import.vos_lieux_google_maps')}</h1>
      <p class="kind">{tx('import.recuperez_vos_lieux_enregistres')}</p>
      <ol class="howto">
        <li>{tx('import.ouvrez')} <a href="https://takeout.google.com/" target="_blank" rel="noopener">{tx('import.takeout_google_com')}</a>{tx('import.touchez_tout_deselectionner_puis')} <strong>{tx('import.enregistre_vos_listes')}</strong>{tx('import.vos_listes_et')} <strong>{tx('import.maps_vos_adresses')}</strong>.</li>
        <li>{tx('import.touchez_etape_suivante_puis_creer')}</li>
        <li>{tx('import.telechargez_le_fichier_zip_puis')}</li>
      </ol>
      <label class="action primary import-btn">
        <input type="file" accept=".zip,.json,.csv,application/zip,application/json,text/csv" onchange={app.importFile} hidden />
        {app.importing || tx('liste.choisir_le_fichier')}
      </label>
      <p class="credit">{tx('import.le_fichier_est_lu_sur_votre')}</p>
    </section>

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  input {
    border: 0; background: none; font: inherit; font-size: 17px; color: var(--ink);
    padding: 12px 0; min-width: 0; outline: none; width: 100%;
  }
  input::placeholder { color: var(--muted); }
  input::-webkit-search-cancel-button { display: none; }

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
  .action {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 56px; padding: 6px 4px;
    border-radius: 14px; border: 0; cursor: pointer; text-decoration: none; font-size: 13.5px; font-weight: 600; line-height: 1.1;
    background: var(--fill); color: var(--accent); box-sizing: border-box; min-width: 0;
  }
  .action:active { filter: brightness(0.94); }
  .action :global(svg) { width: 21px; height: 21px; flex: none; }
  .action.primary { background: var(--accent-btn); color: #fff; }
  .howto { margin: 14px 0 16px; padding-left: 20px; display: grid; gap: 10px; font-size: 15px; line-height: 1.45; }
  .howto a { color: var(--accent); }
  .import-btn { display: flex; justify-content: center; align-items: center; min-height: 48px; border-radius: 14px; cursor: pointer; font-weight: 600; }
</style>
