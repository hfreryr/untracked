<script>
  import { swipeClose } from '#lib/swipeclose.js';
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';

  // État et actions de la page (voir le bloc « app » de +page.svelte)
  const app = getContext('app');
  const panoScroll = (node, rel) => app.panoScroll(node, rel);   // action définie dans la page
  import { placePhotos } from '#lib/placephotos.js';
  // toutes les photos du lieu (avis, Wikimedia, site), dans l'ordre du bandeau de la fiche
  const list = $derived(placePhotos(app.wiki, app.info));
</script>


  {#if app.viewer === 'facade' && app.info?.facade}
    <!-- Devanture en plein écran : la photo 360° entière, qu'on fait défiler ; ouverte sur le lieu -->
    <div class="viewer" role="dialog" aria-modal="true" aria-label={tx('photos.devanture_de', { title: app.title })} use:swipeClose={{ onclose: () => (app.viewer = null) }}>
      <div class="pano" use:panoScroll={app.info.facade.rel}>
        <img src={app.info.facade.src} alt={tx('photos.vue_a_360_devant', { title: app.title })} draggable="false" />
      </div>
      <div class="viewer-top">
        <span>{tx('photos.vue_de_la_rue_faites_defiler_pour')}</span>
        <button class="viewer-close" onclick={() => (app.viewer = null)} aria-label={tx('photos.fermer')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
        </button>
      </div>
      <p class="viewer-credit"><a href={app.info.facade.page} target="_blank" rel="noopener">{tx('photos.photo_ouvrir_dans_panoramax', { credit: app.info.facade.credit, date: app.info.facade.date ? ` · ${app.info.facade.date.slice(0, 4)}` : '' })}</a></p>
    </div>
  {:else if app.viewer != null && list.length}
    {@const ph = list[app.viewerIdx] || list[0]}
    <div class="viewer" role="dialog" aria-modal="true" aria-label={tx('photos.photos_de', { title: app.title })}>
      <div class="viewer-strip" class:zoomed={app.zoom.s > 1} bind:this={app.viewerEl} style:transform={app.dragY ? `translateY(${app.dragY}px)` : null}
        style:opacity={app.dragY ? Math.max(0.3, 1 - app.dragY / 500) : null}
        ontouchstart={app.zoomStart} ontouchmove={app.zoomMove} ontouchend={app.zoomEnd} ondblclick={(e) => app.toggleZoom(e.clientX, e.clientY)}
        onscroll={(e) => { const i = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth); if (i !== app.viewerIdx) { app.viewerIdx = i; app.zoom = { s: 1, x: 0, y: 0 }; } }}>
        {#each list as p, i (p.src)}
          <div class="viewer-slide"><img src={Math.abs(i - app.viewerIdx) <= 1 ? p.full : p.src} alt={i === 0 ? app.title : ''} draggable="false"
            crossorigin={p.cors ? 'anonymous' : undefined} referrerpolicy={p.referrer}
            style:transform={i === app.viewerIdx && app.zoom.s > 1 ? `translate(${app.zoom.x}px, ${app.zoom.y}px) scale(${app.zoom.s})` : null} /></div>
        {/each}
      </div>
      <div class="viewer-top">
        <span>{app.viewerIdx + 1} / {list.length}</span>
        <button class="viewer-close" onclick={() => (app.viewer = null)} aria-label={tx('photos.fermer')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
        </button>
      </div>
      {#if list.length > 1}
        <button class="viewer-nav prev" disabled={app.viewerIdx === 0} aria-label={tx('photos.photo_precedente')}
          onclick={() => app.viewerEl.scrollBy({ left: -app.viewerEl.clientWidth, behavior: 'smooth' })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
        <button class="viewer-nav next" disabled={app.viewerIdx === list.length - 1} aria-label={tx('photos.photo_suivante')}
          onclick={() => app.viewerEl.scrollBy({ left: app.viewerEl.clientWidth, behavior: 'smooth' })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
      {/if}
      <p class="viewer-credit">{#if ph.page}<a href={ph.page} target="_blank" rel="noopener">{ph.credit}</a>{:else}{ph.credit}{/if}</p>
    </div>
  {/if}

<style>
  svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .viewer { position: fixed; inset: 0; z-index: 20; background: #000; color: #fff; }
  .viewer-strip { position: absolute; inset: 0; display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
    touch-action: pan-x; transition: opacity 0.15s; }
  .viewer-strip.zoomed { overflow: hidden; touch-action: none; }
  .viewer-slide img { transition: transform 0.12s ease-out; will-change: transform; user-select: none; -webkit-user-drag: none; }
  .viewer-strip::-webkit-scrollbar { display: none; }
  .viewer-slide { flex: none; width: 100%; height: 100%; display: grid; place-items: center; scroll-snap-align: center; }
  .viewer-slide img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .viewer-top { position: absolute; left: 0; right: 0; top: 0; display: flex; justify-content: space-between; align-items: center;
    padding: calc(10px + env(safe-area-inset-top)) 12px 10px 18px; font-size: 15px; font-weight: 600;
    background: linear-gradient(rgb(0 0 0 / 0.55), transparent); }
  .viewer-close, .viewer-nav { width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgb(255 255 255 / 0.16); color: #fff;
    display: grid; place-items: center; cursor: pointer; }
  .viewer-close svg, .viewer-nav svg { width: 22px; height: 22px; stroke-width: 2.2; }
  .viewer-nav { position: absolute; top: 50%; transform: translateY(-50%); }
  .viewer-nav.prev { left: 12px; }
  .viewer-nav.next { right: 12px; }
  .viewer-nav:disabled { opacity: 0; pointer-events: none; }
  @media (hover: none) {

 .viewer-nav { display: none; }
  }
  .viewer-credit { position: absolute; left: 0; right: 0; bottom: 0; margin: 0; padding: 14px 18px calc(14px + env(safe-area-inset-bottom));
    font-size: 12.5px; background: linear-gradient(transparent, rgb(0 0 0 / 0.6)); }
  .viewer-credit a { color: rgb(255 255 255 / 0.85); text-decoration: none; }
  .pano { position: absolute; inset: 0; overflow-x: auto; overflow-y: hidden; display: flex; align-items: center; scrollbar-width: none; }
  .pano img { height: min(100vh, 50vw * 1); max-width: none; display: block; }
  @media (max-aspect-ratio: 1/1) {

 .pano img { height: 60vh; }
  }
</style>
