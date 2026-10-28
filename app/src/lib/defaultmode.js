// Mode de déplacement proposé par défaut (porteur, 22/10 : « pas bien que ça propose juste à pied »).
// Comme Google Maps : le dernier mode choisi, retenu sur le téléphone. En plus (choix maison) : un garde-fou
// quand ce mode donnerait un trajet déraisonnable (40 min à pied) → les transports.
// Garde-fou inverse (porteur, 28/10 : « à 110 m d'un restaurant, il me propose le métro, 8 min ») : tout près
// (10 min à pied au plus), à pied, quel que soit le dernier mode.
// Sans historique : à pied si c'est court, sinon les transports.
import { tx } from '#lib/i18n/index.js';

const KEY = 'mode-trajet';
const DETOUR = 1.3;                  // la rue n'est pas à vol d'oiseau
// vitesses moyennes « porte à porte » à Paris, en mètres par minute (estimations, pas des calculs d'itinéraire)
const SPEED = { walk: 80, bike: 250, car: 300, transit: 330 };
const WAIT = { walk: 0, bike: 2, car: 5, transit: 8 };      // attente, stationnement, accès au quai
const MAX = { walk: 25, bike: 45 };                          // au-delà, on propose les transports
const NEAR_WALK = 10;                                        // en deçà (minutes à pied), on propose la marche
export const MODES_IDS = ['walk', 'bike', 'transit', 'car'];

export function readLastMode() {
  try { const m = localStorage.getItem(KEY); return MODES_IDS.includes(m) ? m : null; } catch { return null; }
}
export function saveLastMode(m) {
  try { if (MODES_IDS.includes(m)) localStorage.setItem(KEY, m); } catch { /* rien */ }
}

/** Minutes estimées pour `meters` à vol d'oiseau. */
export const estimateMin = (mode, meters) => Math.max(1, Math.round((meters * DETOUR) / SPEED[mode] + WAIT[mode]));

/**
 * @param {string|null} last  dernier mode choisi (ou null)
 * @param {number|null} meters  distance à vol d'oiseau (null : inconnue)
 */
export function pickMode(last, meters) {
  if (meters == null) return last || 'transit';
  const tooLong = (m) => MAX[m] != null && estimateMin(m, meters) > MAX[m];
  if (estimateMin('walk', meters) <= NEAR_WALK) return 'walk';
  if (last) return tooLong(last) ? 'transit' : last;
  return estimateMin('walk', meters) <= 20 ? 'walk' : 'transit';
}

/** Ce qu'affiche le bouton de la fiche lieu : { mode, text, label } ; « ≈ » quand l'estimation est grossière. */
export function placeEta(last, meters) {
  if (meters == null || meters < 60) return null;
  const mode = pickMode(last, meters);
  const min = estimateMin(mode, meters);
  const rough = mode === 'transit' || mode === 'car';
  const text = rough ? tx('fiche.environ_min', { min }) : tx('fiche.n_min', { min });
  const name = { walk: tx('fiche.mode_walk'), bike: tx('fiche.mode_bike'), transit: tx('fiche.mode_transit'), car: tx('fiche.mode_car') }[mode];
  return { mode, text, label: tx('fiche.itineraire_en', { mode: name, duree: text }) };
}
