<script>
  import Contributions from '#lib/ui/Contributions.svelte';
  import { loadReviewer } from '#lib/reviewer.js';
  import { levelOf } from '#lib/contrib.js';
  import { popover } from '#lib/popover.js';
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import ListDot from '#lib/ui/ListDot.svelte';
  import { LIST_ICONS, LIST_COLORS } from '#lib/myplaces.js';
  import PinnedRow from '#lib/ui/PinnedRow.svelte';
  import { draggable } from '#lib/sheet.js';
  import { fmtDistance, fmtWait } from '#lib/routing.js';
  import { momentLabel } from '#lib/hours.js';
  import { typeLabel } from '#lib/places.js';
  import { availableFilters } from '#lib/filters.js';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  let momentBtn = $state();
  // Filtres utiles pour ces lieux (filters.js) : un filtre actif passe en tête de rangée (maquette du 21/10)
  const LABEL = { terrasse: tx('filtre.terrasse'), vegetarien: tx('filtre.vegetarien'), emporter: tx('filtre.emporter'), fauteuil: tx('filtre.fauteuil') };
  const CRIT = { terrasse: tx('filtre.c_terrasse'), vegetarien: tx('filtre.c_vegetarien'), emporter: tx('filtre.c_emporter'), fauteuil: tx('filtre.c_fauteuil') };
  const choices = $derived(availableFilters(app.nearbyAll.map((n) => ({ t: n.t, sub: n.sub }))));
  const quand = () => (app.openAt?.now ? tx('horaires.maintenant') : momentLabel(app.openAt.at).replace(/ (\d)/, ' à $1'));
  const criteres = () => [...app.filters.map((k) => CRIT[k]), ...(app.openAt ? [tx('filtre.c_ouverts', { quand: quand() })] : [])].join(', ');
  // ligne « Mes contributions » : niveau et nombre d'avis
  const LEVEL_NAME = { eclaireur: () => tx('contrib.eclaireur'), passeur: () => tx('contrib.passeur'), vigie: () => tx('contrib.vigie'), phare: () => tx('contrib.phare') };
  function contribLine() { const n = loadReviewer().mine.length, l = levelOf(n).level; return tx('contrib.resume', { n, niveau: l ? LEVEL_NAME[l.id]() : '' }); }
