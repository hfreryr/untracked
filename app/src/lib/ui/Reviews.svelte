<!-- Avis dans la fiche : ceux de Mangrove (CC BY 4.0, rangés dans nos tuiles, reviews.js), le mien d'abord, et
     « Vous y êtes allé ? » pour en écrire un (étape 2, maquettes validées le 30/10/2026). Toucher une étoile ouvre la
     fenêtre avec cette note. L'avis part directement du téléphone vers Mangrove (mangrove.js), signé par une clé gardée
     sur le téléphone (reviewer.js) ; pseudo facultatif, bouton « Générer » (pseudo.js). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { getContext } from 'svelte';
  import { starsText } from '#lib/reviews.js';
  import { newKeyJwk, payloadOf, signReview, submit } from '#lib/mangrove.js';
  import { loadReviewer, saveReviewer, withMine, mineFor, placeId } from '#lib/reviewer.js';
  import { makePseudo } from '#lib/pseudo.js';
  import { takeIntent, earnedBy } from '#lib/contrib.js';
  import { badgeProgress } from '#lib/badges.js';
  import { reviewMeta } from '#lib/reviewmeta.js';
  import { shrink, uploadPhoto } from '#lib/photoupload.js';
  import Dialog from './Dialog.svelte';
  import LevelUp from './LevelUp.svelte';
  /** @type {{ place: any, reviews: any, hideRate?: boolean }} */
  // hideRate : sur place, l'invitation à noter est déjà en haut de la fiche (NearbyRate) ; pas de doublon ici
  let { place, reviews, hideRate = false } = $props();
  const app = getContext('app');

  let me = $state(loadReviewer());
  const mine = $derived(mineFor(me, place));
  const others = $derived((reviews?.latest || []).filter((r) => r.sig !== mine?.sig));
  const count = $derived((reviews?.count || 0) + (mine && !reviews?.latest?.some((r) => r.sig === mine.sig) ? 1 : 0));
  const month = (d) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // fenêtre d'avis
  let earned = $state(null);
  // photo jointe : réduite sur le téléphone (métadonnées effacées), envoyée à Mangrove seulement en publiant
  let photo = $state(null), photoUrl = $state(null);
  function pickPhoto(e) {
    const f = e.currentTarget.files?.[0]; e.currentTarget.value = '';
    if (!f) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    shrink(f).then((b) => { photo = b; photoUrl = URL.createObjectURL(b); }).catch(() => { failed = true; });
  }
  function dropPhoto() { if (photoUrl) URL.revokeObjectURL(photoUrl); photo = null; photoUrl = null; }
  let open = $state(false), stars = $state(0), text = $state(''), nick = $state(''), sending = $state(false), failed = $state(false);
  function start(n) {
    stars = n; text = mine?.text || ''; nick = mine?.nick ?? me.nick; failed = false; open = true;
  }
  // note touchée sur la carte « Comment était X ? » (ReviewAsk.svelte) : la fenêtre s'ouvre avec elle
  // (seulement une fois la fiche chargée : avant, la section peut être recréée et la fenêtre se perdrait)
  $effect(() => { if (app.info === null) return; const i = takeIntent(placeId(place)); if (i) start(i.stars); });
  // étoile touchée dans « Votre avis sur ce lieu » (NearbyRate.svelte, quand on est sur place)
  $effect(() => {
    const on = (e) => { if (e.detail?.id === placeId(place)) start(e.detail.stars); };
    window.addEventListener('avis-noter', on);
    return () => window.removeEventListener('avis-noter', on);
  });
  // avis publié avant le 01/11/2026 (sans position ni genre de lieu) : complété quand on rouvre sa fiche, sans annonce
  $effect(() => {
    const m = mine, info = app.info;
    if (!m || m.lat != null || !info) return;
    reviewMeta(place, info).then((meta) => {
      const cur = loadReviewer();
      const i = cur.mine.findIndex((x) => x.id === m.id);
      if (i < 0) return;
      cur.mine[i] = { ...cur.mine[i], ...meta };
      saveReviewer(cur);
      me = cur;
    }).catch(() => {});
  });
  async function publish() {
    if (!stars || sending) return;
    sending = true; failed = false;
    try {
      let r = me;
      if (!r.jwk) { r = { ...r, jwk: await newKeyJwk() }; saveReviewer(r); me = r; }
      const images = photo ? [await uploadPhoto(photo)] : [];
      const jwt = await signReview(r.jwk, payloadOf({ place, stars, text, nick, images }));
      const sig = await submit(jwt);
      // modifier = nouvel avis, puis l'ancien retiré (même clé) ; s'il ne part pas, la construction des données garde le plus récent
      if (mine?.sig) signReview(r.jwk, { sub: `urn:maresi:${mine.sig}`, action: 'delete', iat: Math.floor(Date.now() / 1000) }).then(submit).catch(() => {});
      // position, genre de lieu et commune : pour les badges et la carte de mes avis (badges.js)
      const meta = await reviewMeta(place, app.info).catch(() => ({ lat: +place.lat, lon: +place.lon }));
      const before = me.mine;
      me = withMine({ ...r, nick: nick.trim() }, { id: placeId(place), name: place.name || '', stars, text: text.trim(), nick: nick.trim(), t: Math.floor(Date.now() / 1000), sig, ...meta,
        ...(images[0] ? { photo: images[0] } : {}) });
      dropPhoto();
      saveReviewer(me);
      // niveau ou badge gagné par cet avis : annoncé maintenant, et seulement maintenant (LevelUp.svelte)
      const e = earnedBy(before, me.mine, badgeProgress);
      if (e.level || e.badges.length) earned = e;
      open = false;
      app.say(tx('avis.merci_publie'));
    } catch {
      failed = true;
    } finally {
      sending = false;
    }
  }
