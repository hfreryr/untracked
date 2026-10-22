// Style de carte maison, sur les tuiles vectorielles OpenFreeMap (schéma OpenMapTiles).
// Intention : une carte calme et nette. Îlots crème, rues grises pleines sans liseré (comme Plans),
// voies rapides ambrées, parcs et eau doux, bâtiments en léger relief, et des lieux
// signalés par une pastille colorée à pictogramme blanc. Police : Inter (SIL OFL), hébergée avec l'app.
import { isDark } from '#lib/theme.js';

export const C = {
  land: '#F4EFDF',
  landAlt: '#EFEADA',      // zones commerciales et équipements
  pedestrian: '#EAEAEA',
  building: '#EFE8D3',
  buildingEdge: '#E6DEC6',
  building3d: '#EAE6E0',
  park: '#D4EBCB',
  wood: '#C7E3BC',
  water: '#ABD4F2',
  waterLabel: '#4A84B5',
  road: '#CBD1D1',
  roadCase: '#CCD1D1',      // en mode clair, contour de la même couleur que la rue : pas de liseré (comme Plans)
  majorCase: '#CDD2D2',
  highway: '#FAD98A',
  highwayCase: '#EDC060',
  path: '#D3CEC6',
  rail: '#CCC8C1',
  label: '#2E3135',
  labelSoft: '#7C8187',
  roadLabel: '#6A6E73',
  halo: '#FFFFFF'
};

export const FONT = {
  // Inter (SIL OFL 1.1), la plus proche des polices système des téléphones ; glyphes préparés par
  // scripts/build_fonts.sh dans static/fonts/ (servis avec l'app, rien chez Google).
  regular: ['Inter Regular'],
  medium: ['Inter Medium'],
  semibold: ['Inter SemiBold'],
  bold: ['Inter Bold'],
  italic: ['Inter Italic']
};

// Familles de lieux : couleur, pictogramme et sous-classes OpenMapTiles.
export const FAMILIES = {
  food:    { color: '#E8742F', icon: 'utensils', classes: ['restaurant', 'fast_food', 'food_court', 'ice_cream', 'deli'] },
  cafe:    { color: '#E8742F', icon: 'cup',      classes: ['cafe'] },
  bar:     { color: '#E8742F', icon: 'glass',    classes: ['bar', 'pub', 'beer', 'biergarten', 'nightclub', 'wine', 'alcohol_shop'] },
  bakery:  { color: '#E8742F', icon: 'bread',    classes: ['bakery', 'pastry', 'confectionery'] },
  shop:    { color: '#4169D8', icon: 'bag',      classes: ['shop', 'clothing_store', 'clothes', 'grocery', 'supermarket', 'convenience', 'books', 'jewelry', 'shoes', 'florist', 'gift', 'butcher', 'cheese', 'hairdresser', 'beauty', 'optician', 'furniture', 'art', 'antiques', 'mall', 'department_store', 'stationery', 'toys', 'mobile_phone', 'electronics', 'bicycle', 'sports', 'cosmetics', 'perfumery'] },
  culture: { color: '#12919E', icon: 'columns',  classes: ['museum', 'art_gallery', 'gallery', 'theatre', 'cinema', 'arts_centre', 'library'] },
  sight:   { color: '#12919E', icon: 'star',     classes: ['attraction', 'monument', 'castle', 'viewpoint', 'memorial', 'place_of_worship', 'church', 'cathedral'] },
  nature:  { color: '#3E8E52', icon: 'tree',     classes: ['park', 'garden', 'playground', 'zoo', 'nature_reserve'] },
  health:  { color: '#D84A45', icon: 'cross',    classes: ['pharmacy', 'hospital', 'doctors', 'dentist', 'clinic', 'veterinary'] },
  stay:    { color: '#9A55A0', icon: 'bed',      classes: ['hotel', 'hostel', 'guest_house', 'lodging', 'motel'] },
  money:   { color: '#4F7A6B', icon: 'note',     classes: ['atm', 'bank', 'bureau_de_change'] },
  fuel:    { color: '#4F6FA0', icon: 'pump',     classes: ['fuel'] }
};
export const FAV_COLOR = '#D63A7A';
const OTHER = { color: '#7D838A', icon: 'dot' };
const TRAIN = { color: '#2B4793', icon: 'train' };
const LANDMARK_FAMILY = { culture: 'culture', sight: 'sight', nature: 'nature', health: 'health', shop: 'shop' };
const ALL_CLASSES = [...new Set(Object.values(FAMILIES).flatMap((f) => f.classes))];

export function familyOf(subclass) {
  for (const f of Object.values(FAMILIES)) if (f.classes.includes(subclass)) return f;
  return OTHER;
}

