// Info trafic d'un trajet en transport : les messages des transporteurs (Île-de-France Mobilités, via Transitous)
// qui touchent CE trajet, À L'HEURE du trajet. Logique pure, testée (trafic.test.js).
//
// Où sont les messages (vérifié le 27/10/2026, api.transitous.org/api/v5/plan) :
//  - ceux d'une ligne entière (RER, Transilien, bus : « RER D : … interrompu ») sont sur l'étape (leg.alerts) ;
//  - ceux d'une ligne à une station (métro surtout : « Métro 4 : … Arrêt non desservi », ascenseurs) sont sur
//    les arrêts de l'étape (from / intermediateStops / to .alerts).
// Chaque message : headerText, descriptionText (HTML), cause, effect, impactPeriod [{ start, end }] (fin 1970 = sans fin).
import { tx } from '#lib/i18n/index.js';

// entités HTML nommées les plus courantes (codes Unicode : ce ne sont pas des textes de l'app)
const NAMED = { amp: 38, lt: 60, gt: 62, quot: 34, apos: 39, nbsp: 32, eacute: 233, egrave: 232, ecirc: 234, agrave: 224, ccedil: 231, ocirc: 244, rsquo: 8217, laquo: 171, raquo: 187 };

/** Texte du transporteur (HTML simple) en texte lisible, paragraphes conservés. */
export function plainText(html = '') {
  return String(html)
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, k) => (NAMED[k.toLowerCase()] ? String.fromCodePoint(NAMED[k.toLowerCase()]) : m))
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

const t = (s) => { const d = s ? new Date(s) : null; return d && d.getFullYear() > 1971 ? d : null; };
/** Périodes du message ; fin absente ou « 1970 » = jusqu'à nouvel ordre. */
const periods = (a) => (a.impactPeriod?.length ? a.impactPeriod : a.communicationPeriod || []).map((p) => ({ start: t(p.start), end: t(p.end) }));

/** Le message s'applique-t-il entre start et end ? (sans période connue : oui) */
export function activeDuring(a, start, end) {
  const ps = periods(a);
  if (!ps.length) return true;
  return ps.some((p) => (!p.start || p.start <= end) && (!p.end || p.end >= start));
}

const LIFT = (a) => a.effect === 'ACCESSIBILITY_ISSUE' || /ascenseur|escalier m[ée]canique/i.test(a.headerText || '');
const RED = (a) => a.effect === 'NO_SERVICE' && !/arr[eê]t non desservi/i.test(a.headerText || '')
  || /interrompu|interruption/i.test(`${a.headerText} ${a.descriptionText}`.slice(0, 400));

/** Message brut → message affichable. station : nom de la station quand le message vise une station. */
export function toAlert(a, station = null) {
  const header = (a.headerText || '').trim();
  // « Métro 4 : Travaux de rénovation - Arrêt non desservi » → reste = « Travaux de rénovation - Arrêt non desservi »
  const rest = header.replace(/^(?:m[ée]tro|rer|ligne|tram(?:way)?|bus|train|t\d+)\s*[\w-]{0,6}\s*:\s*/i, '');
  const m = rest.match(/^(.*\S) - ((?:Trafic|Arrêts?|Train|Gare|Station|Fermeture|Ligne)\b.*)$/);
  let title = m ? m[2] : rest || header;
  let cause = m ? m[1] : '';
  const skip = !!station && /arr[eê]t non desservi/i.test(header);
  if (skip) title = tx('trafic.station_non_desservie', { station });
  else if (station && m) cause = tx('trafic.cause_a', { cause, station });
  else if (station && !m && !title.includes(station)) cause = tx('trafic.a_station', { station });
  const ps = periods(a);
  const from = ps.map((p) => p.start).filter(Boolean).sort((x, y) => x - y)[0] || null;
  const ends = ps.map((p) => p.end);
  const until = ends.length && ends.every(Boolean) ? ends.sort((x, y) => y - x)[0] : null;
  return {
    key: `${header}|${station || ''}`, header, title, cause, text: plainText(a.descriptionText),
    level: RED(a) ? 'red' : 'orange', lift: LIFT(a), skip, station, from, until
  };
}

/**
 * Messages d'une étape brute de Transitous, pendant l'étape.
 * @returns {{ line: any[], stops: any[], lifts: any[], skipped: string[], level: 'red'|'orange'|null }}
 */
export function legTrafic(l) {
  const start = new Date(l.startTime), end = new Date(l.endTime);
  const seen = new Set(), line = [], stops = [], lifts = [];
  const add = (raw, station, edge) => {
    if (!activeDuring(raw, start, end)) return;
    const a = toAlert(raw, station);
    if (seen.has(a.key)) return;
    seen.add(a.key);
    // ascenseurs : seulement là où l'on monte et descend (là où on les prend)
    if (a.lift) { if (edge) lifts.push(a); return; }
    (station ? stops : line).push(a);
  };
  for (const a of l.alerts || []) add(a, null, false);
  const places = [l.from, ...(l.intermediateStops || []), l.to].filter(Boolean);
  places.forEach((p, i) => { for (const a of p.alerts || []) add(a, p.name, i === 0 || i === places.length - 1); });
  const all = [...stops, ...line].sort((x, y) => (x.level === 'red' ? 0 : 1) - (y.level === 'red' ? 0 : 1));
  return {
    line, stops, lifts, all,
    skipped: stops.filter((a) => a.skip).map((a) => a.station),
    level: all.some((a) => a.level === 'red') ? 'red' : all.length ? 'orange' : null
  };
}

/** Le message le plus important d'un trajet (liste des propositions) : { leg, alert } ou null. */
export function tripAlert(it) {
  let best = null;
  for (const leg of it.legs || []) {
    for (const a of leg.trafic?.all || []) {
      if (!best || (a.level === 'red' && best.alert.level !== 'red')) best = { leg, alert: a };
    }
  }
  return best;
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();
/** Dernier jour concerné : une fin dans la nuit (avant 5 h, fin de service) compte pour la veille.
 *  « Jusqu'au 19 décembre inclus » est publié avec une fin le 20 à 4 h 30. */
export const lastDay = (d) => new Date(+d - 5 * 3600e3);
/** « jusqu'à 9 h 30 », « jusqu'au 20 déc. », ou rien (sans fin connue). */
export function untilText(a, now = new Date()) {
  if (!a.until) return '';
  if (sameDay(a.until, now)) return tx('trafic.jusqua_heure', { heure: a.until.toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', ' h ') });
  return tx('trafic.jusquau', { date: lastDay(a.until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }) });
}

/** Seconde ligne d'un message : « Travaux de rénovation, jusqu'au 20 déc. » (première lettre en capitale). */
export function alertSub(a, now = new Date()) {
  const s = [a.cause, untilText(a, now)].filter(Boolean).join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
