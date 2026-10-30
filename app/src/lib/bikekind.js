// Vélo classique ou vélo électrique (P8, 30/10/2026 : la raison pour laquelle il utilise Géovélo). Le choix est gardé
// sur le téléphone. Un vélo électrique roule plus vite en moyenne et ne craint pas les côtes : Valhalla en tient compte
// (cycling_speed, use_hills ; mesuré le 30/10 sur Montmartre → Panthéon : 23 min → 20 min).
export const BIKE_KEY = 'velo-type';
export const BIKE_KINDS = ['classic', 'electric'];

/** Options de calcul Valhalla pour le vélo. */
export function bikeOptions(kind) {
  const base = { bicycle_type: 'City', use_roads: 0.25 };
  return kind === 'electric' ? { ...base, cycling_speed: 22, use_hills: 0.9 } : base;
}

export function readBikeKind(store = globalThis.localStorage) {
  try { const k = store?.getItem(BIKE_KEY); return BIKE_KINDS.includes(k) ? k : 'classic'; } catch { return 'classic'; }
}
export function saveBikeKind(kind, store = globalThis.localStorage) {
  try { store?.setItem(BIKE_KEY, kind); } catch { /* navigation privée */ }
}
