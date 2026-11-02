// « Corriger » un lieu (maquette « mélangée » validée par le porteur le 02/11/2026) : les informations qu'on peut corriger
// soi-même dans l'app, leur valeur actuelle, d'où elle vient (OSM ou compléments hors OSM), et les étiquettes OSM à envoyer.
// Une info venue d'ailleurs qu'OSM (site trouvé par Overture…) est signalée ; la corriger l'ajoute à OSM.
import { tx } from '#lib/i18n/index.js';
import { parseHours, previewHours } from '#lib/hoursedit.js';

const YES_NO = ['yes', 'no'];
/** Champs, dans l'ordre de la page. kind : text | url | tel | hours | choice */
export const FIELDS = [
  { key: 'name', tags: ['name'], kind: 'text' },
  { key: 'website', tags: ['website', 'contact:website'], kind: 'url' },
  { key: 'phone', tags: ['phone', 'contact:phone'], kind: 'tel' },
  { key: 'opening_hours', tags: ['opening_hours'], kind: 'hours' },
  { key: 'outdoor_seating', tags: ['outdoor_seating'], kind: 'choice', options: YES_NO },
  { key: 'wheelchair', tags: ['wheelchair'], kind: 'choice', options: ['yes', 'limited', 'no'] }
];

/** Clé OSM qui porte l'info (« contact:website » si c'est elle qu'OSM utilise pour ce lieu). */
export function tagOf(field, tags = {}) {
  const fromOsm = (k) => tags[k] != null && !(tags._src || {})[k];
  return field.tags.find(fromOsm) || field.tags[0];
}

/** Valeur actuelle d'un champ, et si elle vient d'ailleurs qu'OSM. */
export function current(field, tags = {}) {
  const k = field.tags.find((x) => tags[x] != null);
  return { value: k ? String(tags[k]) : '', outside: !!(k && (tags._src || {})[k]) };
}

/** Saisie nettoyée, ou { error } (texte à afficher). */
export function cleanValue(field, raw) {
  const v = String(raw ?? '').trim();
  if (field.kind === 'choice') return field.options.includes(v) ? { value: v } : { error: tx('corriger.choix') };
  if (!v) return { error: tx('corriger.vide') };
  if (field.kind === 'url') {
    const u = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try { const x = new URL(u); if (!/\./.test(x.hostname) || /\s/.test(v)) throw 0; return { value: u.replace(/\/$/, x.pathname === '/' ? '' : '/') }; } catch { return { error: tx('corriger.site_invalide') }; }
  }
  if (field.kind === 'tel') {
    const digits = v.replace(/[^\d+]/g, '');
    if (digits.replace(/\D/g, '').length < 6) return { error: tx('corriger.tel_invalide') };
    // format international, comme OSM le recommande (« +33 1 45 51 00 00 ») ; un numéro français à 10 chiffres est converti
    const fr = /^0\d{9}$/.test(digits) ? `+33 ${digits[1]} ${digits.slice(2).replace(/(\d\d)(?=\d)/g, '$1 ')}` : v;
    return { value: fr };
  }
  if (field.kind === 'hours') return parseHours(v) ? { value: v } : { error: tx('corriger.horaires_invalides') };
  return { value: v.slice(0, 255) };
}

/** Texte affiché d'une valeur (horaires en clair, oui/non en français…). */
export function shown(field, value) {
  if (!value) return tx('corriger.non_renseigne');
  if (field.kind === 'hours') { const w = parseHours(value); return w ? previewHours(w) : value; }
  if (field.kind === 'choice') return { yes: tx('ecran.oui'), no: tx('ecran.non'), limited: tx('ecran.partiel') }[value] || value;
  if (field.kind === 'url') return value.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  return value;
}

/** Corrections → étiquettes à envoyer (avec la date de vérification des horaires). */
export function tagsFor(changes, tags = {}, today = new Date().toISOString().slice(0, 10)) {
  const out = {};
  for (const [key, value] of Object.entries(changes)) {
    const f = FIELDS.find((x) => x.key === key);
    if (!f) continue;
    out[tagOf(f, tags)] = value;
    if (key === 'opening_hours') out['check_date:opening_hours'] = today;
  }
  return out;
}

/** Texte d'une note OSM pour ce qui ne se corrige pas directement (fermeture, travaux, autre). */
export function noteText(kind, name, detail = '') {
  const what = { ferme: tx('corriger.note_ferme'), travaux: tx('corriger.note_travaux'), autre: tx('corriger.note_autre') }[kind];
  return [`${what} « ${name} ».`, detail.trim(), tx('corriger.note_signature')].filter(Boolean).join('\n');
}
