<script>
  import PhotoStrip from './PhotoStrip.svelte';
  import { placePhotos } from '#lib/placephotos.js';
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { draggable } from '#lib/sheet.js';
  import ModeIcon from './ModeIcon.svelte';
  import { exitLabel } from '#lib/exits.js';
  import { showExits } from '#lib/exitlayer.js';
  import Dialog from './Dialog.svelte';
  import { fmtWait } from '#lib/routing.js';
  import { host, href } from '#lib/links.js';
  import { dataDate } from '#lib/placestore.js';
  import Reviews from './Reviews.svelte';
  import { longpress } from '#lib/longpress.js';
  import { glanceItems, isNear } from '#lib/glance.js';
  import { loadReviewer, mineFor } from '#lib/reviewer.js';
  import NearbyRate from './NearbyRate.svelte';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  let freshInfo = $state(false);
  // date des données de ce lieu : chaque ville a la sienne (Île-de-France chaque nuit, autres villes chaque semaine)
  let placeDate = $state('');
  $effect(() => {
    const p = app.place;
    placeDate = '';
    if (!p?.lat) return;
    dataDate(p.lat, p.lon).then((d) => { if (d && app.place === p) placeDate = new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); }).catch(() => {});
  });
  // sorties de la station ouverte, aussi sur la carte (P5) ; retirées quand la fiche se ferme
  $effect(() => {
    showExits(app.map, app.exits?.status === 'ok' ? app.exits.data : []);
    return () => showExits(app.map, []);
  });
  const savedWhere = $derived([
    app.savedEntry?.lists.length ? tx('fiche.dans_listes', { listes: app.savedEntry.lists.map((id) => app.listOf(id).name).join(', ') }) : '',
    app.placeShortcut ? tx('fiche.raccourci_nom', { nom: app.SHORT_NAMES[app.placeShortcut] }) : '',
    app.placeCustom ? tx('fiche.raccourci_nom', { nom: app.placeCustom.name }) : ''
  ].filter(Boolean).join(' · '));
  const savedAny = $derived(!!(app.isFav || app.placeShortcut || app.placeCustom));
  const reviewCount = $derived(app.info?.reviews?.count || 0);
  const photos = $derived(placePhotos(app.wiki, app.info));
  const glance = $derived(glanceItems({ status: app.status, reviews: app.info?.reviews, me: app.me, place: app.place, info: app.info }));
  const reviewable = $derived(!!(app.place?.osmType && app.place?.name && !app.isAddress && !app.isStation));
  // sur place (moins de 100 m) et pas encore d'avis de ma part : « Votre avis sur ce lieu » en haut de la fiche
  const nearAsk = $derived(reviewable && isNear(app.me, app.place) && !mineFor(loadReviewer(), app.place));
  const toReviews = () => document.getElementById('rev-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  async function copyAddressOnly() {
    try { await navigator.clipboard.writeText(app.address); app.say(tx('ecran.adresse_copiee')); } catch { /* refusé */ }
  }
  // Sources des compléments hors OSM (app/scripts/build_extras.py) ; une source inconnue n'est pas affichée
  const SOURCES = { overture: () => tx('source.overture'), paris: () => tx('source.paris'), atp: () => tx('source.atp'), annuaire: () => tx('source.annuaire'), site: () => tx('source.site') };
</script>