function matchBy(prop, pick, fallback) {
  const m = ['match', ['get', 'subclass']];
  for (const f of Object.values(FAMILIES)) m.push(f.classes, pick(f));
  m.push(fallback);
  return m;
}
const POI_ICON = matchBy('subclass', (f) => `poi-${f.icon}`, 'poi-dot');
const POI_TEXT = matchBy('subclass', (f) => darken(f.color), darken(OTHER.color));
// Priorité d'affichage quand les lieux se chevauchent : manger et boire d'abord, puis culture,
// santé, hébergement, nature, commerces (comme les cartes de référence en ville).
const PRIORITY = { food: 0, cafe: 0, bar: 0.5, bakery: 0.5, culture: 1, sight: 1, health: 2, stay: 2.5, nature: 3, shop: 4, money: 4.5, fuel: 4.5 };
const POI_PRI = (() => {
  const m = ['match', ['get', 'subclass']];
  for (const [k, f] of Object.entries(FAMILIES)) m.push(f.classes, PRIORITY[k] ?? 5);
  m.push(5);
  return m;
})();
const POI_SORT = ['+', POI_PRI, ['/', ['min', ['get', 'rank'], 999], 1000]];

export function darken(hex, k = 0.78) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Familles du calque de lieux choisis (monuments compris) et filtre « z ≤ zoom courant ».
const PLACE_FAMILIES = { ...FAMILIES, train: { color: '#2B4793', icon: 'train', text: '#2B4793' },
  culture: { ...FAMILIES.culture, text: '#0E7681' }, sight: { ...FAMILIES.sight, text: '#0E7681' },
  nature: { ...FAMILIES.nature, text: '#2F6E3F' }, health: { ...FAMILIES.health, text: '#A8392F' },
  shop: { ...FAMILIES.shop, text: '#3253AA' } };
// MapLibre ne sait pas comparer une donnée au zoom directement : on énumère les paliers de 0,25.
const VISIBLE_AT_ZOOM = (() => {
  const e = ['step', ['zoom'], ['<=', ['get', 'z'], 11.5]];
  for (let z = 11.75; z <= 16.75; z += 0.25) e.push(z, ['<=', ['get', 'z'], z]);
  return e;
})();

const NAME = ['coalesce', ['get', 'name:fr'], ['get', 'name'], ['get', 'name:latin']];
const zoom = (stops, base = 1.5) => ['interpolate', ['exponential', base], ['zoom'], ...stops];
const fade = (from, to) => ['interpolate', ['linear'], ['zoom'], from, 0, to, 1];

