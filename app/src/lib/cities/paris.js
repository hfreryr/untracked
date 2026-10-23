// Profil de ville : tout ce qui est propre à Paris est ici, et nulle part ailleurs dans l'interface.
// Une autre ville = un autre fichier de ce type ; une donnée absente = la fonction correspondante se désactive.
export default {
  id: 'paris',
  name: 'Paris',
  country: 'FR',
  center: { lat: 48.8566, lon: 2.3522 },
  // zone de recherche (toute l'Île-de-France depuis le 23/10/2026, comme les données de lieux) : ouest, sud, est, nord
  searchBbox: [1.44, 48.12, 3.56, 49.24],
  // zone où les comptages de trafic de la Ville de Paris s'appliquent
  trafficBox: { w: 2.224, e: 2.47, s: 48.815, n: 48.902 },
  // sous-zones nommées (arrondissements) : « 8e », « 75008 » → centre
  districts: {
    pattern: /(?:75 ?0?)?([1-9]|1\d|20)(?:e|eme|ieme|er|ere)/, postcode: /750([0-2]\d)/, count: 20,
    label: (n) => `${n}${n === 1 ? 'er' : 'e'} arrondissement`,
    centers: {
      1: [2.3364, 48.8626], 2: [2.3428, 48.8683], 3: [2.36, 48.8629], 4: [2.3576, 48.8543], 5: [2.3507, 48.8444],
      6: [2.3329, 48.8492], 7: [2.3122, 48.8562], 8: [2.3126, 48.8727], 9: [2.3375, 48.8772], 10: [2.3607, 48.8761],
      11: [2.3801, 48.8591], 12: [2.4213, 48.835], 13: [2.3623, 48.8284], 14: [2.3266, 48.8292], 15: [2.2928, 48.8401],
      16: [2.262, 48.8604], 17: [2.3068, 48.8873], 18: [2.3482, 48.8926], 19: [2.3848, 48.8871], 20: [2.4012, 48.8635]
    }
  },
  // enrichissements locaux (fichiers dans static/data/) : sorties de métro (OSM), place dans la rame (RATP/IDFM), trafic (Ville de Paris)
  packs: { exits: 'exits.json', rame: 'rame.json', traffic: 'traffic-paris.json' },
  transit: { stopIdPrefix: 'IDFM' },
  // Prix des tickets à l'unité, plein tarif (Île-de-France Mobilités, en vigueur au 1er janvier 2026, vérifié le 15/10/2026 :
  // iledefrance-mobilites.fr, bonjour-ratp.fr). Métro-Train-RER : 2 h, sans bus ni tram ; Bus-Tram : 1 h 30, correspondances bus/tram.
  fares: {
    rail: { price: 2.55, minutes: 120, modes: ['SUBWAY', 'METRO', 'RAIL', 'REGIONAL_RAIL', 'SUBURBAN', 'REGIONAL_FAST_RAIL', 'FUNICULAR'] },
    road: { price: 2.05, minutes: 90, modes: ['BUS', 'TRAM', 'COACH', 'CABLE_CAR'] },
    unsure: /a[ée]roport|orly|charles[ -]de[ -]gaulle|cdg|roissy/i    // aéroports : billet spécial, on n'affiche pas de prix
  }
};
