// Nouvelle version de l'app (porteur, 04/11/2026 : « elle m'a demandé de mettre à jour 10 min après, je regardais une
// ancienne version sans le savoir »). GitHub Pages sert tout avec « max-age=600 » : le navigateur garde 10 min le
// fichier de version et la page. On lit donc notre fichier de version sans cache (adresse unique, cache: 'no-store'),
// et on recharge sur une adresse nouvelle (?v=…) pour ne pas retomber sur la page gardée en cache.
// Notre propre fichier (_app/version.json) : aucun service tiers.

/** Version en ligne, ou null (hors ligne, erreur). */
export async function latestVersion(base = '', fetcher = fetch, now = Date.now()) {
  const r = await fetcher(`${base}/_app/version.json?t=${now}`, { cache: 'no-store' });
  if (!r.ok) return null;
  const j = await r.json();
  return typeof j?.version === 'string' ? j.version : null;
}

export const isNewer = (latest, mine) => !!latest && latest !== mine;

/** Adresse de rechargement qui contourne la page gardée en cache : ?v=<version>, le reste (#carte=…) gardé. */
export function freshUrl(href, v) {
  const u = new URL(href);
  u.searchParams.set('v', v);
  return u.toString();
}

/** Adresse sans ?v= (à remettre au propre une fois rechargé), ou null si rien à changer. */
export function withoutV(href) {
  const u = new URL(href);
  if (!u.searchParams.has('v')) return null;
  u.searchParams.delete('v');
  return u.pathname + u.search + u.hash;
}

/** À l'ouverture (15 premières secondes, rien d'ouvert) : on recharge tout de suite ; ensuite, le bandeau. */
export const reloadNow = (sinceLoadMs, busy) => sinceLoadMs < 15000 && !busy;