function roadPair(id, classes, { color, casing, widths, minzoom = 0, caseFade }) {
  const filter = ['all', ['match', ['get', 'class'], classes, true, false], ['!=', ['get', 'brunnel'], 'tunnel']];
  const caseWidths = widths.map((v, i) => (i % 2 ? v + 0.9 : v));
  return [
    { id: `${id}-case`, type: 'line', source: 'omt', 'source-layer': 'transportation', filter, minzoom,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': casing, 'line-width': zoom(caseWidths), ...(caseFade ? { 'line-opacity': fade(...caseFade) } : {}) } },
    { id, type: 'line', source: 'omt', 'source-layer': 'transportation', filter, minzoom,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': zoom(widths) } }
  ];
}

// ——— Mode sombre ———
// Même carte, couleurs traduites une à une : fond gris-bleu profond, rues gris moyen, eau et
// parcs sourds, textes clairs. Les pastilles de lieux gardent leurs couleurs (repères connus).
export const DARK_LAND = '#1E2126';
const DARK_HALO = 'rgba(22,24,28,0.9)';
const DARK = {
  '#1C8B3C': '#3DBE6A', '#3FA35C': '#7FD69B',          // carte vélo : verts plus clairs sur fond sombre
  '#F6F4F0': DARK_LAND, '#F4F0E6': DARK_LAND, '#EEE5CE': '#2A2E34', '#E2D7BC': '#33373E',
  '#D9D4CB': '#2B2F35', '#CDC7BC': '#31353C', '#D2CDC4': '#3A3F47',
  // palette claire du 14/10 (rues grises sans contour, îlots crème) : le mode sombre garde ses couleurs
  '#F4EFDF': DARK_LAND, '#EFEADA': '#22262B', '#EAEAEA': '#262A30', '#EFE8D3': '#2A2E34', '#E6DEC6': '#33373E',
  '#CBD1D1': '#3A3F47', '#CCD1D1': '#2B2F35', '#CDD2D2': '#31353C', '#F1EEE8': '#22262B', '#FBFAF7': '#262A30',
  '#D4EBCB': '#1F3326', '#C7E3BC': '#1C3022', '#ABD4F2': '#16304A',
  '#E8E5DF': '#2A2E34', '#E3DFD9': '#33373E',
  '#D3CEC6': '#4A4F57', '#EEEBE6': '#2B2F35', '#E9E5DF': '#31353C',
  '#EDC060': '#5E4C22', '#FAD98A': '#7A6430', '#CCC8C1': '#474B52', '#C9C3BA': '#4A4E55',
  '#4A84B5': '#7DB0DA', '#8C9096': '#9AA0A6', '#6A6E73': '#A3A8AE', '#5F656C': '#AEB3B9',
  '#2B4793': '#9DB2F2', '#7C8187': '#8A9097', '#2E3135': '#E6E8EB', '#A2A6AB': '#6F757C',
  '#62666C': '#B0B5BB',
  // noms des lieux, par famille
  '#B55A25': '#F0A06A', '#3352A8': '#8FA8F0', '#3253AA': '#8FA8F0', '#0E717B': '#5FC6D0', '#0E7681': '#5FC6D0',
  '#306F40': '#7CC48D', '#2F6E3F': '#7CC48D', '#A83A36': '#F08A85', '#A8392F': '#F08A85', '#78427D': '#D29AD6'
};
function darkify(style) {
  const tr = (v, prop) => {
    if (typeof v === 'string') {
      const u = v.toUpperCase();
      if (u === '#FFFFFF') return prop.startsWith('text-halo') ? DARK_HALO : '#3A3F47';   // halo des textes / rues
      if (u.startsWith('RGBA(255,255,255')) return DARK_HALO;
      return DARK[u] || v;
    }
    return Array.isArray(v) ? v.map((x) => tr(x, prop)) : v;
  };
  for (const l of style.layers) {
    if (!l.paint) continue;
    for (const [k, v] of Object.entries(l.paint)) l.paint[k] = tr(v, k);
  }
  return style;
}

export function mapStyle(base = '', dark = false) {
  const style = lightStyle(base);
  return dark ? darkify(style) : style;
}

function lightStyle(base) {
  return {
    version: 8,
    glyphs: `${base}fonts/{fontstack}/{range}.pbf`,
    sources: {
      landmarks: { type: 'geojson', data: `${base}data/landmarks.geojson`, promoteId: 'rank' },
      transit: { type: 'geojson', data: `${base}data/transit-lines.geojson` },
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet',
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a>' }
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': C.land } },
      { id: 'landuse-alt', type: 'fill', source: 'omt', 'source-layer': 'landuse', minzoom: 12,
        filter: ['match', ['get', 'class'], ['commercial', 'retail', 'hospital', 'school', 'university', 'college', 'railway'], true, false],
        paint: { 'fill-color': C.landAlt } },
      { id: 'landuse-green', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['cemetery', 'pitch', 'stadium', 'playground', 'garden'], true, false],
        paint: { 'fill-color': C.park, 'fill-opacity': 0.85 } },
      { id: 'landcover', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['grass', 'wood', 'farmland', 'wetland'], true, false],
        paint: { 'fill-color': ['match', ['get', 'class'], 'wood', C.wood, C.park] } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': C.park } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.water } },
      { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway',
        paint: { 'line-color': C.water, 'line-width': zoom([10, 1, 18, 8]) } },
      { id: 'pedestrian-area', type: 'fill', source: 'omt', 'source-layer': 'transportation', minzoom: 15,
        filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['match', ['get', 'subclass'], ['pedestrian', 'platform'], true, false]],
        paint: { 'fill-color': C.pedestrian } },

      { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14,
        paint: { 'fill-color': C.building, 'fill-outline-color': C.buildingEdge, 'fill-opacity': fade(14, 15) } },
      { id: 'building-edge', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 16,
        paint: { 'line-color': C.buildingEdge, 'line-width': 0.5, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 16, 0, 17, 0.6] } },

      { id: 'pedestrian-street', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 14.5,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'subclass'], 'pedestrian']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.road, 'line-width': zoom([14.5, 1, 16, 4, 19, 16]) } },
      { id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 16,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['match', ['get', 'subclass'], ['path', 'track', 'bridleway', 'steps'], true, false]],
        paint: { 'line-color': C.path, 'line-width': zoom([16, 0.8, 19, 2]), 'line-dasharray': [2.5, 2] } },
      // rues grises à tous les zooms, sans liseré (comme Plans)
      ...roadPair('road-minor', ['minor', 'service'], { color: C.road, casing: C.roadCase, widths: [12, 0.4, 14, 1.6, 16, 6, 19, 22], caseFade: [14, 15] }),
      ...roadPair('road-mid', ['tertiary', 'secondary'], { color: C.road, casing: C.majorCase, widths: [10, 0.6, 14, 3.2, 16, 9, 19, 30] }),
      ...roadPair('road-major', ['primary', 'trunk'], { color: C.road, casing: C.majorCase, widths: [8, 0.8, 14, 4.6, 16, 12, 19, 36] }),
      ...roadPair('road-highway', ['motorway'], { color: C.highway, casing: C.highwayCase, widths: [6, 0.8, 14, 5.5, 16, 13, 19, 38] }),
      { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12,
        filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel']],
        paint: { 'line-color': C.rail, 'line-width': zoom([12, 0.8, 18, 2.5]) } },
      { id: 'boundary-city', type: 'line', source: 'omt', 'source-layer': 'boundary', maxzoom: 13,
        filter: ['==', ['get', 'admin_level'], 8],
        paint: { 'line-color': '#C9C3BA', 'line-width': 1, 'line-dasharray': [3, 2] } },

      // Carte vélo (porteur, 22/10) : masquée par défaut ; affichée par le menu des types de carte ou pendant un
      // itinéraire à vélo. Pistes séparées en vert plein ; rues et allées où le vélo est autorisé en pointillés, en zoom
      // seulement (sinon la carte est trop chargée). Les bandes peintes sur la chaussée ne sont pas dans ces tuiles.
      { id: 'bike-shared', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 15.5,
        filter: ['all', ['==', ['get', 'class'], 'path'], ['!=', ['get', 'subclass'], 'cycleway'],
          ['in', ['get', 'bicycle'], ['literal', ['yes', 'designated', 'permissive']]]],
        layout: { visibility: 'none', 'line-cap': 'round' },
        paint: { 'line-color': '#3FA35C', 'line-width': zoom([15.5, 1.6, 18, 3.5]), 'line-dasharray': [1.5, 1.5] } },
      { id: 'bike-track', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
        filter: ['all', ['==', ['get', 'class'], 'path'], ['==', ['get', 'subclass'], 'cycleway']],
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1C8B3C', 'line-width': zoom([11, 0.8, 14, 1.8, 17, 5]) } },

      // Plan des transports : masqué par défaut, affiché par le bouton de modes.
      { id: 'transit-case', type: 'line', source: 'transit', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.8, 14, 3.2, 17, 5.5] } },
      { id: 'transit-line', type: 'line', source: 'transit', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round',
          'line-sort-key': ['match', ['get', 'mode'], 'rer', 2, 'metro', 1, 0] },
        paint: { 'line-color': ['get', 'colour'],
                 // traits fins, comme les plans de référence (le RER un peu plus épais que le métro)
                 'line-width': ['interpolate', ['linear'], ['zoom'], 11, ['match', ['get', 'mode'], 'rer', 1.4, 0.9], 14, ['match', ['get', 'mode'], 'rer', 2.4, 1.8], 17, ['match', ['get', 'mode'], 'rer', 3.8, 3]] } },
      // Numéro de la ligne en petite pastille posée sur le tracé : rond (métro), carré (RER), rectangle (tram).
      { id: 'transit-label', type: 'symbol', source: 'transit', minzoom: 11.5,
        layout: { visibility: 'none', 'symbol-placement': 'line', 'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12, 220, 16, 420],
                  'icon-image': ['concat', 'tl|', ['get', 'mode'], '|', ['get', 'ref'], '|', ['get', 'colour']],
                  'icon-rotation-alignment': 'viewport', 'icon-size': ['interpolate', ['linear'], ['zoom'], 11.5, 0.8, 15, 1],
                  'icon-padding': 2, 'symbol-sort-key': ['match', ['get', 'mode'], 'rer', 0, 'metro', 1, 2] } },
      ...['Point', 'LineString'].map((g) => ({
        id: `water-name-${g === 'Point' ? 'point' : 'line'}`, type: 'symbol', source: 'omt', 'source-layer': 'water_name',
        filter: ['==', ['geometry-type'], g],
        layout: { 'text-field': NAME, 'text-font': FONT.italic, 'text-size': zoom([12, 12, 16, 15]), 'text-letter-spacing': 0.08,
                  'symbol-placement': g === 'Point' ? 'point' : 'line' },
        paint: { 'text-color': C.waterLabel, 'text-halo-color': 'rgba(255,255,255,0.6)', 'text-halo-width': 1 } })),
      { id: 'road-name-major', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 12.5, maxzoom: 14,
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false],
        layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': FONT.semibold, 'text-size': 9.5,
                  'text-transform': 'uppercase', 'text-letter-spacing': 0.06, 'text-max-angle': 25, 'symbol-spacing': 400 },
        paint: { 'text-color': '#8C9096', 'text-halo-color': C.halo, 'text-halo-width': 1.4 } },
      { id: 'road-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14,
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'], true, false],
        // noms de rues en capitales espacées, comme Plans
        layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': FONT.medium, 'text-transform': 'uppercase',
                  'text-size': zoom([14, 9.5, 17, 11.5, 19, 13]), 'text-max-angle': 28, 'symbol-spacing': 320,
                  'text-letter-spacing': 0.07 },
        paint: { 'text-color': C.roadLabel, 'text-halo-color': C.halo, 'text-halo-width': 1.3 } },

      // Autres lieux (banques, bureaux, services) : seulement de très près.
      { id: 'poi-other', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 18,
        filter: ['all', ['has', 'name'], ['!', ['match', ['get', 'subclass'], ALL_CLASSES, true, false]],
                 ['!', ['match', ['get', 'class'], ['bus', 'railway', 'entrance', 'ferry_terminal', 'school', 'college'], true, false]]],
        layout: { 'icon-image': 'poi-dot', 'icon-size': 0.85, 'text-field': NAME, 'text-font': FONT.semibold, 'text-size': 11.5,
                  'text-anchor': 'left', 'text-offset': [1.05, 0], 'text-max-width': 8, 'text-optional': true, 'symbol-sort-key': ['get', 'rank'] },
        paint: { 'text-color': '#5F656C', 'text-halo-color': C.halo, 'text-halo-width': 1.6 } },
      // Stations de métro et RER : pastille « M », nom à partir du zoom 14,5.
      // Toujours affichées (icône prioritaire) : c'est ce qu'on cherche en premier en ville.
      { id: 'metro', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 13,
        filter: ['all', ['==', ['get', 'class'], 'railway'], ['match', ['get', 'subclass'], ['subway', 'station', 'halt'], true, false]],
        layout: { 'icon-image': 'metro', 'icon-size': zoom([13, 0.62, 16, 1]), 'icon-allow-overlap': true, 'icon-padding': 0,
                  'text-field': ['step', ['zoom'], '', 14.5, NAME], 'text-font': FONT.semibold,
                  'text-size': 12, 'text-anchor': 'left', 'text-offset': [1.0, 0], 'text-optional': true },
        paint: { 'text-color': '#2B4793', 'text-halo-color': C.halo, 'text-halo-width': 1.6 } },

      // Sorties de métro : petit carré vert, nom de la sortie de très près.
      { id: 'exit', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 17,
        filter: ['==', ['get', 'subclass'], 'subway_entrance'],
        layout: { 'icon-image': 'exit', 'icon-size': 1, 'text-field': ['step', ['zoom'], '', 18, NAME], 'text-font': FONT.regular,
                  'text-size': 10.5, 'text-anchor': 'left', 'text-offset': [0.9, 0], 'text-max-width': 9, 'text-optional': true },
        paint: { 'text-color': '#2E6B4A', 'text-halo-color': C.halo, 'text-halo-width': 1.4 } },

      { id: 'place-small', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 12, maxzoom: 17,
        filter: ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood'], true, false],
        layout: { 'text-field': NAME, 'text-font': FONT.bold, 'text-size': zoom([12, 10.5, 16, 13]),
                  'text-transform': 'uppercase', 'text-letter-spacing': 0.06, 'text-max-width': 7 },
        paint: { 'text-color': C.labelSoft, 'text-halo-color': 'rgba(255,255,255,0.8)', 'text-halo-width': 1.4 } },
      { id: 'place-city', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 13,
        filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
        layout: { 'text-field': NAME, 'text-font': FONT.bold, 'text-size': zoom([6, 13, 12, 22]) },
        paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 2 } },
      // Lieux en dernier : ils sont placés en premier et passent devant métro et noms de quartier.
      // À partir du zoom 17 : les autres lieux du fond de carte (manger, boire, culture, hôtels),
      // puis les boutiques à 17,5. Les lieux choisis ci-dessus gardent la priorité.
      { id: 'poi', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 17,
        filter: ['all', ['has', 'name'], ['match', ['get', 'subclass'], ALL_CLASSES, true, false],
                 ['<=', POI_PRI, ['step', ['zoom'], 2.5, 17.5, 9]]],
        layout: { 'icon-image': POI_ICON, 'icon-size': 1,
                  'text-field': NAME, 'text-font': FONT.semibold, 'text-size': 12, 'text-anchor': 'left',
                  'text-offset': [1.0, 0], 'text-max-width': 8, 'text-line-height': 1.15,
                  'text-optional': false, 'symbol-sort-key': POI_SORT },
        paint: { 'text-color': POI_TEXT, 'text-halo-color': C.halo, 'text-halo-width': 1.6 } },
      // Lieux choisis à l'avance (monuments et bonnes adresses), chacun avec son zoom
      // d'apparition « z » calculé pour garder un écart régulier à l'écran (voir scripts/build_overlays.py).
      { id: 'landmark', type: 'symbol', source: 'landmarks', minzoom: 11.5, maxzoom: 18.5,
        filter: VISIBLE_AT_ZOOM,
        layout: { 'icon-image': ['match', ['get', 'family'], ...Object.entries(PLACE_FAMILIES).flatMap(([k, f]) => [k, `poi-${f.icon}`]), 'poi-dot'],
                  'icon-size': zoom([11.5, 0.8, 14, 0.9, 16.5, 1]),
                  'text-field': ['get', 'name'], 'text-font': FONT.semibold, 'text-size': zoom([11.5, 10.5, 14, 11.5, 16, 12]),
                  'text-anchor': 'left', 'text-offset': [1.0, 0], 'text-max-width': 8, 'text-line-height': 1.1,
                  'text-optional': false, 'symbol-sort-key': ['get', 'rank'] },
        paint: { 'text-color': ['match', ['get', 'family'], ...Object.entries(PLACE_FAMILIES).flatMap(([k, f]) => [k, f.text || darken(f.color)]), '#5F656C'],
                 'text-halo-color': C.halo, 'text-halo-width': 1.6 } },
      // Lieux mis en avant par un raccourci de catégorie (filtre posé par l'app).
      { id: 'poi-hit', type: 'symbol', source: 'omt', 'source-layer': 'poi', filter: ['==', ['get', 'subclass'], '__none__'],
        layout: { 'icon-image': POI_ICON, 'icon-size': 1.2, 'icon-allow-overlap': true,
                  'text-field': NAME, 'text-font': FONT.bold, 'text-size': 12.5, 'text-anchor': 'left',
                  'text-offset': [1.3, 0], 'text-max-width': 8, 'text-optional': true },
        paint: { 'text-color': POI_TEXT, 'text-halo-color': C.halo, 'text-halo-width': 1.8 } },

      { id: 'housenumber', type: 'symbol', source: 'omt', 'source-layer': 'housenumber', minzoom: 18,
        layout: { 'text-field': ['get', 'housenumber'], 'text-font': FONT.regular, 'text-size': 10.5 },
        paint: { 'text-color': '#A2A6AB' } }
    ]
  };
}