</script>

{#snippet starRow(big, value, pick)}
  <div class="stars-row" class:big role="radiogroup" aria-label={tx('avis.votre_note')}>
    {#each [1, 2, 3, 4, 5] as n}
      <button class="star" class:on={n <= value} role="radio" aria-checked={n === value} aria-label={tx('avis.n_etoiles', { n })} onclick={() => pick(n)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z" /></svg>
      </button>
    {/each}
  </div>
{/snippet}

<section class="psec rev" aria-labelledby="rev-title">
  <h2 id="rev-title">{tx('avis.titre')}</h2>
  {#if count}
    <p class="sum">
      {#if reviews?.showAverage}
        <span class="avg">{reviews.average.toLocaleString('fr-FR')}</span>
        <span class="stars" aria-hidden="true">{starsText(Math.round(reviews.average))}</span>
        <span class="sr">{tx('avis.note_sur_5', { note: reviews.average.toLocaleString('fr-FR') })}</span>
      {/if}
      <span class="count">{tx('avis.n_avis', { n: count })}</span>
    </p>
  {/if}

  {#if !mine && !hideRate}
    <div class="rate">
      <h3>{tx('avis.vous_y_etes_alle')}</h3>
      <p>{count ? tx('avis.touchez_une_note') : tx('avis.soyez_le_premier')}</p>
      {@render starRow(false, 0, start)}
    </div>
  {/if}

  <ul>
    {#if mine}
      <li class="mine">
        <p class="meta">
          <span class="stars" aria-hidden="true">{starsText(mine.stars)}</span>
          <span class="sr">{tx('avis.note_sur_5', { note: mine.stars })}</span>
          <span class="who">{tx('avis.votre_avis')}</span> · <span>{month(new Date(mine.t * 1000))}</span>
          <button class="link" onclick={() => start(mine.stars)}>{tx('avis.modifier')}</button>
        </p>
        {#if mine.text}<p class="txt">{mine.text}</p>{/if}
        {#if mine.photo}<img class="myph" src={mine.photo} alt={tx('avis.votre_photo')} referrerpolicy="no-referrer" />{/if}
      </li>
    {/if}
    {#each others as r (r.sig)}
      <li>
        <p class="meta">
          <span class="stars" aria-hidden="true">{starsText(r.stars)}</span>
          <span class="sr">{tx('avis.note_sur_5', { note: r.stars })}</span>
          <span class="who">{r.nick || tx('avis.anonyme')}</span> · <span>{month(r.date)}</span>
        </p>
        {#if r.text}<p class="txt">{r.text}</p>{/if}
        {#if r.photos}<p class="ph">{tx('avis.photos_sur_mangrove', { n: r.photos })}</p>{/if}
      </li>
    {/each}
  </ul>
  {#if count}
    <p class="src">{tx('avis.source')} <a href="https://mangrove.reviews" target="_blank" rel="noopener">{tx('avis.mangrove')}</a>{tx('avis.licence')}</p>
  {/if}
</section>

<!-- nouveau niveau ou badge : annoncé juste après l'avis qui le donne, jamais ailleurs -->
{#if earned && !open}<LevelUp {earned} mine={me.mine} onclose={() => (earned = null)} />{/if}

{#if open}
  <Dialog title={place.name} sub={tx('avis.votre_avis')} onclose={() => (open = false)}>
    {@render starRow(true, stars, (n) => (stars = n))}
    <label class="lbl" for="rev-text">{tx('avis.racontez')} <small>{tx('avis.facultatif')}</small></label>
    <textarea id="rev-text" bind:value={text} maxlength="1000" rows="4" placeholder={tx('avis.racontez_aide')}></textarea>
    <label class="lbl" for="rev-nick">{tx('avis.pseudo')} <small>{tx('avis.facultatif')}</small></label>
    <div class="nick">
      <input id="rev-nick" bind:value={nick} maxlength="40" autocomplete="off" placeholder={tx('avis.anonyme')} />
      <button class="gen" onclick={() => (nick = makePseudo())}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" /></svg>
        {tx('avis.generer')}
      </button>
    </div>
    <div class="addph">
      {#if photoUrl}
        <span class="thumb"><img src={photoUrl} alt={tx('avis.votre_photo')} /><button class="rm" onclick={dropPhoto} aria-label={tx('avis.retirer_la_photo')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg></button></span>
      {:else}
        <label class="pickph">
          <input type="file" accept="image/*" hidden onchange={pickPhoto} />
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          {tx('avis.ajouter_une_photo')} <small>{tx('avis.facultatif')}</small>
        </label>
      {/if}
      <p class="phnote">{tx('avis.photo_consigne')}</p>
    </div>
    <p class="note">{tx('avis.public_licence')}</p>
    {#if failed}<p class="err" role="alert">{tx('avis.envoi_impossible')}</p>{/if}
    <button class="go" disabled={!stars || sending} onclick={publish}>{sending ? tx('avis.envoi') : tx('avis.publier')}</button>
  </Dialog>
{/if}

<style>
  /* même écart que les autres sections de la fiche (le titre était collé au cadre « Détails », 31/10/2026) */
  .rev { margin-top: 22px; }
  h2 { font-size: 17px; font-weight: 700; margin: 0 0 8px; }
  .sum { display: flex; align-items: baseline; gap: 6px; margin: 0 0 8px; font-size: var(--fs-body); }
  .avg { font-size: 22px; font-weight: 700; }
  .stars { color: #B26A00; letter-spacing: 1px; }
  .count { color: var(--muted); font-size: var(--fs-meta); }
  .rate { margin: 0 0 6px; padding: 14px 16px 8px; border-radius: 16px; background: var(--fill); }
  .rate h3 { margin: 0; font-size: 16px; }
  .rate p { margin: 2px 0 4px; font-size: var(--fs-meta); color: var(--muted); }
  .stars-row { display: flex; gap: 2px; margin-left: -8px; }
  .star { width: 44px; height: 44px; border: 0; background: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: #B26A00; }
  .star svg { width: 30px; height: 30px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round; }
  .star.on svg { fill: #E39B17; }
  .big .star { width: 52px; height: 52px; }
  .big .star svg { width: 38px; height: 38px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 10px 0; border-top: 1px solid var(--line); }
  .rate + ul li:first-child { border-top: 0; }
  .meta { margin: 0; font-size: var(--fs-meta); color: var(--muted); display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; }
  .who { color: var(--ink); font-weight: 600; }
  .link { margin-left: auto; border: 0; background: none; padding: 6px 0; color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; }
  .txt { margin: 4px 0 0; font-size: var(--fs-body); line-height: 1.4; overflow-wrap: anywhere; }
  .ph { margin: 4px 0 0; font-size: var(--fs-meta); color: var(--muted); }
  .src { margin: 8px 0 0; font-size: 12.5px; color: var(--muted); }
  .src a { color: inherit; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .lbl { display: block; margin: 16px 0 6px; font-size: 14px; font-weight: 600; }
  .lbl small { font-weight: 400; color: var(--muted); }
  textarea, input { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; font: inherit; font-size: 16px;
    color: var(--ink); background: var(--card); }
  textarea { resize: vertical; min-height: 96px; }
  .nick { display: flex; gap: 8px; }
  .nick input { flex: 1; min-width: 0; height: 46px; }
  .gen { flex: none; height: 46px; padding: 0 16px; border: 0; border-radius: 14px; background: var(--fill); color: var(--accent); font: inherit; font-size: 15px;
    font-weight: 650; display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .gen svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .note { margin: 16px 0 0 !important; padding: 12px 14px; border-radius: 14px; background: var(--fill); font-size: 13.5px !important; line-height: 1.45; }
  .err { margin: 10px 0 0 !important; color: var(--closed, #C5221F); font-size: 14px !important; }
  .go { display: block; width: 100%; margin-top: 16px; height: 50px; border: 0; border-radius: 14px; background: var(--accent-btn); color: #fff; font: inherit;
    font-size: 16.5px; font-weight: 700; cursor: pointer; }
  .go:disabled { opacity: 0.5; cursor: default; }
  .addph { margin: 12px 0 0; }
  .pickph { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 12px; background: var(--fill);
    color: var(--accent); font-weight: 600; cursor: pointer; }
  .pickph small { color: var(--muted); font-weight: 400; }
  .pickph svg, .rm svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
  .thumb { position: relative; display: inline-block; }
  .thumb img { width: 96px; height: 96px; object-fit: cover; border-radius: 12px; display: block; }
  .rm { position: absolute; top: -8px; right: -8px; width: 32px; height: 32px; border-radius: 50%; border: 0; background: #2b2f36; color: #fff;
    display: grid; place-items: center; cursor: pointer; }
  .phnote { margin: 6px 0 0; font-size: 13px; color: var(--ink); }
  .myph { width: 120px; height: 120px; object-fit: cover; border-radius: 12px; margin-top: 6px; display: block; }
</style>
