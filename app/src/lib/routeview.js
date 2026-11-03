// Mise en forme des itinéraires, partagée par la page, la fiche itinéraire et le guidage.
import { tx } from '#lib/i18n/index.js';
import { fmtTime, fmtDistance } from './routing.js';
import { exitLabel } from './exits.js';
import { startOf, endOf } from './when.js';

export const MODES = [
  { id: 'walk', label: tx('itin.a_pied_2') },
  { id: 'bike', label: tx('itin.velo') },
  { id: 'transit', label: tx('carte.transports') },
  { id: 'car', label: tx('itin.voiture') }
];
/** Heure d'arrivée (et de départ) d'un trajet de « seconds », maintenant ou à l'heure choisie (when.js). */
export const arrival = (seconds, when = null) => fmtTime(new Date(endOf(when, seconds)));
export const departure = (seconds, when = null) => fmtTime(new Date(startOf(when, seconds)));
export const inMinutes = (d) => {
  const m = Math.round((d - Date.now()) / 60000);
  // au-delà d'une heure (départ choisi plus tard), l'heure affichée juste avant suffit
  return m <= 0 ? tx('horaires.maintenant') : m < 60 ? tx('itin.dans_min', { m }) : '';
};
// ——— Départs d'un trajet en transports, comme Citymapper (relevé sur citymapper.com le 16/10/2026) ———
// Métro, bus, tram : « dans 1, 4, 7 min de Château Rouge » = dans combien de minutes il faut PARTIR (marche comprise)
// pour attraper chacun des 3 prochains passages. Trains (RER, Transilien) : l'heure du train en gare, son état et
// sa destination : « 10:35 (Retardé 10:43) Saint-Rémy-lès-Chevreuse de Gare du Nord ».
const TRAINS = new Set(['RAIL', 'REGIONAL_RAIL', 'SUBURBAN', 'REGIONAL_FAST_RAIL', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL']);

/**
 * @param {{start: Date, board: object, next: {board: Date, leave: Date}[]}} it  @param {object|null} when  heure choisie (when.js)
 * @returns {{ kind: 'train', time: string, status: string, headsign: string, from: string, live: boolean }
 *   | { kind: 'countdown', mins: number[], from: string, live: boolean } | { kind: 'leave' | 'arrive', time: string, live: boolean }}
 */
export function departInfo(it, when = null, now = Date.now()) {
  const b = it.board;
  const live = !!b.realTime;
  if (TRAINS.has(b.mode)) {
    const late = b.scheduled && b.start - b.scheduled >= 60000;
    const status = !live ? '' : late ? tx('itin.retarde', { heure: fmtTime(b.start) }) : tx('itin.a_l_heure');
    return { kind: 'train', time: fmtTime(late ? b.scheduled : b.start), status, headsign: b.headsign, from: b.from, live };
  }
  // heure choisie (relevé Citymapper du 16/10) : « Partir à » → l'heure d'arrivée ; « Arriver à » → l'heure où partir
  if (when) return when.arrive ? { kind: 'leave', time: fmtTime(it.start), live: false } : { kind: 'arrive', time: fmtTime(it.end), live: false };
  const leaves = [it.start, ...(it.next || []).map((n) => n.leave)].filter(Boolean).slice(0, 3);
  const mins = leaves.map((t) => Math.floor((t - now) / 60000)).filter((m) => m >= 0);
  return { kind: 'countdown', mins: mins.length ? mins : [0], from: b.from, live };
}

// « 5 et 9 », « 1, 4 et 7 » (accord du français ; porteur, 03/11/2026 : « dans 5, 9 min de Anvers » se lisait mal)
const andList = (ns) => (ns.length < 2 ? `${ns[0]}` : `${ns.slice(0, -1).join(', ')} ${tx('itin.et')} ${ns[ns.length - 1]}`);

/** Le texte : « Depuis Château Rouge : dans 1, 4 et 7 min », « Depuis Abbesses : maintenant, puis dans 4 min »,
 * « Depuis Gare du Nord : 10:35 (retardé 10:43), direction Saint-Rémy-lès-Chevreuse », « à 08:21, 08:24 de Château Rouge », « 10:50 (À l'heure) … de Gare du Nord ». */
export function departText(d) {
  if (d.kind === 'train') return tx('itin.depart_train', { heure: d.time, etat: d.status ? ` (${d.status})` : '', direction: d.headsign ? tx('itin.direction_train', { headsign: d.headsign }) : '', from: d.from });
  if (d.kind === 'leave') return tx('itin.depart_a', { heure: d.time });
  if (d.kind === 'arrive') return tx('itin.arrivee_4', { fmtTime: d.time });
  const [first, ...rest] = d.mins;
  if (first > 0) return tx('itin.depart_dans', { mins: andList(d.mins), from: d.from });
  return rest.length ? tx('itin.depart_maintenant_puis', { mins: andList(rest), from: d.from }) : tx('itin.depart_maintenant', { from: d.from });
}

const PREFIX = { SUBWAY: 'M', METRO: 'M', TRAM: 'T', BUS: tx('itin.bus'), REGIONAL_RAIL: 'RER', SUBURBAN: 'RER' };
/**
 * Étiquettes des propositions en transports : « Arrivée la plus tôt » et « Le plus simple » (moins de correspondances),
 * comme Citymapper. Une proposition qui est les deux est « Arrivée la plus tôt ». En « Arriver à » (toutes arrivent à
 * l'heure), c'est le trajet le plus court : « Le plus rapide ». (porteur, 03/11/2026 : « Le plus rapide » sur 35 min,
 * à côté d'un 31 min qui part plus tard, semblait faux.)
 */
export function transitTags(list, arrive = false) {
  const rides = (it) => it.legs.filter((l) => l.mode !== 'WALK' && l.mode !== 'STOP').length;
  if (list.length < 2) return list.map(() => '');
  // « Arriver à » : toutes arrivent à l'heure ; le plus rapide est alors le plus court
  const key = (it) => (arrive ? it.end - it.start : +it.end);
  const fastest = list.reduce((b, it, i) => (key(it) < key(list[b]) ? i : b), 0);
  const fewest = list.reduce((b, it, i) => (rides(it) < rides(list[b]) ? i : b), 0);
  return list.map((_, i) => (i === fastest ? (arrive ? tx('itin.le_plus_rapide') : tx('itin.arrivee_la_plus_tot'))
    : i === fewest && rides(list[i]) < rides(list[fastest]) ? tx('itin.le_plus_simple') : ''));
}
export const badge = (leg) => `${PREFIX[leg.mode] ? PREFIX[leg.mode] + ' ' : ''}${leg.line}`.trim();
export const streetOpts = (r) => (r ? [r, ...(r.alts || [])] : []);
// « 3 min de plus » ; à durée affichée égale : la différence de distance (sinon « 1 min de plus » sous deux « 22 min »)
export function altTag(r, best) {
  const dm = Math.round(r.duration / 60) - Math.round(best.duration / 60);
  if (dm > 0) return tx('itin.min_de_plus', { dm });
  const dd = r.distance - best.distance;
  return dd > 50 ? tx('itin.meme_duree_de_plus', { fmtDistance: fmtDistance(dd) }) : tx('itin.autre_itineraire_meme_duree');
}
// « prenez la sortie 2 · Rue de Rennes » ; sans numéro : « prenez la sortie rue de Rennes » ; nom générique (« Entrée / Sortie ») : « prenez la sortie »
export const exitPhrase = (e) => {
  if (e.ref) return tx('itin.prenez_la', { sortie: exitLabel(e).replace(/^Sortie/, 'sortie') });
  return e.name && !/^(entr[ée]e|sortie|acc[èe]s)\b/i.test(e.name) ? tx('itin.prenez_la_sortie', { name: e.name }) : '';
};