// ——— Pictogrammes (dessins originaux, grille 24×24) ———
export const GLYPHS = {
  utensils: 'M7 3v7.5a2 2 0 0 0 1.5 1.9V21h1.6v-8.6a2 2 0 0 0 1.5-1.9V3h-1.3v6H9.6V3H8.4v6H7.7V3zM15.5 3c-1.6 0-2.6 2.6-2.6 5.6v4.2h2V21h1.6V3z',
  cup: 'M5 7h11v5.5A4.5 4.5 0 0 1 11.5 17h-2A4.5 4.5 0 0 1 5 12.5zM16 8.5h1.2a2.6 2.6 0 0 1 0 5.2H15.6v-1.7h1.6a.9.9 0 0 0 0-1.8H16zM4 18.5h13V20H4z',
  glass: 'M5 4h14l-6 7.3V18h3.5v2h-9v-2H11v-6.7zM8.5 6l2.2 2.6h2.6L15.5 6z',
  bread: 'M6.5 8C4.5 8 3 9.3 3 11c0 1.1.6 2 1.5 2.5V18h15v-4.5c.9-.5 1.5-1.4 1.5-2.5 0-1.7-1.5-3-3.5-3zM8 11.4l1.4-1.4 1 1-1.4 1.4zm3.3 0 1.4-1.4 1 1-1.4 1.4zm3.3 0 1.4-1.4 1 1-1.4 1.4z',
  bag: 'M6 8h12l1 12H5zM9 8V7a3 3 0 0 1 6 0v1h-1.6V7a1.4 1.4 0 0 0-2.8 0v1z',
  columns: 'M12 3 3.5 7.5V9h17V7.5zM5.5 10.2h2.2v6.6H5.5zm5.4 0h2.2v6.6h-2.2zm5.4 0h2.2v6.6h-2.2zM4 18h16v2H4z',
  star: 'M12 3.2l2.6 5.5 6 .7-4.5 4.1 1.2 5.9L12 16.4l-5.3 3 1.2-5.9L3.4 9.4l6-.7z',
  tree: 'M12 2.8 6.6 10h2.6l-3.7 5h5.3v5.2h2.4V15h5.3l-3.7-5h2.6z',
  cross: 'M9.6 4h4.8v5.6H20v4.8h-5.6V20H9.6v-5.6H4V9.6h5.6z',
  bed: 'M3 6h2v6.5h6V9h6.5a3.5 3.5 0 0 1 3.5 3.5V19h-2v-2.5H5V19H3zM8 8.4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z',
  train: 'M7.5 3h9A2.5 2.5 0 0 1 19 5.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 14.5v-9A2.5 2.5 0 0 1 7.5 3zM7 6v4h10V6zm1.8 6.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm6.4 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM8 18h2l-1.5 3H6.5zm6 0h2l1.5 3h-2z',
  heart: 'M12 20.3l-1.3-1.2C6 14.9 3 12.2 3 8.9 3 6.2 5.1 4 7.8 4c1.5 0 3 .7 4.2 1.9C13.2 4.7 14.7 4 16.2 4 18.9 4 21 6.2 21 8.9c0 3.3-3 6-7.7 10.2z',
  note: 'M3 7h18v10H3zM12 9.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4zM5 9v1.6h1.6V9zm12.4 4.4V15H19v-1.6z',
  pump: 'M5 4h8.5v16H5zM7 6v4h4.5V6zM14.5 8.3h1.3l2.7 2.7v6.2a2 2 0 0 1-4 0v-3h1.5v3a.5.5 0 0 0 1 0v-5.6l-1.8-1.8h-.7z',
  flag: 'M6 3.5h1.8v17H6zM8.6 4.5h10.4l-2.6 4.2 2.6 4.3H8.6z',
  flower: 'M12 3.2a2.7 2.7 0 0 1 2.5 3.7 2.7 2.7 0 1 1 1 5 2.7 2.7 0 1 1-7 0 2.7 2.7 0 1 1 1-5A2.7 2.7 0 0 1 12 3.2zM11.2 14h1.6v7h-1.6zM12.8 18.2c.6-1.6 2-2.6 3.9-2.6-.3 1.8-1.8 3-3.9 3z',
  book: 'M3.5 5H9a3 3 0 0 1 2.2 1v13A3 3 0 0 0 9 18H3.5zM20.5 5H15a3 3 0 0 0-2.2 1v13A3 3 0 0 1 15 18h5.5z',
  scissors: 'M7 3.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 1.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM7 14.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 1.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM9.4 8.6 20.5 17.4l-1.3 1.3-10.6-8.3zM12.6 12.9l6.6-7.6 1.3 1.3-6.4 7.4z',
  envelope: 'M3 6h18v12H3zM5 8v.4l7 4.8 7-4.8V8l-7 4.6z',
  bike: 'M6 11a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM18 11a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM9.5 6h4v1.6h-1.4l1.4 3.4-1.5.6-.5-1.3-2.7 4.5-1.4-.8L10.6 8.6 9.5 7.6z',
  drop: 'M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z',
  paw: 'M8.2 5.5a1.8 2.2 0 1 1 0 4.4 1.8 2.2 0 0 1 0-4.4zm7.6 0a1.8 2.2 0 1 1 0 4.4 1.8 2.2 0 0 1 0-4.4zM4.9 10a1.7 2 0 1 1 0 4 1.7 2 0 0 1 0-4zm14.2 0a1.7 2 0 1 1 0 4 1.7 2 0 0 1 0-4zM12 11.8c2.6 0 5 3.4 5 5.4 0 1.6-1.4 2.2-2.6 2.2-1 0-1.6-.5-2.4-.5s-1.4.5-2.4.5C8.4 19.4 7 18.8 7 17.2c0-2 2.4-5.4 5-5.4z',
  bolt: 'M13.5 2.5 5 13.5h5.5l-1 8L19 10h-5.6z',
  parking: 'M7 3.5h6a5 5 0 0 1 0 10h-3v7H7zm3 3v4h3a2 2 0 0 0 0-4z',
  ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 8.6v1.6h1.6V8.6zm0 3.2v1.6h1.6v-1.6zm0 3.2v1.6h1.6V15z',
  shield: 'M12 3 19 5.8V11c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V5.8z',
  wrench: 'M15.5 3a5 5 0 0 0-4.8 6.4L3.5 16.6a2 2 0 0 0 2.9 2.9l7.2-7.2A5 5 0 0 0 20.8 8l-3 3-2.8-.8-.8-2.8 3-3A5 5 0 0 0 15.5 3z',
  phone: 'M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM8.2 5v12.5h7.6V5zm3.8 13.6a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z',
  music: 'M9 5.5 19 3v12.5a2.8 2.4 0 1 1-1.8-2.2V7.4L10.8 9v8.5A2.8 2.4 0 1 1 9 15.3z',
  dumbbell: 'M3 10h2V8h2.5v8H5v-2H3zM21 10h-2V8h-2.5v8H19v-2h2zM8.7 11h6.6v2H8.7z',
  laptop: 'M5 5h14v10H5zM6.6 6.6v6.8h10.8V6.6zM2.5 16.5h19L20 19H4z',
  dot: 'M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z'
};

