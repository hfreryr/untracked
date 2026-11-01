// Photos Wikimedia préparées à l'avance (build_wikiphotos.py, porteur 01/11/2026 : « les photos mettent 1 à 3 s ») :
// les tuiles donnent l'adresse de chaque image et son crédit ; à l'ouverture de la fiche, il ne reste que les images
// à télécharger. Le résumé Wikipédia (texte) est demandé à part, sans faire attendre les photos.
// Lieux pas encore préparés : l'ancienne recherche (placeinfo.js, wikiInfo).
import { APP_AGENT } from './config.js';

const THUMB = 'https://upload.wikimedia.org/wikipedia/commons/thumb/';
const PAGE = 'https://commons.wikimedia.org/wiki/File%3A';

/** [[chemin, crédit], …] des tuiles → photos au format de wikiInfo (src, full, page, title, credit). */
export function preparedPhotos(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((x) => Array.isArray(x) && typeof x[0] === 'string' && !x[0].includes('..')).map(([path, credit]) => {
    const name = path.split('/')[2] || '';
    return { src: THUMB + path, full: THUMB + path, page: PAGE + name, title: decodeURIComponent(name), credit: credit || '' };
  });
}

/** Résumé de l'article Wikipédia en français : { extract, url } ou null. */
export async function wikiSummary(title, signal) {
  if (!title) return null;
  const r = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    { signal, headers: { 'Api-User-Agent': APP_AGENT } }).catch(() => null);
  const s = r?.ok ? await r.json() : null;
  if (!s?.extract || s.type === 'disambiguation') return null;
  return { extract: s.extract, url: s.content_urls?.mobile?.page || s.content_urls?.desktop?.page };
}
