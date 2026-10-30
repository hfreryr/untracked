<!-- Avis libres (Mangrove, CC BY 4.0) dans la fiche, seulement s'il y en a (reviews.js). Moyenne affichée à partir de
     3 avis. Attribution demandée par Mangrove : la source, la licence et un lien. -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { starsText } from '#lib/reviews.js';
  /** @type {{ reviews: any }} */
  let { reviews } = $props();
  const month = (d) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
</script>

<section class="psec rev" aria-labelledby="rev-title">
  <h2 id="rev-title">{tx('avis.titre')}</h2>
  <p class="sum">
    {#if reviews.showAverage}
      <span class="avg">{reviews.average.toLocaleString('fr-FR')}</span>
      <span class="stars" aria-hidden="true">{starsText(Math.round(reviews.average))}</span>
      <span class="sr">{tx('avis.note_sur_5', { note: reviews.average.toLocaleString('fr-FR') })}</span>
    {/if}
    <span class="count">{tx('avis.n_avis', { n: reviews.count })}</span>
  </p>
  <ul>
    {#each reviews.latest as r (r.sig)}
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
  <p class="src">{tx('avis.source')} <a href="https://mangrove.reviews" target="_blank" rel="noopener">{tx('avis.mangrove')}</a>{tx('avis.licence')}</p>
</section>

<style>
  .rev { margin-top: 22px; }
  h2 { font-size: 17px; font-weight: 700; margin: 0 0 8px; }
  .sum { display: flex; align-items: baseline; gap: 6px; margin: 0 0 6px; font-size: var(--fs-body); }
  .avg { font-size: 22px; font-weight: 700; }
  .stars { color: #B26A00; letter-spacing: 1px; }
  .count { color: var(--muted); font-size: var(--fs-meta); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 10px 0; border-top: 1px solid var(--line); }
  .meta { margin: 0; font-size: var(--fs-meta); color: var(--muted); }
  .who { color: var(--ink); font-weight: 600; }
  .txt { margin: 4px 0 0; font-size: var(--fs-body); line-height: 1.4; overflow-wrap: anywhere; }
  .ph { margin: 4px 0 0; font-size: var(--fs-meta); color: var(--muted); }
  .src { margin: 8px 0 0; font-size: 12.5px; color: var(--muted); }
  .src a { color: inherit; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
