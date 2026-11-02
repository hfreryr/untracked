// Horaires saisis jour par jour ↔ texte d'OpenStreetMap (étiquette opening_hours), pour l'écran « Modifier les
// horaires » (porteur, 02/11/2026). On ne lit que les formes simples (jours, plages, « off », 24/7, jours fériés) :
// des horaires plus détaillés (saisons, semaines, lever du soleil…) ne sont pas réécrits par l'app, pour ne rien perdre
// (parseHours renvoie null ; la fiche propose alors une note).
import { tx } from '#lib/i18n/index.js';

export const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const TIME = /^([01]\d|2[0-4]):([0-5]\d)$/;
const RANGE = /^((?:[01]\d|2[0-4]):[0-5]\d)-((?:[01]\d|2[0-4]):[0-5]\d)$/;

/** Semaine vide : 7 jours fermés. */
export const emptyWeek = () => ({ days: DAYS.map(() => []), allDay: false, keep: [] });

function daysOf(sel) {
  const out = new Set();
  for (const part of sel.split(',')) {
    const m = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(part.trim());
    if (!m) return null;
    const a = DAYS.indexOf(m[1]), b = m[2] ? DAYS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }   // (« Fr-Mo » fait le tour de la semaine)
  }
  return [...out];
}

/**
 * Texte OSM → { days: [[[début, fin], …] × 7], allDay, keep } ; null si les horaires sont trop détaillés pour l'écran.
 * keep : règles gardées telles quelles (jours fériés « PH off »…).
 */
export function parseHours(oh) {
  const w = emptyWeek();
  const text = (oh || '').trim();
  if (!text) return w;
  if (text === '24/7') return { ...w, allDay: true };
  for (const raw of text.split(';')) {
    const rule = raw.trim();
    if (!rule) continue;
    if (/^PH\b/.test(rule)) { w.keep.push(rule); continue; }
    const m = /^(\S+)\s+(.+)$/.exec(rule);
    if (!m) return null;
    const days = daysOf(m[1]);
    if (!days) return null;
    const what = m[2].trim();
    let slots = [];
    if (!/^(off|closed)$/.test(what)) {
      for (const r of what.split(',')) {
        const t = RANGE.exec(r.trim());
        if (!t) return null;
        slots.push([t[1], t[2]]);
      }
    }
    for (const d of days) w.days[d] = slots.map((s) => [...s]);   // (une règle plus loin remplace la précédente, comme dans OSM)
  }
  return w;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Semaine → texte OSM, jours identiques et consécutifs regroupés (« Mo-Fr 09:00-19:00; Sa off; Su off »). */
export function formatHours(w) {
  if (w.allDay) return ['24/7', ...w.keep].join('; ');
  const rules = [];
  for (let i = 0; i < 7;) {
    let j = i;
    while (j + 1 < 7 && same(w.days[j + 1], w.days[i])) j++;
    const sel = i === j ? DAYS[i] : `${DAYS[i]}-${DAYS[j]}`;
    const slots = w.days[i];
    rules.push(`${sel} ${slots.length ? slots.map(([a, b]) => `${a}-${b}`).join(',') : 'off'}`);
    i = j + 1;
  }
  return [...rules, ...w.keep].join('; ');
}

/** Erreur de saisie (texte à afficher), ou null si tout est bon. */
export function checkWeek(w) {
  if (w.allDay) return null;
  if (w.days.every((d) => !d.length)) return tx('horaires_edit.au_moins_un_jour');
  for (const d of w.days) {
    const sorted = [...d].sort((x, y) => x[0].localeCompare(y[0]));
    for (let k = 0; k < sorted.length; k++) {
      const [a, b] = sorted[k];
      if (!TIME.test(a) || !TIME.test(b) || a === b) return tx('horaires_edit.heure_incomplete');
      if (k && sorted[k - 1][1] > a && sorted[k - 1][1] > sorted[k - 1][0]) return tx('horaires_edit.plages_se_chevauchent');
    }
  }
  return null;
}

const SHORT = () => [tx('horaires_edit.lun'), tx('horaires_edit.mar'), tx('horaires_edit.mer'), tx('horaires_edit.jeu'),
  tx('horaires_edit.ven'), tx('horaires_edit.sam'), tx('horaires_edit.dim')];
const hour = (t) => { const [h, m] = t.split(':'); return m === '00' ? `${+h} h` : `${+h} h ${m}`; };

/** Aperçu en clair : « Lun–Jeu 9 h–19 h · Ven 9 h–14 h et 15 h–22 h · Dim fermé ». */
export function previewHours(w) {
  if (w.allDay) return tx('horaires_edit.ouvert_24_24');
  const names = SHORT(), parts = [];
  for (let i = 0; i < 7;) {
    let j = i;
    while (j + 1 < 7 && same(w.days[j + 1], w.days[i])) j++;
    const sel = i === j ? names[i] : `${names[i]}–${names[j]}`;
    const d = w.days[i];
    parts.push(`${sel} ${d.length ? d.map(([a, b]) => `${hour(a)}–${hour(b)}`).join(` ${tx('horaires_edit.et')} `) : tx('horaires_edit.ferme')}`);
    i = j + 1;
  }
  return parts.join(' · ');
}
