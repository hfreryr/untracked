// « Partager → Untracked Maps » depuis une autre app (Android : l'app installée figure dans le menu de partage,
// manifest.webmanifest « share_target »). Le téléphone ouvre l'app avec ?titre=…&texte=…&lien=… :
// un lien Google Maps ou Plans ouvre le lieu (maplinkopen.js) ; un autre texte (une adresse…) est cherché.
// iPhone : Apple ne propose pas ce menu aux apps web ; ce sera le rôle de la vraie app.
import { tx } from '#lib/i18n/index.js';

/** Texte partagé, lu dans l'adresse de l'app ; null si l'app n'a pas été ouverte par un partage. */
export function sharedText(search) {
  const p = new URLSearchParams(search || '');
  const parts = ['lien', 'texte', 'titre'].map((k) => (p.get(k) || '').trim()).filter(Boolean);
  if (!parts.length) return null;
  // le lien d'abord (c'est lui qui désigne le lieu), puis le texte qui l'accompagne s'il ne le répète pas
  return [...new Set(parts)].filter((s, i, all) => !all.some((o, j) => j < i && o.includes(s))).join(' ');
}

/** À l'ouverture : texte partagé → la barre de recherche, et le lieu ouvert s'il n'y en a qu'un. */
export async function openShared(app, deps) {
  const text = sharedText(location.search);
  if (!text) return;
  history.replaceState(history.state, '', location.pathname + location.hash);
  const { isMapLink, search, at } = deps;
  if (!isMapLink(text)) { app.query = text; return; }
  try {
    const r = await search(text, at());
    if (r.length === 1) { app.query = r[0].name; app.openPlace(r[0]); } else app.query = text;
  } catch (e) {
    app.say(e.say || tx('ecran.la_recherche_ne_repond_pas_verifiez'));
  }
}
