// Couches maison posées sur le fond de carte : tracés d'itinéraire et leurs étiquettes, repères de lieux.
// Sorti de +page.svelte le 14/10/2026 (définitions pures : la page décide quand les afficher).
import { tx } from '#lib/i18n/index.js';
import { DARK_LAND } from './mapstyle.js';
import { streetOpts } from './routeview.js';
import { fmtDuration } from './routing.js';

export const empty = () => ({ type: 'FeatureCollection', features: [] });

export function addRouteLayers(map, dark) {
  map.addSource('route', { type: 'geojson', data: empty() });
  const before = 'water-name-point';
  // épaisseurs proches de Plans et Google Maps ; les variantes grises un peu plus fines
  const width = (a, b) => ['interpolate', ['exponential', 1.4], ['zoom'], 12, ['*', a, ['case', ['==', ['get', 'kind'], 'alt'], 0.8, 1]],
    18, ['*', b, ['case', ['==', ['get', 'kind'], 'alt'], 0.8, 1]]];
  // Trajets à pied, à vélo et en transport : trait plein, liseré foncé puis bord blanc.
  map.addLayer({ id: 'route-halo', type: 'line', source: 'route', filter: ['!=', ['get', 'kind'], 'transfer'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': dark ? DARK_LAND : '#FFFFFF', 'line-width': width(6.5, 12) } }, before);
  map.addLayer({ id: 'route-case', type: 'line', source: 'route', filter: ['!=', ['get', 'kind'], 'transfer'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'edge'], 'line-width': width(4.8, 9.5) } }, before);
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', filter: ['!=', ['get', 'kind'], 'transfer'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': width(3.4, 7) } }, before);
  // Correspondances à pied dans un trajet en transport : points discrets.
  map.addLayer({ id: 'route-walk', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'transfer'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#6F7A88', 'line-width': width(3.2, 5.5), 'line-dasharray': [0, 1.7] } }, before);
  // Étiquettes sur les tracés : « 18 min » sur celui choisi, « +2 min » sur les autres (comme Plans et Maps)
  map.addSource('route-tags', { type: 'geojson', data: empty() });
  const tagLayout = { 'text-field': ['get', 'label'], 'text-font': ['Inter Bold'], 'text-size': 13,
    'icon-image': ['case', ['get', 'sel'], 'tag-sel', 'tag-alt'], 'icon-text-fit': 'both', 'icon-text-fit-padding': [4, 8, 4, 8] };
  // les étiquettes restent toujours visibles ; leur position (routeTags) évite qu'elles se chevauchent
  map.addLayer({ id: 'route-tag', type: 'symbol', source: 'route-tags', filter: ['!', ['get', 'sel']],
    layout: { ...tagLayout, 'icon-allow-overlap': true, 'text-allow-overlap': true },
    paint: { 'text-color': dark ? '#E6E9EE' : '#1C1D1F' } });
  map.addLayer({ id: 'route-tag-sel', type: 'symbol', source: 'route-tags', filter: ['get', 'sel'],
    layout: { ...tagLayout, 'icon-allow-overlap': true, 'text-allow-overlap': true },
    paint: { 'text-color': '#FFFFFF' } });
  map.addSource('route-ends', { type: 'geojson', data: empty() });
  map.addLayer({ id: 'route-start', type: 'circle', source: 'route-ends',
    paint: { 'circle-radius': 7.5, 'circle-color': ['match', ['get', 'kind'], 'via', '#FFFFFF', '#2A5BD7'],
             'circle-stroke-color': ['match', ['get', 'kind'], 'via', '#1C1D1F', '#FFFFFF'], 'circle-stroke-width': 3.5 } });
}

/** Couches de nos repères : résultats d'une catégorie, Mes lieux, lieu sélectionné. */
export function addPlaceLayers(map, dark, favs) {
  // Pastilles et noms en deux couches, comme Plans et Google Maps (retour du 21/10 : noms posés sur d'autres pastilles) :
  // les pastilles sont placées d'abord et toutes visibles ; un nom se met à droite, à gauche, dessus ou dessous,
  // là où il ne cache ni une pastille ni un autre nom, et ne s'affiche pas s'il n'a pas de place.
  const hidSel = ['case', ['boolean', ['feature-state', 'sel'], false], 0, 1];
  const label = (size, font, offset) => ({ 'text-field': ['get', 'name'], 'text-font': [font], 'text-size': size, 'text-max-width': 8,
    'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': offset, 'text-justify': 'auto', 'symbol-sort-key': ['get', 'i'] });
  map.addSource('cat-hits', { type: 'geojson', data: empty() });
  map.addLayer({ id: 'cat-hit-label', type: 'symbol', source: 'cat-hits', layout: label(12.5, 'Inter Bold', 1.5),
    paint: { 'text-color': ['get', 'tc'], 'text-halo-color': dark ? 'rgba(22,24,28,0.9)' : '#FFFFFF', 'text-halo-width': 1.8, 'text-opacity': hidSel } });
  map.addLayer({ id: 'cat-hit', type: 'symbol', source: 'cat-hits',
    layout: { 'icon-image': ['get', 'icon'], 'icon-size': 1.15, 'icon-allow-overlap': true, 'icon-padding': 0, 'symbol-sort-key': ['get', 'i'] },
    paint: { 'icon-opacity': hidSel } });
  map.addSource('selected', { type: 'geojson', data: empty() });
  map.addSource('favs', { type: 'geojson', data: favs });
  map.addLayer({ id: 'fav-label', type: 'symbol', source: 'favs', minzoom: 14,
    layout: { ...label(12, 'Inter SemiBold', 1.4), 'symbol-sort-key': 0 },
    paint: { 'text-color': ['get', 'tc'], 'text-halo-color': dark ? 'rgba(22,24,28,0.9)' : '#FFFFFF', 'text-halo-width': 1.6 } });
  map.addLayer({ id: 'fav', type: 'symbol', source: 'favs',
    layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-padding': 0, 'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 16, 1.05] } });
  map.addLayer({ id: 'selected', type: 'symbol', source: 'selected',
    layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true,
              'text-field': ['get', 'name'], 'text-font': ['Inter Bold'], 'text-size': 13.5, 'text-anchor': 'left',
              'text-offset': [1.75, 0], 'text-max-width': 9, 'text-allow-overlap': true },
    paint: { 'text-color': ['get', 'tc'], 'text-halo-color': dark ? 'rgba(22,24,28,0.95)' : '#FFFFFF', 'text-halo-width': 2 } });
}