</script>


    <section class="sheet" aria-label={app.category.label} use:draggable={app.category.saved ? { key: app.category.label, onDismiss: app.clearCategory } : { key: app.category.label, start: 'peek' }}>
      <button class="grip" aria-label={tx('liste.agrandir_la_fiche')}></button>
      <button class="close" onclick={app.clearCategory} aria-label={tx('liste.fermer_la_liste')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
      </button>
      {#if app.category.saved && !app.savedList && !app.category.shared && !app.hubPanel}
        <h1>{app.chipList.find((c) => c.key === 'saved')?.label || tx('resultats.mes_lieux')}</h1>
        <PinnedRow inSearch={false} />
        <h2 class="hub-h">{tx('liste.listes')}</h2>
        <ul class="hub-lists">
          {#each app.lists as l (l.id)}
            <li><button onclick={() => app.openSavedList(l.id)}>
              <ListDot l={l} size={34} />
              <span class="pl-name">{l.name}</span>
              <span class="pl-count">{app.favorites.filter((f) => f.lists.includes(l.id)).length}</span>
              <svg class="chev-r" viewBox="0 0 24 24" aria-hidden="true"><path d="m10 7 5 5-5 5" /></svg>
            </button></li>
          {/each}
          <li>
            {#if app.hubPanel === 'newlist'}{:else}
              <form class="new-list" onsubmit={(e) => { e.preventDefault(); app.createList(app.newListName); app.newListName = ''; }}>
                <input bind:value={app.newListName} placeholder={tx('liste.nouvelle_liste')} aria-label={tx('liste.nom_de_la_nouvelle_liste')} maxlength="40" />
                <button class="link" disabled={!app.newListName.trim()}>{tx('liste.creer')}</button>
              </form>
            {/if}
          </li>
        </ul>
        <!-- avis et niveaux (Contributions.svelte) -->
        <ul class="rows hub-rows">
          <li class="row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z" /></svg>
            <button class="row-btn" onclick={() => (app.hubPanel = 'contrib')}><span>{tx('contrib.titre')}<small class="why">{contribLine()}</small></span></button></li>
        </ul>
        <h2 class="hub-h">{tx('liste.vos_donnees')}</h2>
        <ul class="rows hub-rows">
          <li class="row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></svg>
            <button class="row-btn" onclick={() => { app.importOpen = true; }}><span>{tx('liste.importer_depuis_google_maps')}</span></button></li>
          <li class="row"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><path d="M13.5 13.5h3v3h-3zM18 18h2.5M20.5 13.5V16" /></svg>
            <button class="row-btn" onclick={app.makeTransfer}><span>{tx('liste.transferer_vers_un_autre_appareil')}</span></button></li>
          <li class="row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6-1.6A4.8 4.8 0 0 0 7 18.5z" /><path d="M12 11v5M9.8 13.2 12 11l2.2 2.2" /></svg>
            <button class="row-btn" onclick={() => (app.hubPanel = 'backup')}><span>{tx('liste.sauvegarder')}<small class="why" class:warn={app.favorites.length >= 5 && (app.backupAge === null || app.backupAge > 30)}>{app.backupAge === null ? tx('liste.jamais_sauvegarde') : app.backupAge === 0 ? tx('liste.derniere_sauvegarde_aujourd_hui') : tx('liste.derniere_sauvegarde_il_y_a_jour', { n: app.backupAge })}</small></span></button></li>
          <li class="row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" /></svg>
            <button class="row-btn" onclick={() => (app.hubPanel = 'restore')}><span>{tx('liste.restaurer_une_sauvegarde')}</span></button></li>
          <li class="row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
            <button class="row-btn" onclick={() => { app.clearCategory(); app.editChips = true; }}><span>{tx('recherche.personnaliser_les_raccourcis')}</span></button></li>
        </ul>
        <p class="credit">{tx('liste.vos_lieux_restent_sur_cet_appareil')}</p>
      {:else if app.category.saved && app.hubPanel === 'contrib'}
        <button class="link back-link" onclick={() => (app.hubPanel = null)}>{tx('liste.mes_lieux')}</button>
        <h1>{tx('contrib.titre')}</h1>
        <Contributions />
      {:else if app.category.saved && app.hubPanel === 'transfer'}
        <button class="link back-link" onclick={() => (app.hubPanel = null)}>{tx('liste.mes_lieux')}</button>
        <h1>{tx('liste.transferer')}</h1>
        <p class="kind">{tx('liste.ouvrez_ce_lien_ou_scannez_ce_code')}</p>
        {#if !app.transfer}<p class="muted">{tx('liste.preparation')}</p>
        {:else}
          {#if app.transfer.qr}<div class="qr" aria-label={tx('liste.qr_code_de_transfert')}>{@html app.transfer.qr}</div>
          {:else}<p class="credit">{tx('liste.trop_de_lieux_pour_un_qr_code')}</p>{/if}
          <button class="go wide done" onclick={app.shareTransfer}>{tx('liste.envoyer_le_lien')}</button>
          <p class="credit">{tx('liste.ce_lien_contient_tous_vos_lieux')}</p>
        {/if}
      {:else if app.category.saved && app.hubPanel === 'backup'}
        <button class="link back-link" onclick={() => (app.hubPanel = null)}>{tx('liste.mes_lieux')}</button>
        <h1>{tx('liste.sauvegarder')}</h1>
        <p class="kind">{tx('liste.un_fichier_avec_vos_listes_maison')}</p>
        <label class="pw">{tx('liste.mot_de_passe_facultatif_pour')}
          <input type="password" bind:value={app.backupPassword} autocomplete="new-password" placeholder={tx('liste.aucun')} /></label>
        {#if app.backupPassword}<p class="credit">{tx('liste.sans_ce_mot_de_passe_personne_ne')}</p>{/if}
        <button class="go wide done" onclick={app.makeBackup}>{tx('liste.creer_la_sauvegarde')}</button>
      {:else if app.category.saved && app.hubPanel === 'restore'}
        <button class="link back-link" onclick={() => { app.hubPanel = null; app.restoreNeedsPw = false; }}>{tx('liste.mes_lieux')}</button>
        <h1>{tx('liste.restaurer')}</h1>
        <p class="kind">{tx('liste.choisissez_un_fichier_de_sauvegarde')}</p>
        {#if app.restoreNeedsPw}
          <label class="pw">{tx('liste.ce_fichier_est_protege_mot_de_passe')}
            <input type="password" bind:value={app.restorePassword} autocomplete="current-password" /></label>
          <button class="go wide done" onclick={() => app.doRestore()}>{tx('liste.restaurer')}</button>
        {:else}
          <label class="action primary import-btn">
            <input type="file" accept=".json,application/json" hidden onchange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; app.doRestore(f); }} />
            {tx('liste.choisir_le_fichier')}
          </label>
        {/if}
      {:else if app.category.saved}
        {@const l = app.category.shared ? app.category : app.listOf(app.savedList)}
        {#if !app.category.shared}<button class="link back-link" onclick={() => { app.savedList = null; app.refreshSaved(); }}>{tx('liste.mes_lieux')}</button>{/if}
        <h1 class="list-title"><ListDot l={l} size={30} />{l.name || app.category.label}</h1>
        <p class="kind">{app.category.shared ? tx('liste.liste_partagee_lieu', { n: app.nearby.length }) : app.nearby.length ? tx('liste.lieu', { n: app.nearby.length, ordre: app.nearbyFromMe ? tx('liste.les_plus_proches_de_vous_abord') : tx('liste.par_distance') }) : tx('liste.aucun_lieu_pour_instant_touchez')}</p>
        <div class="list-actions">
          {#if app.category.shared}
            <button class="go" onclick={app.keepIncomingList}>{tx('liste.ajouter_a_mes_lieux')}</button>
          {:else}
            <button class="link" onclick={() => { app.listEditing = !app.listEditing; app.swiped = null; }}>{app.listEditing ? tx('enregistrer.termine') : tx('liste.modifier')}</button>
            {#if app.nearby.length && !app.listEditing}<button class="link" onclick={() => app.shareList(l)}>{tx('liste.partager')}</button>{/if}
            <button class="link" onclick={() => app.renameList(l)}>{tx('liste.renommer')}</button>
            {#if !['fav', 'todo'].includes(l.id)}<button class="link danger" onclick={() => app.deleteList(l)}>{tx('liste.supprimer')}</button>{/if}
          {/if}
        </div>
        {#if app.listEditing && !app.category.shared}
          <!-- pictogramme et couleur de la liste -->
          <div class="list-style" role="group" aria-label={tx('liste.apparence_de_la_liste')}>
            <div class="ls-row">
              {#each LIST_ICONS as ic}
                <button class="ls-btn" class:on={l.icon === ic} aria-pressed={l.icon === ic} aria-label={tx('liste.pictogramme', { nom: ic })}
                  onclick={() => app.setListStyle(l, { icon: ic })}><ListDot l={{ ...l, icon: ic }} size={30} /></button>
              {/each}
            </div>
            <div class="ls-row">
              {#each LIST_COLORS as col}
                <button class="ls-color" class:on={l.color === col} aria-pressed={l.color === col} aria-label={tx('liste.couleur')}
                  style:background={col} onclick={() => app.setListStyle(l, { color: col })}></button>
              {/each}
            </div>
          </div>
        {/if}
      {:else}
      <h1>{app.chipList.find((c) => c.key === app.category.key)?.label || app.category.label}</h1>
      {@const pref = app.chipPrefs.findIndex((x) => x.key === app.category.key)}
      {#if pref >= 0 && app.chipPrefs[pref].hidden}
        <!-- catégorie trouvée par la recherche mais absente des raccourcis : on propose de l'y ajouter (tests P3 et P4) -->
        <button class="link add-chip" onclick={() => { app.toggleChip(pref); app.say(tx('liste.raccourci_ajoute', { nom: app.category.label })); }}>
          {tx('liste.ajouter_aux_raccourcis', { nom: app.category.label })}
        </button>
      {/if}
      {#if app.filters.length && app.openCounts}
        <p class="kind">{tx('liste.n_correspondent', { n: app.openCounts.open, criteres: criteres() })}</p>
      {:else if app.category.results && !app.openAt}
        <p class="kind">{app.nearbyDone ? tx('resultats.n_resultats', { n: app.nearby.length, ordre: app.nearbyFromMe ? tx('liste.les_plus_proches_de_vous_abord') : tx('liste.par_distance') }) : tx('resultats.recherche')}</p>
      {:else if app.openAt && app.openCounts}
        <p class="kind">{app.openCounts.open ? tx('liste.n_ouverts', { n: app.openCounts.open, quand: app.openAt.now ? tx('horaires.maintenant') : momentLabel(app.openAt.at).replace(/ (\d)/, ' à $1') }) : tx('liste.aucun_ouvert_dans_cette_zone', { quand: app.openAt.now ? tx('horaires.maintenant') : momentLabel(app.openAt.at).replace(/ (\d)/, ' à $1') })}</p>
      {:else}
        <p class="kind">{app.nearby.length ? (app.nearbyFromMe ? tx('liste.les_plus_proches_de_vous') : tx('liste.autour_du_centre_de_la_carte')) : app.nearbyDone ? tx('liste.aucun_dans_cette_zone_deplacez_la') : tx('resultats.recherche')}</p>
      {/if}
      {#if !app.category.transit}
        <div class="open-pills">
          {#each app.filters as k (k)}
            <button class="opill on" aria-pressed="true" onclick={() => app.toggleFilter(k)} aria-label={tx('filtre.retirer', { nom: LABEL[k] })}>
              {LABEL[k]}<svg class="x" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
            </button>
          {/each}
          <button class="opill" class:on={app.openAt?.now} aria-pressed={!!app.openAt?.now} onclick={() => app.setOpenAt(app.openAt?.now ? null : { now: true })}>{tx('liste.ouvert_maintenant')}</button>
          <button class="opill" bind:this={momentBtn} class:on={!!app.openAt?.at} aria-expanded={app.momentPicker} onclick={() => (app.momentPicker = !app.momentPicker)}>
            {app.openAt?.at ? momentLabel(app.openAt.at).replace(/^./, (x) => x.toUpperCase()) : tx('liste.ouvert_a')}
            <svg viewBox="0 0 24 24" aria-hidden="true" class="chev" class:flip={app.momentPicker}><path d="m7 10 5 5 5-5" /></svg>
          </button>
          {#if app.openAt}<button class="opill-x" onclick={() => app.setOpenAt(null)} aria-label={tx('liste.retirer_le_filtre_horaires')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg></button>{/if}
          {#each choices.filter((k) => !app.filters.includes(k)) as k (k)}
            <button class="opill" aria-pressed="false" onclick={() => app.toggleFilter(k)}>{LABEL[k]}</button>
          {/each}
        </div>
        {#if app.momentPicker}
          <div class="moment" use:popover={{ trigger: () => momentBtn, close: () => (app.momentPicker = false), place: 'below', align: 'start' }}>
            <div class="moment-quick">
              <button onclick={() => app.quickMoment('midi')}>{tx('liste.midi')}</button>
              <button onclick={() => app.quickMoment('soir')}>{tx('liste.ce_soir')}</button>
              <button onclick={() => app.quickMoment('demain-soir')}>{tx('liste.demain_soir')}</button>
            </div>
            <div class="moment-sel">
              <select aria-label={tx('liste.jour')} value={app.pickerDay} onchange={(e) => { const [h, m] = app.pickerTime.split(':').map(Number); app.setOpenAt({ at: app.momentFrom(+e.currentTarget.value, h, m) }); app.momentPicker = true; }}>
                {#each app.pickerDays as d}<option value={d.i}>{d.label}</option>{/each}
              </select>
              <select aria-label={tx('liste.heure')} value={app.pickerTime} onchange={(e) => { const [h, m] = e.currentTarget.value.split(':').map(Number); app.setOpenAt({ at: app.momentFrom(app.pickerDay, h, m) }); app.momentPicker = true; }}>
                {#each app.pickerHours as [h, m]}<option value={`${h}:${m}`}>{h} h {m ? '30' : ''}</option>{/each}
              </select>
            </div>
          </div>
        {/if}
      {/if}
      {/if}
      <ul class="nearby">
        {#each app.nearby as { f, d, st, deps: sd, saved: sv } (f.id)}
          <li class:swipe-row={app.category.saved && app.savedList && sv} class:swiped={app.swiped === f.id || (app.listEditing && app.savedList && sv)}
            ontouchstart={app.category.saved && app.savedList && sv ? (e) => (app.swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, id: f.id }) : undefined}
            ontouchmove={app.category.saved && app.savedList && sv ? (e) => {
              if (!app.swipeStart) return;
              const dx = e.touches[0].clientX - app.swipeStart.x, dy = e.touches[0].clientY - app.swipeStart.y;
              if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5) { app.swiped = dx < 0 ? app.swipeStart.id : null; app.swipeStart = null; }
            } : undefined}>
            {#if app.category.saved && app.savedList && sv}
              <button class="swipe-del" onclick={() => app.removeFromList(sv, app.savedList)} aria-label={tx('liste.retirer_de_la_liste', { name: sv.name })}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M10.5 10.5v6M13.5 10.5v6" /></svg>
              </button>
            {/if}
            {#if !(app.category.saved && (app.hubPanel || (!app.savedList && !app.category.shared)))}
            <button class="n-main" onclick={() => { if (app.swiped) { app.swiped = null; return; } app.nearby.find((n) => n.f === f)?.res ? app.openResult(app.nearby.find((n) => n.f === f).res, app.nearby.findIndex((n) => n.f === f)) : app.nearby.find((n) => n.f === f)?.saved ? app.openPlace({ ...app.nearby.find((n) => n.f === f).saved }) : app.openFeature(f); }}>
              <span class="n-dot" style:--fam={app.category.saved ? (app.category.shared ? app.category.color : app.listOf(app.nearby.find((n) => n.f === f)?.saved?.lists?.[0]).color) : app.famColor(app.category)} aria-hidden="true"></span>
              <span class="r-text">
                <span class="r-name">{app.displayName(f, app.category)}</span>
                {#if app.category.transit}
                  {#if sd?.status === 'ok'}
                    {#each sd.data.lines.slice(0, 4) as l}
                      <span class="n-dep">
                        <span class="badge small" class:round={l.mode === 'SUBWAY' || l.mode === 'METRO'} style:background={l.color} style:color={l.textColor}>{l.line}</span>
                        <span class="n-dir">{l.headsign}</span>
                        <span class="n-time">{l.times.slice(0, 2).map((d) => fmtWait(d, app.now)).join(" · ")}</span>
                      </span>
                    {/each}
                  {:else if sd?.status === 'loading'}
                    <span class="r-meta">{tx('liste.prochains_passages')}</span>
                  {:else if sd?.status === 'none'}
                    <span class="r-meta">{tx('liste.aucun_passage_dans_heure')}</span>
                  {:else}
                    <span class="r-meta">{tx('liste.touchez_pour_les_horaires', { type: typeLabel('', f.properties.subclass) || tx('liste.station') })}</span>
                  {/if}
                {:else}
                <span class="r-meta">{app.category.results ? [app.nearby.find((n) => n.f === f)?.res?.type, app.nearby.find((n) => n.f === f)?.res?.address].filter(Boolean).join(' · ') : app.category.saved ? [app.nearby.find((n) => n.f === f)?.saved?.type, app.nearby.find((n) => n.f === f)?.saved?.address].filter(Boolean).join(' · ') || tx('liste.lieu_enregistre') : typeLabel('', f.properties.subclass) || app.category.label}{#if st?.open != null}{' · '}<span class:is-open={st.open} class:is-closed={!st.open}>{st.label}</span>{/if}</span>
                {/if}
              </span>
              <span class="n-dist">{fmtDistance(d)}</span>
            </button>
            {/if}
          </li>
        {/each}
      </ul>
      {#if (app.openAt || app.filters.length) && app.openCounts?.unknown && !app.category?.saved}
        <button class="unknown-row" onclick={() => { app.showUnknown = !app.showUnknown; app.applyOpenFilter(); }}>
          {#if app.filters.length}
            {tx('liste.les_lieux_sans_information', { action: app.showUnknown ? tx('liste.masquer') : tx('liste.afficher'), n: app.openCounts.unknown })}
            <small>{tx('liste.personne_ne_l_a_indique')}</small>
          {:else}
            {tx('liste.les_lieux_aux_horaires_inconnus', { action: app.showUnknown ? tx('liste.masquer') : tx('liste.afficher'), n: app.openCounts.unknown })}
            <small>{tx('liste.personne_ne_les_a_encore_indiques')}</small>
          {/if}
        </button>
      {/if}
    </section>

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  input {
    border: 0; background: none; font: inherit; font-size: 17px; color: var(--ink);
    padding: 12px 0; min-width: 0; outline: none; width: 100%;
  }
  input::placeholder { color: var(--muted); }
  input::-webkit-search-cancel-button { display: none; }
  .r-text { display: grid; gap: 1px; min-width: 0; }
  .r-name { font-size: 16px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .r-meta { font-size: 14px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .link { border: 0; background: none; color: var(--accent); font: inherit; font-weight: 500; cursor: pointer; padding: 4px 0; }

  /* ——— Fiches ——— */
  .close {
    position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 50%;
    border: 0; background: var(--fill); cursor: pointer; display: grid; place-items: center; color: var(--muted);
  }
  .close svg { width: 16px; height: 16px; stroke-width: 2.4; }
  /* Zone de toucher d'au moins 44 px autour des petits boutons ronds */
  .close::after { content: ''; position: absolute; inset: -6px; }
  .hub-h { font-size: 15px; font-weight: 700; margin: 18px 0 4px; }
  .hub-lists { list-style: none; margin: 0; padding: 0; }
  .hub-lists > li > button {   /* (pas le bouton « Créer » du champ de nouvelle liste : il écrasait le champ à 0 px) */ display: grid; grid-template-columns: 34px 1fr auto auto; gap: 12px; align-items: center; width: 100%;
    min-height: 52px; border: 0; background: none; padding: 0; text-align: left; cursor: pointer; border-bottom: 1px solid var(--line); font-size: 16px; }
  .pl-count { color: var(--muted); font-size: 14px; font-variant-numeric: tabular-nums; }
  .chev-r { width: 18px; height: 18px; color: var(--faint); }
  .new-list { display: flex; gap: 8px; align-items: center; min-height: 50px; border-bottom: 1px solid var(--line); }
  .new-list input { flex: 1; border: 0; background: none; font: inherit; font-size: 16px; color: var(--ink); padding: 10px 0; min-width: 0; }
  .new-list .link:disabled { opacity: 0.4; }
  .go.wide.done { width: 100%; margin: 14px 0 4px; height: 46px; background: var(--accent-btn); }
  .hub-rows .row-btn span { display: grid; }
  .why.warn { color: #D0731B; font-weight: 600; }
  .back-link { margin: 6px 0 2px; font-size: 15px; }
  .list-title { display: flex; align-items: center; gap: 10px; }
  .list-actions { display: flex; gap: 18px; align-items: center; margin-top: 8px; }
  .list-actions .link { font-size: 15px; }
  .link.danger { color: var(--closed); }
  .qr { display: grid; place-items: center; margin: 14px auto 4px; width: min(260px, 70vw); background: #fff; border-radius: 12px; padding: 8px; }
  .qr :global(svg) { width: 100%; height: auto; display: block; }
  .pw { display: grid; gap: 6px; font-size: 14px; color: var(--muted); margin-top: 14px; }
  .pw input { font: inherit; font-size: 16px; color: var(--ink); background: var(--fill); border: 0; border-radius: 12px; padding: 12px 14px; }
  .swipe-row { position: relative; overflow: hidden; }
  .nearby button { box-sizing: border-box; }
  .swipe-row .n-main { position: relative; z-index: 1; background: var(--card); transition: width 0.2s ease; }
  /* Poubelle visible : la ligne se rétrécit (le texte reste lisible) au lieu de glisser hors de la fiche */
  .swipe-row.swiped .n-main { width: calc(100% - 72px); }
  .nearby .swipe-del { position: absolute; padding: 0; right: 0; top: 0; bottom: 0; width: 72px; border: 0; border-top: 1px solid var(--line);
    background: var(--closed); color: #fff; display: grid; grid-template-columns: 1fr; place-items: center; cursor: pointer; }
  .nearby button.swipe-del:hover { background: color-mix(in srgb, var(--closed) 85%, #000); }
  /* Ordinateur (souris) : au survol d'une ligne, une petite poubelle remplace la distance */
  @media (hover: hover) and (pointer: fine) {

    .swipe-row:not(.swiped) .swipe-del { z-index: 2; top: 50%; bottom: auto; right: 14px; width: 38px; height: 38px; margin-top: -19px;
      border: 0; border-radius: 50%; background: var(--fill); color: var(--closed); opacity: 0; transition: opacity 0.12s; }
    .swipe-row:not(.swiped):hover .swipe-del, .swipe-row:not(.swiped) .swipe-del:focus-visible { opacity: 1; }
    .nearby .swipe-row:not(.swiped) button.swipe-del:hover { background: color-mix(in srgb, var(--closed) 16%, var(--card)); }
    .swipe-row:not(.swiped):hover .n-dist { visibility: hidden; }
  }
  .swipe-del svg { width: 22px; height: 22px; stroke-width: 2; }
  .close ~ h1 { margin-right: 44px; }
  h1 { font-size: 24px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; margin: 2px 44px 2px 0; text-wrap: balance; }
  .kind { margin: 0; color: var(--muted); font-size: 15px; }
  .kind::first-letter { text-transform: uppercase; }
  .r-meta .is-open { color: var(--open); }
  .r-meta .is-closed { color: var(--closed); }
  .muted { color: var(--muted); font-weight: 400; }

  /* ——— Filtre « ouvert à… » ——— */
  /* la rangée défile jusqu'au bord de l'écran : la dernière pastille coupée montre qu'il y en a d'autres (règle 9) */
  .open-pills { display: flex; gap: 8px; margin: 10px calc(-1 * var(--gutter)) 2px 0; padding-right: var(--gutter); align-items: center; overflow-x: auto; scrollbar-width: none; }
  .opill .x { width: 14px; height: 14px; margin-left: 2px; stroke-width: 2.4; }
  .open-pills > * { flex: none; }
  .opill { display: inline-flex; align-items: center; gap: 4px; height: 34px; padding: 0 12px; border-radius: 17px; border: 1px solid var(--line);
    background: var(--card); color: var(--ink); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  .opill .chev { width: 16px; height: 16px; }
  .opill.on { background: var(--accent-btn); border-color: var(--accent-btn); color: #fff; }
  .opill.on .chev { color: #fff; }
  .opill-x { width: 34px; height: 34px; border-radius: 50%; border: 0; background: var(--fill); color: var(--muted); display: grid; place-items: center; cursor: pointer; }
  .opill-x svg { width: 15px; height: 15px; stroke-width: 2.4; }
  /* menu flottant (popover.js) : entier à l'écran, au-dessus de la fiche */
  .moment { width: min(360px, calc(100vw - 32px)); box-sizing: border-box; padding: 12px; background: var(--card); border-radius: 16px;
    box-shadow: var(--shadow-float); display: grid; gap: 8px; }
  .moment-quick { display: flex; gap: 6px; flex-wrap: wrap; }
  .moment-quick button { height: 32px; padding: 0 12px; border-radius: 16px; border: 0; background: var(--fill); color: var(--accent); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  .moment-sel { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .moment-sel select { font: inherit; font-size: 16px; color: var(--ink); background: var(--fill); border: 0; border-radius: 10px; padding: 9px 10px; }
  .unknown-row { display: block; width: 100%; text-align: left; border: 0; border-top: 1px solid var(--line); background: none; padding: 14px 0 4px;
    font: inherit; font-size: 15px; font-weight: 600; color: var(--accent); cursor: pointer; }
  .unknown-row small { display: block; font-weight: 400; font-size: 13px; color: var(--muted); margin-top: 3px; }
  .action {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 56px; padding: 6px 4px;
    border-radius: 14px; border: 0; cursor: pointer; text-decoration: none; font-size: 13.5px; font-weight: 600; line-height: 1.1;
    background: var(--fill); color: var(--accent); box-sizing: border-box; min-width: 0;
  }
  .action:active { filter: brightness(0.94); }
  .action :global(svg) { width: 21px; height: 21px; flex: none; }
  .action.primary { background: var(--accent-btn); color: #fff; }

  .rows { list-style: none; margin: 16px 0 0; padding: 0; border-top: 1px solid var(--line); }
  .row { display: grid; grid-template-columns: 24px 1fr; gap: 16px; align-items: center; min-height: 52px; border-bottom: 1px solid var(--line); font-size: 15.5px; }
  .row > svg { width: 22px; height: 22px; color: var(--accent); }
  .row-btn { display: flex; justify-content: space-between; align-items: center; border: 0; background: none; padding: 14px 0; cursor: pointer; text-align: left; }
  .chev { width: 20px; height: 20px; color: var(--muted); transition: transform 200ms; }
  .chev.flip { transform: rotate(180deg); }

  .nearby { list-style: none; margin: 12px calc(-1 * var(--gutter)) 0; padding: 0; }
  .nearby button {
    display: grid; grid-template-columns: 20px 1fr auto; gap: 14px; align-items: center; width: 100%;
    border: 0; background: none; padding: 10px var(--gutter); text-align: left; cursor: pointer; border-top: 1px solid var(--line);
  }
  .nearby button:hover { background: var(--fill); }
  .n-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--fam); box-shadow: 0 0 0 2px var(--card), 0 0 0 3px var(--line); justify-self: center; }
  .n-dist { color: var(--muted); font-size: 14px; font-variant-numeric: tabular-nums; }
  .n-dep { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 6px; font-size: 13.5px; margin-top: 3px; }
  .n-dir { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .n-time { font-weight: 600; color: var(--open); font-variant-numeric: tabular-nums; }
  .why { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; line-height: 1.35; }
  .import-btn { display: flex; justify-content: center; align-items: center; min-height: 48px; border-radius: 14px; cursor: pointer; font-weight: 600; }

  @media (prefers-reduced-motion: reduce) {

    .chev { animation: none; transition: none; }
  }
  .list-style { display: grid; gap: 10px; margin: 10px 0 4px; }
  .ls-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .ls-btn { padding: 2px; border: 2px solid transparent; border-radius: 50%; background: none; cursor: pointer; line-height: 0; }
  .ls-btn.on { border-color: var(--accent); }
  .ls-color { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--card); box-shadow: 0 0 0 1px var(--line); cursor: pointer; }
  .ls-color.on { box-shadow: 0 0 0 2px var(--accent); }
  .add-chip { display: block; margin: 2px 0 4px; }
</style>