{#snippet transitBlock()}
      {#if app.isStation}
        <div class="deps" aria-live="polite">
          <h2>{tx('fiche.prochains_passages')}</h2>
          {#if !app.deps || app.deps.status === 'loading'}
            <p class="muted">{tx('fiche.recherche_des_prochains_passages')}</p>
          {:else if app.deps.status === 'error'}
            <p class="muted">{tx('fiche.horaires_indisponibles_pour_le')}</p>
          {:else if app.deps.status === 'none'}
            <p class="muted">{tx('fiche.aucun_passage_prevu_dans_heure')}</p>
          {:else}
            <ul>
              {#each app.deps.data.lines as l}
                <li>
                  <span class="badge" class:round={l.mode === 'SUBWAY' || l.mode === 'METRO'} style:background={l.color} style:color={l.textColor}>{l.line}</span>
                  <span class="dep-dir">{l.headsign}</span>
                  <span class="dep-times">
                    {#if l.realTime}<span class="live" title={tx('fiche.en_temps_reel')} aria-label={tx('fiche.en_temps_reel')}></span>{/if}
                    {#each l.times as t, i}<span class:first={i === 0}>{fmtWait(t, app.now)}</span>{#if i < l.times.length - 1}<span class="sep"> · </span>{/if}{/each}
                  </span>
                </li>
              {/each}
            </ul>
            <p class="credit">{tx('fiche.horaires')} <a href="https://transitous.org/sources/" target="_blank" rel="noopener">{tx('fiche.transitous_et_reseaux_de_transport')}</a></p>
          {/if}
        </div>
      {/if}
      {#if app.exits?.status === 'ok' && app.exits.data.length}
        <div class="exits">
          <h2>{tx('fiche.sorties')}</h2>
          <ul>
            {#each app.allExits ? app.exits.data : app.exits.data.slice(0, 4) as e}
              <li><button class="exit-go" onclick={() => app.map.easeTo({ center: [e.lon, e.lat], zoom: Math.max(17, app.map.getZoom()), duration: 600 })}><span class="exit-sq" aria-hidden="true"></span><span>{exitLabel(e)}</span></button>
                {#if e.wheelchair}<span class="exit-tag">{tx('fiche.accessible')}</span>{:else if e.escalator}<span class="exit-tag">{tx('fiche.escalier_mecanique')}</span>{/if}</li>
            {/each}
          </ul>
          {#if app.exits.data.length > 4 && !app.allExits}<button class="link more" onclick={() => (app.allExits = true)}>{tx('fiche.toutes_les_sorties', { n: app.exits.data.length })}</button>{/if}
        </div>
      {/if}

{/snippet}
{#snippet photoBlock()}{/snippet}
{#snippet aboutBlock()}
      {#if app.wiki?.extract}
        <div class="about">
          <h2>{tx('fiche.informations')}</h2>
          <p class:clamped={!app.moreText}>{app.wiki.extract}</p>
          {#if !app.moreText && app.wiki.extract.length > 180}<button class="link more" onclick={() => (app.moreText = true)}>{tx('fiche.plus')}</button>{/if}
          <p class="credit">{tx('fiche.plus_infos_sur')} <a href={app.wiki.url} target="_blank" rel="noopener">{tx('fiche.wikipedia')}</a></p>
        </div>
      {/if}

{/snippet}
{#snippet src(source)}
  <!-- information qui ne vient pas d'OSM : on dit d'où elle vient (règle du projet) -->
  {#if SOURCES[source]}<span class="src">{tx('fiche.source', { source: SOURCES[source]() })}</span>{/if}
{/snippet}
{#snippet rowsBlock()}
      <!-- Bon à savoir : infos notées par les contributeurs OSM, rien de déduit -->
      {#if app.info?.good?.length}
        <section class="psec">
          <h2>{tx('fiche.bon_a_savoir')}</h2>
          <ul class="good">
            {#each app.info.good as g}
              <li class:no={!g.ok}>
                {#if g.ok}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                {:else}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>{/if}
                <span>{g.text}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}


      {#if app.week}
        <section class="psec">
          <h2>{tx('fiche.horaires_2')}</h2>
          <table class="week"><tbody>
            {#each app.week as d}<tr class:today={d.today}><th>{d.day}</th><td>{d.text}</td></tr>{/each}
          </tbody></table>
          {#if app.info?.sources?.opening_hours}<p class="details-src">{@render src(app.info.sources.opening_hours)}</p>{/if}
        </section>
      {:else if app.info?.expectsHours && !app.isStation}
        <section class="psec">
          <h2>{tx('fiche.horaires_2')}</h2>
          <p class="muted small">{tx('fiche.personne_ne_les_a_encore_ajoutes_a')}</p>
          {#if app.osmEditUrl}<a class="link ext" href={app.osmEditUrl} target="_blank" rel="noopener">{tx('fiche.ajouter_les_horaires')}</a>{/if}
        </section>
      {/if}

      {#if app.info?.phone || app.info?.website || app.info?.menu || app.address}
        <section class="psec">
          <h2>{tx('fiche.details')}</h2>
          <dl class="details">
            {#if app.info?.phone}
              <div><dt>{tx('fiche.telephone')}</dt><dd><a href={`tel:${app.info.phone.replace(/\s/g, '')}`}>{app.info.phone}</a>{@render src(app.info.sources?.phone)}</dd></div>
            {/if}
            {#if app.info?.website}
              <div><dt>{tx('fiche.site_web')}</dt><dd><a href={href(app.info.website)} target="_blank" rel="noopener">{host(app.info.website)}</a>{@render src(app.info.sources?.website)}</dd></div>
            {/if}
            {#if app.info?.menu}
              <div><dt>{tx('fiche.menu')}</dt><dd><a href={href(app.info.menu)} target="_blank" rel="noopener">{tx('fiche.voir_le_menu')}</a></dd></div>
            {/if}
            {#if app.address}
              <!-- appui prolongé : l'adresse est copiée (porteur, 31/10/2026) ; aussi dans « Plus » pour le clavier -->
              <div><dt>{tx('fiche.adresse')}</dt><dd class="hold" use:longpress={copyAddressOnly} title={tx('fiche.appui_prolonge_pour_copier')}>{app.address}{@render src(app.info?.sources?.['addr:street'])}</dd></div>
            {/if}
          </dl>
        </section>
      {/if}

      <!-- avis : lire ceux de Mangrove et écrire le sien, pour tout lieu OSM nommé (pas une adresse ni une station) -->
      {#if app.place?.osmType && app.place?.name && !app.isAddress && !app.isStation}<Reviews place={app.place} reviews={app.info?.reviews} hideRate={nearAsk} />{/if}


      {#if app.info?.covered === false}
        <p class="contrib">{tx('fiche.ce_lieu_est_hors_de_la_zone_couverte')}</p>
      {:else if app.info?.missing && !app.place.name}
        <p class="contrib">{tx('fiche.lieu_introuvable')}</p>
      {/if}
      <p class="contrib">
        {#if placeDate}{tx('fiche.donnees_openstreetmap_du', { osmDate: placeDate })}{' '}{/if}{tx('fiche.une_info_manque_ou_est_fausse')}
        {#if app.osmEditUrl}<a href={app.osmEditUrl} target="_blank" rel="noopener">{tx('fiche.completez_la_sur_openstreetmap')}</a>{:else}<a href={app.osmNoteUrl} target="_blank" rel="noopener">{tx('fiche.signalez_la_sur_openstreetmap')}</a>{/if}{tx('fiche.la_carte_libre_que_nous_utilisons')}
      </p>
{/snippet}

    <section class="sheet" aria-label={app.place.name} use:draggable={{ key: app.place.id, onDismiss: app.closePlace }} onsheetmove={(e) => (app.placeSheetH = e.detail.height)}>
      <button class="grip" aria-label={tx('liste.agrandir_la_fiche')}></button>
      <button class="close" onclick={app.closePlace} aria-label={tx('fiche.fermer_la_fiche')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
      </button>

      <button class="share left" onclick={app.sharePlace} aria-label={tx('liste.partager')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11M8 7.5l4-4 4 4M6 11.5H5v8h14v-8h-1" /></svg>
      </button>
      <div class="phead">
        <h1>{app.title}</h1>
        <p class="kind">{app.isAddress
          ? (app.place.name.split(',').slice(1).join(',').trim() || app.place.address || tx('fiche.adresse'))
          : [app.stationKind || app.info?.kind || app.place.type, app.info?.cuisine && tx('fiche.cuisine', { v: app.info.cuisine.split(';')[0] })].filter(Boolean).join(' · ') || tx('fiche.lieu')}</p>
      </div>
      {#if app.savedEntry || app.placeShortcut || app.placeCustom}
        <!-- où le lieu est rangé : listes et raccourci (retour d'une testeuse Android, 20/10 : « la liste n'apparaît dans
             aucune fiche ») ; un toucher rouvre « Enregistrer » -->
        <button class="in-lists" onclick={() => (app.listPicker = true)} aria-label={tx('fiche.modifier_les_listes')}>
          {#each app.savedEntry?.lists || [] as id (id)}<span class="ldot" style:background={app.listOf(id).color} aria-hidden="true"></span>{/each}
          <span>{savedWhere}</span>
        </button>
      {/if}

      <!-- En un coup d'œil : ouvert ? loin ? encore à jour ? -->
      {#if app.info === null}<p class="glance"><span class="muted">{tx('fiche.chargement')}</span></p>{/if}
      {#if app.freshness}
        <p class="fresh" class:old={!app.freshness.ok}>
          {#if app.freshness.ok}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>{/if}<span>{app.freshness.text}</span>
          <!-- « vérifié par qui ? » (P6) : le détail dans une fenêtre, la ligne reste courte -->
          <button class="info-btn" onclick={() => (freshInfo = true)} aria-label={tx('fiche.que_veut_dire_verifiees')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.6" class="solid" /></svg>
          </button>
        </p>
        {#if freshInfo}
          <Dialog title={tx('fiche.verifiees_titre')} onclose={() => (freshInfo = false)}>
            <p>{tx('fiche.verifiees_qui')}</p>
            <p>{tx('fiche.verifiees_pas_un_avis')}</p>
            <p>{app.freshness.ok ? tx('fiche.verifiees_corriger') : tx('fiche.verifiees_ancien')}</p>
          </Dialog>
        {/if}
      {/if}

      <div class="actions">
        <!-- le mode proposé par défaut (le dernier choisi, sinon selon la distance) et son temps estimé, comme Plans -->
        <button class="action primary" onclick={app.startDirections} aria-label={app.walkEta?.label}>
          {#if app.walkEta}
            <ModeIcon id={app.walkEta.mode} />
            <span>{app.walkEta.text}</span>
          {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 21.2 12 12 21.2 2.8 12z" class="solid" /><path d="M9.5 14.5v-2.2a1.5 1.5 0 0 1 1.5-1.5h4M13 8.8l2 2-2 2" class="on-solid" /></svg>
            <span>{tx('fiche.itineraire')}</span>
          {/if}
        </button>
        {#if app.info?.phone}
          <a class="action" href={`tel:${app.info.phone.replace(/\s/g, '')}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5 9 3l2 4.6-2.3 1.6a12 12 0 0 0 6.1 6.1l1.6-2.3L21 15l-.5 2.4A3 3 0 0 1 17.6 20C10 20 4 14 4 6.4a3 3 0 0 1 2.6-2.9z" /></svg>
            <span>{tx('fiche.appeler')}</span>
          </a>
        {/if}
        {#if app.info?.website}
          <a class="action" href={href(app.info.website)} target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5M12 3.5C9.5 6.1 8.4 8.9 8.4 12s1.1 5.9 3.6 8.5" /></svg>
            <span>{tx('fiche.site_web')}</span>
          </a>
        {/if}
        <!-- 4 boutons au plus, jamais tronqués ; « Plus », « Raccourci » et « Avis » dans la rangée du dessous
             (maquette B, 31/10/2026 : rien de flottant sur la fiche) -->
        <!-- « Enregistrer » ouvre le choix de la liste, Favoris en tête, comme Google Maps (P8, 30/10/2026 : 5 min pour
             ranger un lieu dans une liste) -->
        <button class="action save" class:on={savedAny} onclick={() => (app.listPicker = true)} aria-label={savedAny ? tx('fiche.enregistre_modifier') : tx('fiche.enregistrer_dans_liste')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4h9a1 1 0 0 1 1 1v15l-5.5-3.8L6.5 20V5a1 1 0 0 1 1-1z" /></svg>
          <span>{savedAny ? tx('fiche.enregistre') : tx('fiche.enregistrer')}</span>
        </button>
      </div>

      {#if glance.length}
        <dl class="strip">
          {#each glance as it (it.key)}
            <div>
              <dt>{it.label}</dt>
              <dd class:is-open={it.tone === 'open'} class:is-closed={it.tone === 'closed'}>{it.value}</dd>
              {#if it.sub}<dd class="sub">{it.sub}</dd>{/if}
            </div>
          {/each}
        </dl>
      {/if}

      <!-- photos, juste sous l'en-tête (comme Plans) : avis, Wikimedia, site du lieu -->
      <PhotoStrip photos={photos} />

      <!-- Lire les avis (s'il y en a), signaler une erreur sur OpenStreetMap, copier l'adresse (31/10/2026 : « Raccourci » et
           « Maison / Travail » rejoignent « Enregistrer » ; « Partager » reste en haut) -->
      <div class="sec-row">
        {#if reviewable && reviewCount}
          <button class="sec-btn" onclick={toReviews}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14v9H10l-4 3v-3H5z" /></svg>
            <span>{tx('fiche.avis_n', { n: reviewCount })}</span>
          </button>
        {/if}
        <a class="sec-btn" href={app.osmNoteUrl} target="_blank" rel="noopener" aria-label={tx('fiche.signaler_un_probleme_sur')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 19.5H3z" /><path d="M12 10v4.5M12 17v.3" /></svg>
          <span>{tx('fiche.signaler')}</span>
        </a>
        {#if app.address}
          <button class="sec-btn" onclick={copyAddressOnly}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>
            <span>{tx('fiche.copier_adresse')}</span>
          </button>
        {/if}
      </div>

      {#if nearAsk}<NearbyRate place={app.place} />{/if}

      <!-- Ordre selon ce qui sert le plus : une station → prochains passages et sorties d'abord ;
           un commerce → horaires, téléphone, site avant le texte Wikipédia ; un monument → photo et histoire. -->
      {#if app.isStation}
        {@render transitBlock()}{@render photoBlock()}{@render aboutBlock()}{@render rowsBlock()}
      {:else if app.info?.expectsHours}
        {@render photoBlock()}{@render rowsBlock()}{@render aboutBlock()}
      {:else}
        {@render photoBlock()}{@render aboutBlock()}{@render rowsBlock()}
      {/if}

    </section>

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  svg .solid { fill: currentColor; stroke: none; }
  .link { border: 0; background: none; color: var(--accent); font: inherit; font-weight: 500; cursor: pointer; padding: 4px 0; }

  /* ——— Fiches ——— */
  .close {
    position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 50%;
    border: 0; background: var(--fill); cursor: pointer; display: grid; place-items: center; color: var(--muted);
  }
  .close svg { width: 16px; height: 16px; stroke-width: 2.4; }
  /* Zone de toucher d'au moins 44 px autour des petits boutons ronds */
  .close::after, .share::after { content: ''; position: absolute; inset: -6px; }
  .share {
    position: absolute; top: 14px; right: 54px; width: 32px; height: 32px; border-radius: 50%;
    border: 0; background: var(--fill); cursor: pointer; display: grid; place-items: center; color: var(--muted);
  }
  .share svg { width: 17px; height: 17px; stroke-width: 2.1; }
  .about { margin-top: 18px; }
  .about h2 { font-size: 17px; font-weight: 700; margin: 0 0 6px; }
  .about p { margin: 0; font-size: 15px; line-height: 1.45; }
  .about p.clamped { display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .about .more { font-weight: 700; margin-top: 2px; }
  .about .credit { margin-top: 6px; }
  .about .credit a { color: var(--accent); text-decoration: none; }
  h1 { font-size: 24px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; margin: 2px 44px 2px 0; text-wrap: balance; }
  .kind { margin: 0; color: var(--muted); font-size: 15px; }
  .kind::first-letter { text-transform: uppercase; }
  .muted { color: var(--muted); font-weight: 400; }

  /* ——— Fiche lieu, façon Plans ——— */
  .share.left { left: 14px; right: auto; }
  .phead { text-align: center; margin: 0 44px; }
  .phead h1 { margin: 2px 0; }
  .glance { margin: 8px 0 0; text-align: center; font-size: 15px; display: flex; flex-wrap: wrap; justify-content: center; gap: 0 6px; }
  .glance .st { font-weight: 600; }
  .glance .is-open { color: var(--open); }
  .glance .is-closed { color: var(--closed); }
  .fresh { margin: 3px 0 0; text-align: center; font-size: 13px; color: var(--open); display: flex; justify-content: center; align-items: center; gap: 4px; }
  .fresh svg { width: 14px; height: 14px; stroke-width: 2.6; flex: none; }
  .info-btn { position: relative; border: 0; background: none; padding: 0; width: 22px; height: 22px; display: grid; place-items: center; color: var(--muted); cursor: pointer; }
  .info-btn svg { width: 17px; height: 17px; stroke-width: 1.8; }
  .info-btn .solid { fill: currentColor; }
  .info-btn::after { content: ''; position: absolute; inset: -11px; }   /* zone tactile de 44 px */
  .fresh.old { color: var(--muted); }
  /* Boutons d'action : même largeur, pictogramme au-dessus du texte ; un seul bouton prend toute la largeur */
  /* Boutons d'action (maquette B, 31/10/2026, inspirée de Plans) : 4 au plus, même largeur, plus larges que hauts,
     texte entier même agrandi (« Appe… » sur l'iPhone du porteur avant) ; fond teinté, l'itinéraire en plein. */
  .actions { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 6px; margin: 14px 0 0; }
  .action {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 50px; padding: 5px 2px;
    border-radius: 14px; border: 0; cursor: pointer; text-decoration: none; font-size: clamp(10.5px, 3vw, 11.5px); font-weight: 600; line-height: 1.1;
    background: var(--me-bg); color: var(--accent); box-sizing: border-box; min-width: 0;
  }
  .action span { white-space: nowrap; }
  .action:active { filter: brightness(0.94); }
  .action.primary { background: var(--accent-btn); color: #fff; }
  .action.primary .solid { fill: currentColor; }
  /* Bandeau : libellé discret au-dessus, valeur en gras, séparés par un trait */
  /* Infos clés en colonnes (horaires, note, distance…), un filet entre chaque */
  .strip { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); margin: 14px 0 0; }
  .strip div { padding: 0 6px; border-left: 1px solid var(--line); text-align: center; min-width: 0; }
  .strip div:first-child { border-left: 0; }
  .strip dt { font-size: 12.5px; color: var(--muted); }
  .strip dd { margin: 1px 0 0; font-size: 16px; font-weight: 650; }
  .strip dd.sub { margin: 0; font-size: 12px; font-weight: 500; color: var(--muted); line-height: 1.2; text-wrap: balance; }
  .strip .is-open { color: var(--open); }
  .strip .is-closed { color: var(--closed); }
  /* Rangée secondaire : Raccourci, Avis, Plus (fixe, rien de flottant) */
  .sec-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 6px; margin: 14px 0 0; }
  .sec-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 46px; padding: 4px 2px;
    border: 0; border-radius: 14px; background: var(--fill); color: var(--ink); font: inherit; font-size: clamp(10.5px, 3vw, 11.5px); font-weight: 600; cursor: pointer; min-width: 0; text-decoration: none; }
  .sec-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  .sec-btn .solid { fill: currentColor; stroke: none; }
  .sec-btn.on { color: var(--accent); }
  /* Sections du bas */
  .psec { margin-top: 22px; }
  .psec h2 { font-size: 17px; font-weight: 700; margin: 0 0 8px; }
  .psec .small { font-size: 14px; margin: 0 0 4px; }
  .link.ext { font-weight: 600; text-decoration: none; display: inline-block; padding: 6px 0; }
  .good { list-style: none; margin: 0; padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; background: var(--fill); border-radius: 14px; font-size: 14.5px; }
  .good li { display: flex; align-items: center; gap: 7px; }
  .good svg { width: 16px; height: 16px; flex: none; stroke-width: 2.4; color: var(--open); }
  .good li.no svg { color: var(--closed); }
  .details { margin: 0; background: var(--fill); border-radius: 14px; padding: 0 14px; }
  .details div { padding: 10px 0; border-top: 1px solid var(--line); }
  .details div:first-child { border-top: 0; }
  .details dt { font-size: 13px; color: var(--muted); }
  .details dd { margin: 2px 0 0; font-size: 15.5px; overflow-wrap: anywhere; }
  .details a { color: var(--accent); text-decoration: none; }
  .details .src, .details-src .src { display: block; font-size: 12.5px; color: var(--muted); margin-top: 1px; }
  .details-src { margin: 6px 0 0; }
  .contrib { margin: 14px 0 52px; font-size: 13px; line-height: 1.45; color: var(--muted); }
  .contrib a { color: var(--accent); text-decoration: none; font-weight: 600; }
  /* Barre flottante en bas à droite de la fiche */
  .action.save.on path { fill: currentColor; }
  .exit-go { display: inline-flex; align-items: baseline; border: 0; background: none; padding: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
  .action.primary .on-solid { stroke: var(--accent-btn); stroke-width: 2; }
  /* appui prolongé = copie (pas la sélection ni la bulle du système, qui la masqueraient) */
  .hold { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; cursor: copy; }
  .week { border-collapse: collapse; font-size: 15px; font-variant-numeric: tabular-nums; }
  .week th { text-align: left; font-weight: 400; color: var(--muted); padding: 4px 20px 4px 0; text-transform: capitalize; }
  .week td { padding: 4px 0; }
  .week tr.today th, .week tr.today td { color: var(--ink); font-weight: 600; }


  /* Prochains passages d'une station */
  .deps { margin: 18px 0 4px; }
  .deps h2 { font-size: 15px; font-weight: 700; margin: 0 0 6px; }
  .deps > p.muted { color: var(--muted); font-size: 14.5px; margin: 6px 0 10px; }
  .deps ul { list-style: none; margin: 0; padding: 0; }
  .deps li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; min-height: 48px; border-bottom: 1px solid var(--line); }
  .dep-dir { font-size: 15px; line-height: 1.25; min-width: 0; }
  .dep-times { font-size: 14px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; display: flex; align-items: center; gap: 2px; }
  .dep-times .first { color: var(--open); font-weight: 700; font-size: 15px; }
  .dep-times .live { width: 7px; height: 7px; border-radius: 50%; background: var(--open); margin-right: 6px; animation: pulse 2s ease-in-out infinite; }
  .exits { margin: 18px 0 4px; }
  .exits h2 { font-size: 15px; font-weight: 700; margin: 0 0 6px; }
  .exits ul { list-style: none; margin: 0; padding: 0; }
  .exits li { display: flex; align-items: center; min-height: 40px; border-bottom: 1px solid var(--line); font-size: 14.5px; gap: 2px; }
  .exit-tag { margin-left: auto; font-size: 12px; color: var(--muted); padding-left: 8px; white-space: nowrap; }

  @media (prefers-reduced-motion: reduce) {
    .dep-times .live { animation: none; }
  }
  .action :global(svg) { width: 19px; height: 19px; flex: none; }
  .in-lists { display: flex; width: fit-content; align-items: center; gap: 4px; max-width: 100%; min-height: 32px; margin: 2px auto 4px; padding: 0 12px 0 10px;
    border: 0; border-radius: 16px; background: var(--fill); color: var(--ink); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
  .in-lists span:last-child { margin-left: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ldot { flex: none; width: 10px; height: 10px; border-radius: 50%; }
</style>
