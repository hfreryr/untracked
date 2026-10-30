<!-- Fenêtre « À propos » (bouton ⓘ de la carte) : la promesse, l'origine des informations, comment aider.
     Remplace le texte d'attribution de MapLibre, illisible (retour du porteur, 16/10). Les crédits complets sont en bas :
     la mention « © OpenStreetMap » de la carte se replie au bout de 5 s (règles d'attribution de la fondation OSM). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import { CONTACT_EMAIL } from '#lib/config.js';
  import { installWay } from '#lib/install.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  let { onclose } = $props();
  let view = $state('main');          // main | sources

  const ext = { target: '_blank', rel: 'noopener' };
  // Signaler une erreur : la page « fixthemap » d'OpenStreetMap, demandée par les conditions de FOSSGIS
  // (elle explique comment laisser une note, sans compte, ou corriger soi-même). Rien n'est envoyé par l'app.
  const FIX_URL = 'https://www.openstreetmap.org/fixthemap';
  const DATA = [
    [tx('apropos.n_osm'), tx('apropos.s_osm'), 'https://www.openstreetmap.org/copyright'],
    [tx('apropos.n_openfreemap'), tx('apropos.s_openfreemap'), 'https://openfreemap.org'],
    [tx('apropos.n_ign'), tx('apropos.s_ign'), 'https://geoservices.ign.fr/bdortho'],
    [tx('apropos.n_overture'), tx('apropos.s_overture'), 'https://overturemaps.org'],
    [tx('apropos.n_atp'), tx('apropos.s_atp'), 'https://www.alltheplaces.xyz'],
    [tx('apropos.n_paris'), tx('apropos.s_paris'), 'https://opendata.paris.fr'],
    [tx('apropos.n_annuaire'), tx('apropos.s_annuaire'), 'https://lannuaire.service-public.fr'],
    [tx('apropos.sites_des_lieux'), tx('apropos.s_sites'), ''],
    [tx('apropos.n_photos'), tx('apropos.s_photos'), 'https://panoramax.fr'],
    [tx('apropos.n_mangrove'), tx('apropos.s_mangrove'), 'https://mangrove.reviews/terms'],
    [tx('apropos.n_qrank'), tx('apropos.s_qrank'), 'https://qrank.toolforge.org']
  ];
  const SERVICES = [
    [tx('apropos.n_photon'), tx('apropos.s_photon'), 'https://photon.komoot.io'],
    [tx('apropos.n_valhalla'), tx('apropos.s_valhalla'), 'https://valhalla1.openstreetmap.de'],
    [tx('apropos.n_transitous'), tx('apropos.s_transitous'), 'https://transitous.org/sources/']
  ];
  function importer() { onclose(); app.importOpen = true; }
</script>

{#snippet lock()}
  <svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
{/snippet}
{#snippet chev()}<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>{/snippet}

<Dialog title={view === 'main' ? tx('apropos.titre') : tx('apropos.sources_titre')} sub={view === 'main' ? tx('apropos.sous_titre') : ''}
  icon={view === 'main' ? lock : undefined} {onclose}>
  {#if view === 'main'}
    <h3>{tx('apropos.vie_privee')}</h3>
    <ul class="grp">
      <li class="it"><span class="ico green" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
        <span class="txt">{tx('apropos.aucun_compte')}<small>{tx('apropos.rien_collecte')}</small></span></li>
      <li class="it"><span class="ico green" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 17.5h2" /></svg></span>
        <span class="txt">{tx('apropos.lieux_sur_telephone')}<small>{tx('apropos.transfert_sans_compte')}</small></span></li>
      <li><a class="it" href="confidentialite"><span class="ico blue" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></svg></span>
        <span class="txt">{tx('apropos.qui_voit_quoi')}<small>{tx('apropos.verifiez')}</small></span>{@render chev()}</a></li>
    </ul>

    <h3>{tx('apropos.d_ou_viennent')}</h3>
    <ul class="grp">
      <li><a class="it" href="https://www.openstreetmap.fr/" {...ext}><span class="ico orange" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z" /><path d="M9 4v14M15 6v14" /></svg></span>
        <span class="txt">{tx('apropos.n_osm')}<small>{app.osmDate ? tx('apropos.osm_detail_date', { date: app.osmDate }) : tx('apropos.osm_detail')}</small></span>{@render chev()}</a></li>
      <li><button class="it about-sources" onclick={() => (view = 'sources')}><span class="ico purple" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5 20 8l-8 4.5L4 8z" /><path d="m4 12 8 4.5 8-4.5M4 16l8 4.5 8-4.5" /></svg></span>
        <span class="txt">{tx('apropos.autres_sources')}<small>{tx('apropos.autres_sources_detail')}</small></span>{@render chev()}</button></li>
    </ul>

    <h3>{tx('apropos.aider')}</h3>
    <ul class="grp">
      {#if installWay()}
        <li><button class="it" onclick={() => { onclose(); app.startInstall?.(); }}><span class="ico gray" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></svg></span>
          <span class="txt">{tx('apropos.installer')}</span>{@render chev()}</button></li>
      {/if}
      <li><a class="it" href={FIX_URL} {...ext}><span class="ico gray" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4 21 19.5H3z" /><path d="M12 10v4.5" /><circle cx="12" cy="17" r=".6" /></svg></span>
        <span class="txt">{tx('apropos.signaler')}</span>{@render chev()}</a></li>
      <li><button class="it" onclick={importer}><span class="ico gray" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></svg></span>
        <span class="txt">{tx('apropos.importer')}</span>{@render chev()}</button></li>
      <li><a class="it" href="https://github.com/hfreryr/untracked" {...ext}><span class="ico gray" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5" /></svg></span>
        <span class="txt">{tx('apropos.code_source')}</span>{@render chev()}</a></li>
      <li><a class="it" href={`mailto:${CONTACT_EMAIL}`}><span class="ico gray" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></svg></span>
        <span class="txt">{tx('apropos.nous_ecrire')}<small>{CONTACT_EMAIL}</small></span>{@render chev()}</a></li>
    </ul>
    <p class="foot"><a href="https://www.openstreetmap.org/copyright" {...ext}>{tx('apropos.credits_osm')}</a> {tx('apropos.credits_reste')}</p>
  {:else}
    <button class="back" onclick={() => (view = 'main')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>{tx('apropos.retour')}</button>
    <p class="intro">{tx('apropos.sources_intro')}</p>
    {#each [[tx('apropos.donnees'), DATA], [tx('apropos.services'), SERVICES]] as [head, rows]}
      <h3>{head}</h3>
      <ul class="grp">
        {#each rows as [name, use, url]}
          <li>{#if url}<a class="it src" href={url} {...ext}><span class="txt">{name}<small>{use}</small></span>{@render chev()}</a>
            {:else}<span class="it src"><span class="txt">{name}<small>{use}</small></span></span>{/if}</li>
        {/each}
      </ul>
    {/each}
  {/if}
</Dialog>

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  :global(.dlg-icon) svg { width: 24px; height: 24px; stroke-width: 2; }
  h3 { margin: 16px 2px 6px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
  .grp { list-style: none; margin: 0; padding: 0; background: var(--fill); border-radius: 14px; overflow: hidden; }
  .grp > li + li { border-top: 1px solid var(--line); }
  .it { display: flex; gap: 12px; align-items: center; width: 100%; box-sizing: border-box; min-height: 48px; padding: 9px 12px 9px 14px;
    border: 0; background: none; color: var(--ink); font: inherit; font-size: 15px; line-height: 1.3; text-align: left; text-decoration: none; cursor: pointer; }
  span.it { cursor: default; }
  a.it:hover, button.it:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
  .txt { flex: 1; min-width: 0; }
  .txt small { display: block; margin-top: 1px; font-size: 13.5px; color: color-mix(in srgb, var(--muted) 75%, var(--ink)); }   /* sur fond gris : contraste ≥ 4,5:1 */
  .ico { flex: none; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; color: var(--tint); background: color-mix(in srgb, var(--tint) 15%, var(--card)); }
  .ico svg { width: 18px; height: 18px; }
  .green { --tint: #1e8e3e; } .blue { --tint: var(--accent); } .orange { --tint: #c26401; } .purple { --tint: #7a3fc4; } .gray { --tint: var(--muted); }
  .chev { flex: none; width: 18px; height: 18px; color: var(--muted); }
  .foot { margin: 14px 2px 0 !important; font-size: 12.5px !important; color: var(--muted); line-height: 1.45; }
  .foot a { color: inherit; }
  .back { display: inline-flex; align-items: center; gap: 4px; margin: -4px 0 4px -6px; min-height: 44px; padding: 0 8px 0 2px; border: 0; background: none;
    color: var(--accent); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
  .back svg { width: 20px; height: 20px; stroke-width: 2.2; }
  .intro { color: var(--muted); font-size: 14px !important; }
</style>