// Où poser l'étiquette d'un tracé : sur sa partie la plus éloignée des autres tracés (là où il se distingue).
/** r : résultat à pied / vélo / voiture (avec ses variantes) ; picked : indice choisi ; zoom : zoom d'affichage. */
export function routeTags(r, picked, zoom) {
  if (!r) return empty();
  const opts = streetOpts(r);
  const k = Math.cos((opts[0].coords[0][1] * Math.PI) / 180);
  const d2 = (a, b) => ((a[0] - b[0]) * k) ** 2 + (a[1] - b[1]) ** 2;
  const sel = opts[picked] || opts[0];
  const placed = [];
  // taille d'une étiquette sur la carte, en degrés, au zoom d'affichage (≈ 100 × 34 px)
  const mpp = 78271.5 * k / 2 ** zoom;
  const tagW = (100 * mpp) / 111320 / k, tagH = (34 * mpp) / 111320;
  const clashes = (c) => placed.some((q) => Math.abs(c[0] - q[0]) < tagW && Math.abs(c[1] - q[1]) < tagH);
  // le trajet choisi d'abord, puis les autres, chacun loin des autres tracés et des étiquettes déjà posées
  const order = [sel, ...opts.filter((o) => o !== sel)];
  const features = order.map((o) => {
    const i = opts.indexOf(o);
    const others = opts.filter((x) => x !== o).flatMap((x) => x.coords.filter((_, j) => j % 3 === 0));
    const n = o.coords.length;
    let best = o.coords[Math.floor(n / 2)], score = -1;
    for (let j = Math.floor(n * 0.15); j < n * 0.85; j += Math.max(1, Math.floor(n / 60))) {
      const c = o.coords[j];
      const mLine = others.length ? Math.min(...others.map((x) => d2(c, x))) : 1;
      const m = clashes(c) ? mLine * 1e-6 : mLine;      // un point qui chevauche une étiquette n'est retenu qu'en dernier recours
      if (m > score) { score = m; best = c; }
    }
    placed.push(best);
    // comme Plans et Maps : la durée sur le trajet choisi, l'écart (« +3 min ») sur les autres
    const dm = Math.round(o.duration / 60) - Math.round(sel.duration / 60);
    const label = o === sel ? fmtDuration(o.duration) : dm > 0 ? tx('itin.min', { dm }) : dm < 0 ? tx('itin.min_2', { n: -dm }) : tx('itin.meme_duree');
    return { type: 'Feature', geometry: { type: 'Point', coordinates: best }, properties: { i, sel: o === sel, label } };
  });
  return { type: 'FeatureCollection', features };
}
