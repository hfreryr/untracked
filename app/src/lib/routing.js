import { legTrafic } from '#lib/trafic.js';
import { rankTransit } from '#lib/transitrank.js';
import { tx } from '#lib/i18n/index.js';
import { city, inBox } from './cities/index.js';
import { dataBase, ROUTING_URL } from './config.js';
import { createLimiter } from './ratelimit.js';
// Itinéraires.
//  - À pied et à vélo : Valhalla (serveur public FOSSGIS, données OpenStreetMap).
//  - Transports en commun : Transitous (MOTIS 2, données ouvertes des réseaux de transport).
// Prototype : serveurs publics à usage léger. Transitous demande d'être prévenu avant un usage large.

const VALHALLA = ROUTING_URL;
// FOSSGIS : une demande par seconde au plus (conditions d'utilisation ; marge de 100 ms)
const valhallaTurn = createLimiter(1100);
const TRANSITOUS = 'https://api.transitous.org/api/v5/plan';

// ——— Lissage des tracés ———
// Les trottoirs de Paris sont cartographiés à part : un trajet brut fait des crochets à chaque
// traversée. On simplifie (Douglas-Peucker, en mètres) puis on arrondit les angles (Chaikin).
const M_PER_DEG_LAT = 111320;
function perpDist([x, y], [x1, y1], [x2, y2], k) {
  const ax = (x - x1) * k, ay = y - y1, bx = (x2 - x1) * k, by = y2 - y1;
  const len = Math.hypot(bx, by);
  if (!len) return Math.hypot(ax, ay) * M_PER_DEG_LAT;
  const t = Math.max(0, Math.min(1, (ax * bx + ay * by) / (len * len)));
  return Math.hypot(ax - t * bx, ay - t * by) * M_PER_DEG_LAT;
}
export function simplify(coords, tolMeters) {
  if (coords.length < 3) return coords;
  const k = Math.cos((coords[0][1] * Math.PI) / 180);
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = perpDist(coords[i], coords[a], coords[b], k);
      if (d > max) { max = d; idx = i; }
    }
    if (max > tolMeters) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return coords.filter((_, i) => keep[i]);
}
function chaikin(coords, iterations = 2) {
  for (let n = 0; n < iterations && coords.length > 2; n++) {
    const out = [coords[0]];
    for (let i = 0; i < coords.length - 1; i++) {
      const [x0, y0] = coords[i], [x1, y1] = coords[i + 1];
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    out.push(coords[coords.length - 1]);
    coords = out;
  }
  return coords;
}
export const smooth = (coords, tol = 7) => chaikin(simplify(coords, tol));
// Trajets dans les rues : on suit le tracé exact (l'arrondi coupait les angles et faisait traverser des immeubles).
export const streetLine = (coords) => simplify(coords, 1);

export function decodePolyline(str, precision = 6) {
  const factor = 10 ** precision;
  const coords = [];
  let lat = 0, lon = 0, i = 0;
  while (i < str.length) {
    for (const axis of [0, 1]) {
      let shift = 0, result = 0, b;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta; else lon += delta;
    }
    coords.push([lon / factor, lat / factor]);
  }
  return coords;
}

/**
 * À pied, à vélo ou en voiture, avec un arrêt intermédiaire facultatif (`via`).
 * `priority` : 0 pour le trajet affiché à l'écran (il passe devant les autres dans la file d'attente).
 * @returns {{duration:number, distance:number, coords:number[][], steps:{text:string, distance:number, stop?:boolean}[]}}
 */
export async function streetRoute(from, to, mode, signal, via = null, priority = 1) {
  const costing = mode === 'bike' ? 'bicycle' : mode === 'car' ? 'auto' : 'pedestrian';
  const pts = via ? [from, via, to] : [from, to];
  const body = {
    locations: pts.map((p) => ({ lat: p.lat, lon: p.lon, type: 'break' })),
    costing,
    costing_options: mode === 'bike' ? { bicycle: { bicycle_type: 'City', use_roads: 0.25 } } : {},
    language: 'fr-FR',
    units: 'km',
    ...(via ? {} : { alternates: 2 })      // itinéraires de rechange (pas possible avec un arrêt)
  };
  const url = `${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`;
  await valhallaTurn(priority, signal);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(res.status === 400 ? 'no-route' : `valhalla-${res.status}`);
  const json = await res.json();
  // Valhalla classe par « coût » (confort, détours…), pas par durée : on trie nous-mêmes, le plus rapide d'abord.
  const all = [json.trip, ...(json.alternates || []).map((a) => a.trip)].map((t) => parseTrip(t, mode, via))
    .sort((a, b) => a.duration - b.duration);
  const [best, ...rest] = all;
  // un « autre » trajet presque identique n'apporte rien
  best.alts = rest.filter((r) => Math.abs(r.distance - best.distance) > 40 || Math.abs(r.duration - best.duration) > 30);
  return best;
}

/**
 * Un trajet Valhalla → tracé lissé (pour la carte), tracé brut et étapes situées sur ce tracé (pour le guidage).
 * Chaque étape : texte, distance, type de manœuvre, phrase à dire, et position (idx) sur le tracé brut.
 */
function parseTrip(trip, mode, via) {
  const coords = [];
  const raw = [];
  const steps = [];
  trip.legs.forEach((leg, i) => {
    const shape = decodePolyline(leg.shape, 6);
    const offset = raw.length;
    raw.push(...shape);
    coords.push(...streetLine(shape));
    steps.push(...simplifySteps(leg.maneuvers, offset));
    if (i < trip.legs.length - 1) steps.push({ text: tx('itin.arret_3', { label: via.label }), speak: tx('itin.arret_3', { label: via.label }), distance: 0, stop: true, type: 'stop', idx: raw.length - 1 });
  });
  return { duration: trip.summary.time, distance: trip.summary.length * 1000, coords, raw, steps };
}

// Des consignes à l'échelle de la rue, pas du trottoir : les petits tronçons sans nom
// (traversées, bouts de trottoir) sont fondus dans la consigne précédente.
function simplifySteps(maneuvers, offset = 0) {
  const steps = [];
  for (const m of maneuvers) {
    if (m.type === 4 || m.type === 5 || m.type === 6) continue; // « Vous êtes arrivé »
    const street = m.street_names?.[0];
    const named = street && !/^(allée|trottoir|chemin|passage piéton)$/i.test(street);
    const s = { text: tidy(m.instruction), distance: m.length * 1000, named, type: m.type, idx: offset + m.begin_shape_index,
      speak: tidy(m.verbal_pre_transition_instruction || m.instruction) };
    const last = steps[steps.length - 1];
    if (last && !named && s.distance < 80) { last.distance += s.distance; continue; }
    if (last && last.text === s.text) { last.distance += s.distance; continue; }
    steps.push(s);
  }
  return steps;
}

// Les trottoirs sans nom deviennent « l'allée » dans les consignes : on les retire.
// … et « Tournez à gauche dans Rue du Four » devient « Tournez à gauche rue du Four ».
function tidy(text) {
  return text
    .replace(/ (dans|sur|vers) (l'allée|le trottoir|le chemin|le passage piéton)/g, '')
    .replace(/ (dans|sur) (Rue|Avenue|Boulevard|Place|Quai|Passage|Impasse|Cours|Square|Pont|Villa|Cité|Allée) /g,
      (_, __, type) => ` ${type.toLowerCase()} `)
    .replace(/\s+\./g, '.');
}

// ——— Trafic habituel (voiture) ———
// Pas de trafic en temps réel (il faudrait suivre les téléphones). À la place : la vitesse mesurée
// sur 13 mois par les capteurs de la Ville de Paris, à ce jour et à cette heure, comparée à l'heure
// la plus rapide de la semaine (voir scripts/build_traffic.py). Ce rapport est appliqué tel quel au
// temps « route libre » calculé par Valhalla : aucun coefficient choisi à la main.
// Seule hypothèse restante : que le temps Valhalla corresponde bien à la circulation de nuit.
let profile = null;

export async function trafficEstimate(from, to, when = new Date()) {
  if (!city.packs?.traffic) return { factor: 1, label: null };   // pas de comptages pour cette ville
  profile ??= fetch(`${dataBase()}${city.packs.traffic}`).then((r) => r.json()).catch(() => null);
  const p = await profile;
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', hour: 'numeric', hourCycle: 'h23' }).formatToParts(when);
  const jour = parts.find((x) => x.type === 'weekday').value;
  const heure = Number(parts.find((x) => x.type === 'hour').value);
  const measured = p?.jours?.[jour]?.ralentissement?.[heure];
  if (measured == null) return { factor: 1, label: null };
  const weight = (inBox(city.trafficBox, from) ? 0.5 : 0) + (inBox(city.trafficBox, to) ? 0.5 : 0);   // hors de Paris, pas de mesure : on n'allonge pas
  const factor = 1 + (measured - 1) * weight;
  const level = measured < 1.2 ? tx('itin.fluide') : measured < 1.45 ? tx('itin.modere') : measured < 1.7 ? tx('itin.charge') : tx('itin.tres_charge');
  return { factor, measured, label: weight ? tx('itin.trafic_habituel_le_vers_h', { level, jour, heure }) : null };
}

/** Choix des modes de transport en commun (Transitous, paramètre transitModes vérifié le 15/10/2026). */
// Chaque mode s'active ou se retire (P5 : « une liste excluante, par exemple je ne veux pas prendre le bus »).
export const TRANSIT_KINDS = { metro: ['SUBWAY', 'FUNICULAR'], rail: ['RAIL'], tram: ['TRAM'], bus: ['BUS'] };
export const ALL_KINDS = Object.keys(TRANSIT_KINDS);
/** Modes Transitous des familles gardées ; null = toutes (aucun filtre). */
export const transitModesFor = (kept) => (!kept || kept.length >= ALL_KINDS.length ? null : kept.flatMap((k) => TRANSIT_KINDS[k] || []));

/**
 * Transports en commun : plusieurs propositions, triées par heure d'arrivée. modes : null (tous) ou liste Transitous.
 * arrive : « when » est l'heure d'arrivée souhaitée (paramètre arriveBy de Transitous, vérifié le 16/10/2026).
 */
export async function transitRoutes(from, to, signal, when = new Date(), modes = null, arrive = false) {
  const url = new URL(TRANSITOUS);
  url.search = new URLSearchParams({
    fromPlace: `${from.lat},${from.lon}`,
    toPlace: `${to.lat},${to.lon}`,
    time: when.toISOString(),
    numItineraries: '10',
    ...(arrive ? { arriveBy: 'true' } : {}),
    ...(modes ? { transitModes: modes.join(',') } : {})
  });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`transitous-${res.status}`);
  const data = await res.json();
  const groups = new Map();
  for (const raw of data.itineraries || []) {
    const it = {
      duration: raw.duration,
      start: new Date(raw.startTime),
      end: new Date(raw.endTime),
      legs: raw.legs.map((l) => ({
        mode: l.mode,
        line: l.routeShortName || '',
        color: l.routeColor ? `#${l.routeColor}` : '#5B6573',
        textColor: l.routeTextColor ? `#${l.routeTextColor}` : '#FFFFFF',
        headsign: l.headsign || '',
        from: l.from?.name === 'START' ? tx('recherche.depart') : l.from?.name,
        to: l.to?.name === 'END' ? tx('recherche.arrivee') : l.to?.name,
        toPos: l.to?.lat != null ? { lat: l.to.lat, lon: l.to.lon } : null,
        fromStop: l.from?.stopId || null,
        toStop: l.to?.stopId || null,
        start: new Date(l.startTime),
        end: new Date(l.endTime),
        duration: l.duration,
        distance: l.distance || 0,
        stops: (l.intermediateStops || []).length,
        stopNames: (l.intermediateStops || []).map((s) => s.name).filter(Boolean),   // arrêts dépliables de l'étape
        fromPos: l.from?.lat != null ? { lat: l.from.lat, lon: l.from.lon } : null,
        realTime: l.realTime,
        trafic: l.mode === 'WALK' ? null : legTrafic(l),   // info trafic de l'étape, pendant l'étape (trafic.js)
        // heure prévue au départ de l'arrêt (le retard se lit par différence avec start)
        scheduled: l.scheduledStartTime ? new Date(l.scheduledStartTime) : null,
        coords: l.legGeometry
          ? (l.mode === 'WALK' ? streetLine : (c) => smooth(c, 3))(decodePolyline(l.legGeometry.points, l.legGeometry.precision || 6))
          : []
      }))
    };
    it.board = it.legs.find((l) => l.mode !== 'WALK') || null; // premier véhicule : arrêt et heure de départ
    if (!it.board) continue; // trajet entièrement à pied : l'onglet « À pied » s'en charge
    // une même combinaison de lignes = une seule proposition, avec ses prochains départs
    const key = it.legs.filter((l) => l.mode !== 'WALK').map((l) => `${l.mode}:${l.line}`).join('>');
    const g = groups.get(key);
    // « arriver à » : on garde le départ le plus tardif de chaque combinaison (les autres arrivent bien plus tôt)
    // next : les départs suivants de la même combinaison, avec l'heure à laquelle partir (leave) pour chacun
    if (!g) { it.next = []; groups.set(key, it); }
    else if (arrive) { if (it.board.start > g.board.start) { it.next = []; groups.set(key, it); } }
    else if (g.next.length < 3 && +it.board.start !== +g.board.start && !g.next.some((n) => +n.board === +it.board.start)) {
      g.next.push({ board: it.board.start, leave: it.start });
    }
  }
  // le plus simple d'abord, sauf si une correspondance fait vraiment gagner du temps (transitrank.js)
  return rankTransit([...groups.values()], arrive).slice(0, 4);
}

/**
 * Transports en commun avec un arrêt intermédiaire : départ → arrêt, puis arrêt → arrivée en partant
 * à l'heure où l'on y arrive (1 min plus tard). Transitous ne sait pas passer par un point : on enchaîne.
 * Un tronçon sans transport utile se fait à pied.
 */
export async function transitWithStop(from, via, to, signal, when = new Date(), modes = null, arrive = false) {
  // « arriver à » : on part de la fin (arrêt → arrivée), puis départ → arrêt en arrivant 1 min avant
  if (arrive) {
    const seg = (a, b, t) => transitWithStopSegment(a, b, t, signal, modes, true);
    const lasts = (await seg(via, to, when)).slice(0, 3);
    const out = [];
    for (const s of lasts) {
      const f = (await seg(from, via, new Date(+s.start - 60000)))[0];
      if (f) out.push(joinAtStop(f, s, via));
    }
    return rankTransit(out.filter((it) => it.board), true);
  }
  const segment = async (a, b, t) => transitWithStopSegment(a, b, t, signal, modes, false);
  const firsts = (await segment(from, via, when)).slice(0, 3);
  const out = [];
  const seen = new Set();
  for (const f of firsts) {
    const s = (await segment(via, to, new Date(+f.end + 60000)))[0];
    if (!s) continue;
    const it = joinAtStop(f, s, via);
    if (!it.board) continue;
    const key = it.legs.map((l) => `${l.mode}:${l.line || ''}`).join('>') + +it.end;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return rankTransit(out);
}

/** Un tronçon : transports, ou à pied s'il n'y a rien d'utile. arrive : t est l'heure d'arrivée. */
async function transitWithStopSegment(a, b, t, signal, modes, arrive) {
  const list = await transitRoutes(a, b, signal, t, modes, arrive).catch((e) => { if (e.name === 'AbortError') throw e; return []; });
  if (list.length) return list;
  const w = await streetRoute(a, b, 'walk', signal);
  const start = new Date(arrive ? +t - w.duration * 1000 : +t), end = new Date(+start + w.duration * 1000);
  return [{ duration: w.duration, start, end, board: null, next: [],
    legs: [{ mode: 'WALK', from: a.label || tx('recherche.depart'), to: b.label, start, end, duration: w.duration, distance: w.distance, coords: w.coords }] }];
}

/** Deux tronçons bout à bout, avec l'arrêt entre les deux. */
function joinAtStop(f, s, via) {
  const it = {
    start: f.start, end: s.end, duration: (s.end - f.start) / 1000, next: [],
    legs: [...f.legs, { mode: 'STOP', from: via.label, start: f.end, end: s.start, duration: (s.start - f.end) / 1000, coords: [] }, ...s.legs]
  };
  it.board = it.legs.find((l) => l.mode !== 'WALK' && l.mode !== 'STOP') || null;
  return it;
}

// ——— Prochains passages à une station ———
const MOTIS = 'https://api.transitous.org/api';
const RAIL = new Set(['SUBWAY', 'METRO', 'TRAM', 'RAIL', 'SUBURBAN', 'REGIONAL_RAIL', 'REGIONAL_FAST_RAIL',
  'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'FUNICULAR']);
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Arrêt de transport correspondant à une station de la carte (même nom, le plus proche). */
async function findStop(name, lat, lon, signal) {
  const d = 0.004;
  const res = await fetch(`${MOTIS}/v1/map/stops?min=${lat - d},${lon - d}&max=${lat + d},${lon + d}`, { signal });
  if (!res.ok) throw new Error(`transitous-${res.status}`);
  const stops = await res.json();
  const n = norm(name).replace(/^(gare|station) (de |du |d )?/, '');
  const dist = (s) => Math.hypot(s.lat - lat, (s.lon - lon) * Math.cos((lat * Math.PI) / 180));
  const rail = stops.filter((s) => s.modes?.some((m) => RAIL.has(m)));
  const named = rail.filter((s) => { const k = norm(s.name); return k && (k.includes(n) || n.includes(k)); });
  const pool = named.length ? named : rail.filter((s) => dist(s) < 0.0025); // ~250 m
  return pool.sort((a, b) => dist(a) - dist(b))[0] || null;
}

/**
 * Prochains passages (métro, RER, tram, train) : une ligne par ligne + direction,
 * avec jusqu'à 3 départs. @returns {Promise<{name:string, lines:object[]}|null>}
 */
export async function departures(name, lat, lon, signal) {
  const stop = await findStop(name, lat, lon, signal);
  if (!stop) return null;
  const res = await fetch(`${MOTIS}/v5/stoptimes?stopId=${encodeURIComponent(stop.stopId)}&n=120`, { signal });
  if (!res.ok) throw new Error(`transitous-${res.status}`);
  const { stopTimes = [] } = await res.json();
  const now = Date.now();
  const groups = new Map();
  for (const s of stopTimes) {
    if (!RAIL.has(s.mode) || s.cancelled || s.tripCancelled) continue;
    const when = new Date(s.place.departure || s.place.arrival);
    if (when - now < -30000) continue;
    // Le RER affiche un code de mission (« KARI ») : on prend le vrai terminus du train.
    const dest = s.tripTo?.name || s.headsign || '';
    const key = `${s.mode}|${s.routeShortName}|${dest}`;
    let g = groups.get(key);
    if (!g) {
      g = { mode: s.mode, line: s.routeShortName || MODE_NAMES[s.mode] || tx('ecran.train'), headsign: dest,
        color: s.routeColor ? `#${s.routeColor}` : '#5B6573',
        textColor: s.routeTextColor ? `#${s.routeTextColor}` : '#FFFFFF', times: [], realTime: false };
      groups.set(key, g);
    }
    if (g.times.length < 3 && !g.times.some((t) => Math.abs(t - when) < 30000)) g.times.push(when);
    g.realTime ||= s.realTime;
  }
  const order = (g) => (g.mode === 'SUBWAY' || g.mode === 'METRO' ? 0 : g.mode === 'TRAM' ? 2 : 1);
  const lines = [...groups.values()]
    .sort((a, b) => order(a) - order(b) || a.line.localeCompare(b.line, 'fr', { numeric: true }) || a.times[0] - b.times[0])
    .slice(0, 12);
  return { name: stop.name, lines };
}

/** « 2 min », « à quai » ou l'heure si c'est loin. */
export function fmtWait(d, now = Date.now()) {
  const m = Math.round((d - now) / 60000);
  if (m <= 0) return tx('itin.a_quai');
  if (m < 60) return `${m} min`;
  return fmtTime(d);
}

export const MODE_NAMES = {
  SUBWAY: tx('itin.metro'), METRO: tx('itin.metro'), BUS: tx('itin.bus'), TRAM: tx('itin.tram'), RAIL: tx('ecran.train'), REGIONAL_RAIL: 'RER',
  SUBURBAN: 'RER', COACH: tx('itin.car'), FERRY: tx('itin.bateau'), FUNICULAR: tx('itin.funiculaire'), CABLE_CAR: tx('itin.telepherique'),
  HIGHSPEED_RAIL: tx('ecran.train'), LONG_DISTANCE: tx('ecran.train'), NIGHT_RAIL: tx('itin.train_de_nuit'), REGIONAL_FAST_RAIL: tx('ecran.train')
};

export function fmtDuration(seconds) {
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')}`;
}

export function fmtTime(d) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
}

export function fmtDistance(m) {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 9500 ? 1 : 0).replace('.', ',')} km`;
}
