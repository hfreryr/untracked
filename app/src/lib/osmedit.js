// Envoyer une modification à OpenStreetMap avec le compte de la personne (osmauth.js) : une fois confirmée par elle,
// jamais automatiquement (règles du projet, docs/contribution-osm.md).
// 1. relire l'objet au moment d'écrire (sa version : si quelqu'un l'a modifié entre-temps, OSM refuse, on le dit) ;
// 2. ouvrir un groupe de modifications signé (created_by, #untrackedmaps, source=survey) ; 3. envoyer ; 4. fermer.
// La lecture sert à l'écriture : c'est l'usage prévu de l'API d'édition (pas de lecture pour afficher la carte).

export const APP_NAME = 'Untracked Maps';

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reEsc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Remplace (ou ajoute, ou retire si null) des étiquettes dans le XML d'un objet OSM tel que l'API le renvoie, et le
 *  rattache au groupe de modifications. Pure (le XML d'OSM est régulier : <tag k="…" v="…"/>). */
export function withTags(xml, tags, changeset) {
  const open = /<(node|way|relation)\b[^>]*>/.exec(xml);
  if (!open || open[0].endsWith('/>')) throw new Error('objet');
  const type = open[1];
  const head = /\schangeset="\d+"/.test(open[0]) ? open[0].replace(/\schangeset="\d+"/, ` changeset="${changeset}"`)
    : open[0].replace(/>$/, ` changeset="${changeset}">`);
  let out = xml.replace(open[0], () => head);
  for (const [k, v] of Object.entries(tags)) {
    const re = new RegExp(`\\s*<tag k="${reEsc(esc(k))}" v="[^"]*"\\s*/>`);
    if (v == null) { out = out.replace(re, ''); continue; }
    const tag = `<tag k="${esc(k)}" v="${esc(v)}"/>`;
    out = re.test(out) ? out.replace(re, () => `\n    ${tag}`) : out.replace(`</${type}>`, () => `  ${tag}\n  </${type}>`);   // (fonctions : un « $ » dans la valeur reste tel quel)
  }
  return out;
}

export const changesetXml = (comment, version) => `<osm><changeset>${[
  ['created_by', `${APP_NAME} ${version}`], ['comment', comment], ['hashtags', '#untrackedmaps'], ['source', 'survey'], ['locale', 'fr']
].map(([k, v]) => `<tag k="${k}" v="${esc(v)}"/>`).join('')}</changeset></osm>`;

/**
 * Envoie de nouvelles étiquettes pour un objet. @returns {Promise<{changeset:number}>}
 * Lève une erreur dont `code` vaut 'conflit' (modifié par quelqu'un d'autre), 'acces' (reconnexion nécessaire) ou 'reseau'.
 */
export async function sendTags({ osmType, osmId }, tags, comment, { api, token, version = '0.2', fetcher = fetch }) {
  const fail = (code) => Object.assign(new Error(code), { code });
  const auth = { Authorization: `Bearer ${token}` };
  const call = async (method, path, body) => {
    const r = await fetcher(`${api}/api/0.6/${path}`, { method, headers: { ...auth, ...(body ? { 'Content-Type': 'text/xml' } : {}) }, body }).catch(() => null);
    if (!r) throw fail('reseau');
    if (r.status === 401 || r.status === 403) throw fail('acces');
    if (r.status === 409 || r.status === 412) throw fail('conflit');
    if (!r.ok) throw fail('reseau');
    return r.text();
  };
  const xml = await call('GET', `${osmType}/${osmId}`);
  const cs = Number(await call('PUT', 'changeset/create', changesetXml(comment, version)));
  try {
    await call('PUT', `${osmType}/${osmId}`, withTags(xml, tags, cs));
  } finally {
    await call('PUT', `changeset/${cs}/close`).catch(() => {});
  }
  return { changeset: cs };
}