// Pastille : disque coloré, liseré blanc, ombre douce, pictogramme blanc. Rendu en 2× pour l'écran.
export function poiImage(color, glyph, px = 18) {
  const s = 2, size = (px + 6) * s;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = (px / 2) * s, cx = size / 2, cy = size / 2;
  g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 3 * s; g.shadowOffsetY = 0.8 * s;
  g.fillStyle = '#FFFFFF';
  g.beginPath(); g.arc(cx, cy, r + 1.4 * s, 0, Math.PI * 2); g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = color;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  const scale = (r * 1.25) / 24;
  g.save();
  g.translate(cx - 12 * scale, cy - 12 * scale);
  g.scale(scale, scale);
  g.fillStyle = '#FFFFFF';
  g.fill(new Path2D(GLYPHS[glyph] || GLYPHS.dot), 'evenodd');
  g.restore();
  return { data: g.getImageData(0, 0, size, size), pixelRatio: s };
}

// Pastille de ligne de transport : rond (métro), carré arrondi (RER), rectangle arrondi (tram),
// à la couleur officielle de la ligne, numéro en blanc (ou en noir sur les couleurs claires).
export function lineBadge(mode, ref, colour) {
  const s = 2, h = 15;
  const label = mode === 'metro' ? ref.replace('bis', 'b') : ref;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const fontPx = (label.length > 2 ? 8 : label.length > 1 ? 9 : 10) * s;
  const font = `700 ${fontPx}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  g.font = font;
  const textW = g.measureText(label).width;
  const w = mode === 'metro' && label.length <= 2 ? h : Math.max(h, Math.ceil(textW / s) + 7);
  c.width = (w + 2) * s; c.height = (h + 2) * s;
  const ctx = c.getContext('2d');
  const x = s, y = s, W = w * s, H = h * s;
  const r = mode === 'metro' ? H / 2 : mode === 'rer' ? 3.5 * s : 5 * s;
  ctx.beginPath(); ctx.roundRect(x - s * 0.8, y - s * 0.8, W + s * 1.6, H + s * 1.6, r + s * 0.8); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(x, y, W, H, r); ctx.fillStyle = colour; ctx.fill();
  const n = parseInt(colour.slice(1), 16), lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  ctx.fillStyle = lum > 0.62 ? '#1C1D1F' : '#FFFFFF';
  ctx.font = font;   // redimensionner le canevas efface la police : on la remet
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  // centrage optique : on centre la hauteur réelle des chiffres, pas la boîte de la police
  const m = ctx.measureText(label);
  const asc = m.actualBoundingBoxAscent || fontPx * 0.72, desc = m.actualBoundingBoxDescent || 0;
  ctx.fillText(label, x + W / 2, y + H / 2 + (asc - desc) / 2);
  return { data: ctx.getImageData(0, 0, c.width, c.height), pixelRatio: s };
}

// Pastille métro : disque bleu, liseré blanc, « M » blanc.
export function metroImage(px = 18) {
  const s = 2, size = (px + 4) * s;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = (px / 2) * s, cx = size / 2;
  g.fillStyle = '#FFFFFF';
  g.beginPath(); g.arc(cx, cx, r + 1.4 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2B4793';
  g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFFFFF';
  g.font = `700 ${Math.round(r * 1.25)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('M', cx, cx + r * 0.08);
  return { data: g.getImageData(0, 0, size, size), pixelRatio: s };
}

// Lieu sélectionné : son propre pictogramme, en grand (comme les cartes de référence).
/** Pictogramme d'un lieu de la carte : { glyph, color } ou 'metro' ; null si inconnu (adresse, rue…). */
export function pinFor({ subclass, family, layer } = {}) {
  if (layer === 'metro' || ['subway', 'station', 'halt'].includes(subclass) && layer !== 'poi') return 'metro';
  if (family && PLACE_FAMILIES[family]) return { glyph: PLACE_FAMILIES[family].icon, color: PLACE_FAMILIES[family].color };
  const f = familyOf(subclass);
  return f === OTHER ? null : { glyph: f.icon, color: f.color };
}
export const pinImageId = (pin) => (pin === 'metro' ? 'sel-metro' : `sel|${pin.glyph}|${pin.color}`);

function bigPin(color, glyph) {
  // même pastille que sur la carte, deux fois plus grande, avec une ombre plus marquée
  const px = 34, s = 2, size = (px + 10) * s;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = (px / 2) * s, cx = size / 2;
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 6 * s; g.shadowOffsetY = 1.5 * s;
  g.fillStyle = '#FFFFFF';
  g.beginPath(); g.arc(cx, cx, r + 2.2 * s, 0, Math.PI * 2); g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = color;
  g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.fill();
  if (glyph === 'M') {
    g.fillStyle = '#FFFFFF';
    g.font = `700 ${Math.round(r * 1.2)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const m = g.measureText('M');
    g.fillText('M', cx, cx + (m.actualBoundingBoxAscent - (m.actualBoundingBoxDescent || 0)) / 2);
  } else {
    const scale = (r * 1.2) / 24;
    g.save();
    g.translate(cx - 12 * scale, cx - 12 * scale);
    g.scale(scale, scale);
    g.fillStyle = '#FFFFFF';
    g.fill(new Path2D(GLYPHS[glyph] || GLYPHS.dot), 'evenodd');
    g.restore();
  }
  return { data: g.getImageData(0, 0, size, size), pixelRatio: s };
}

// Fournit à la carte toute image demandée par le style.
export function provideImage(map, id) {
  if (map.hasImage(id)) return;
  if (id === 'metro') {
    const { data, pixelRatio } = metroImage();
    return map.addImage(id, data, { pixelRatio });
  }
  if (id === 'exit') {            // sortie de métro : petit carré vert à flèche blanche
    const c = document.createElement('canvas'); c.width = c.height = 28;
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(1, 1, 26, 26, 6); g.fill();
    g.fillStyle = '#2E8B57'; g.beginPath(); g.roundRect(3, 3, 22, 22, 5); g.fill();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(9, 19); g.lineTo(19, 9); g.moveTo(12, 9); g.lineTo(19, 9); g.lineTo(19, 16); g.stroke();
    return map.addImage(id, g.getImageData(0, 0, 28, 28), { pixelRatio: 2 });
  }
  if (id === 'fav') {             // lieux enregistrés : pastille rose à cœur blanc
    const { data, pixelRatio } = poiImage(FAV_COLOR, 'heart', 20);
    return map.addImage(id, data, { pixelRatio });
  }
  if (id === 'tag-sel' || id === 'tag-alt') {   // bulle étirable des étiquettes de trajet
    const sel = id === 'tag-sel';
    const dark = document.documentElement && isDark();
    const s = 2, w = 40 * s, h = 28 * s, r = 9 * s, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 3 * s; g.shadowOffsetY = 1 * s;
    g.fillStyle = sel ? '#2A5BD7' : dark ? '#2B3038' : '#FFFFFF';
    g.beginPath(); g.roundRect(3 * s, 3 * s, w - 6 * s, h - 6 * s, r); g.fill();
    return map.addImage(id, g.getImageData(0, 0, w, h), { pixelRatio: s,
      stretchX: [[12 * s, w - 12 * s]], stretchY: [[12 * s, h - 12 * s]], content: [8 * s, 6 * s, w - 8 * s, h - 6 * s] });
  }
  if (id === 'sel-metro' || id.startsWith('sel|')) {
    const [, glyph, colour] = id === 'sel-metro' ? [null, 'M', '#2B4793'] : id.split('|');
    const { data, pixelRatio } = bigPin(colour, glyph);
    return map.addImage(id, data, { pixelRatio });
  }
  if (id.startsWith('cat|')) {        // raccourci de catégorie : pictogramme et couleur propres
    const [, glyph, colour] = id.split('|');
    const { data, pixelRatio } = poiImage(colour, glyph);
    return map.addImage(id, data, { pixelRatio });
  }
  if (id.startsWith('tl|')) {
    const [, mode, ref, colour] = id.split('|');
    const { data, pixelRatio } = lineBadge(mode, ref, colour);
    return map.addImage(id, data, { pixelRatio });
  }
  if (id.startsWith('poi-')) {
    const glyph = id.slice(4);
    const fam = glyph === 'train' ? TRAIN : Object.values(FAMILIES).find((f) => f.icon === glyph) || OTHER;
    const { data, pixelRatio } = poiImage(fam.color, glyph);
    map.addImage(id, data, { pixelRatio });
  }
}

// Identifiant de tuile → élément OSM (planetiler : id OSM × 10 + type).
export function osmRef(featureId) {
  if (featureId == null) return null;
  const type = { 1: 'node', 2: 'way', 3: 'relation' }[featureId % 10];
  return type ? { osmType: type, osmId: Math.floor(featureId / 10) } : null;
}
