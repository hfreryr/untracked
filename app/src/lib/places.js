// Lieux : détails d'un lieu et lieux d'une catégorie, lus dans les tuiles préparées à l'avance (placestore.js).
// Aucun service tiers n'est interrogé lieu par lieu. La recherche par texte est dans geocode.js.
import { streetLine } from '#lib/searchscope.js';
import { reviewsOf } from '#lib/reviews.js';
import { tx } from '#lib/i18n/index.js';
import { kindOf, expectsHours, practical, goodToKnow } from './placeinfo.js';
import { placeById, placesInBounds, covers } from './placestore.js';
import { city } from './cities/index.js';

export const PARIS = city.center;

const TYPES = {
  restaurant: tx('types.restaurant'), cafe: tx('types.cafe'), bar: tx('types.bar'), pub: tx('types.pub'), fast_food: tx('categories.restauration_rapide'),
  bakery: tx('types.boulangerie'), pastry: tx('types.patisserie'), supermarket: tx('types.supermarche'), convenience: tx('types.epicerie'),
  pharmacy: tx('types.pharmacie'), books: tx('types.librairie'), clothes: tx('categories.vetements'), hairdresser: tx('types.coiffeur'),
  museum: tx('types.musee'), gallery: tx('types.galerie_art'), cinema: tx('types.cinema'), theatre: tx('types.theatre'), hotel: tx('types.hotel'),
  park: tx('types.parc'), garden: tx('types.jardin'), station: tx('ecran.gare'), subway_entrance: tx('ecran.entree_de_metro'),
  post_office: tx('types.bureau_de_poste'), bank: tx('types.banque'), library: tx('types.bibliotheque'), school: tx('types.ecole'),
  hospital: tx('carte.hopital'), doctors: tx('types.medecin'), church: tx('types.eglise'), place_of_worship: tx('types.lieu_de_culte'),
  attraction: tx('types.lieu_touristique'), monument: tx('types.monument'), florist: tx('types.fleuriste'), butcher: tx('types.boucherie'),
  cheese: tx('types.fromagerie'), wine: tx('types.caviste'), ice_cream: tx('types.glacier'), marketplace: tx('types.marche'),
  fast_food: tx('categories.restauration_rapide'), supermarket: tx('types.supermarche'), grocery: tx('types.epicerie'),
  clothing_store: tx('categories.vetements'), jewelry: tx('types.bijouterie'), shoes: tx('types.chaussures'), art_gallery: tx('types.galerie_art'),
  subway: tx('ecran.station_de_metro'), halt: tx('ecran.gare'), hostel: tx('types.auberge_de_jeunesse'), dentist: tx('types.dentiste'),
  beauty: tx('types.institut_de_beaute'), optician: tx('types.opticien'), gift: tx('types.cadeaux'), toys: tx('categories.jouets'),
  cemetery: tx('types.cimetiere'), grave_yard: tx('types.cimetiere'), florist: tx('types.fleuriste'), tobacco: tx('types.tabac'), newsagent: tx('types.presse'),
  kiosk: tx('types.kiosque'), laundry: tx('types.laverie'), dry_cleaning: tx('types.pressing'), bicycle_rental: tx('types.velos_en_libre_service'),
  bicycle: tx('types.magasin_de_velos'), parcel_locker: tx('types.consigne_a_colis'), playground: tx('types.aire_de_jeux'), clinic: tx('types.clinique'),
  veterinary: tx('types.veterinaire'), pet: tx('types.animalerie'), sports_centre: tx('types.centre_sportif'), fitness_centre: tx('types.salle_de_sport'),
  swimming_pool: tx('types.piscine'), toilets: tx('categories.toilettes'), drinking_water: tx('types.point_eau'), charging_station: tx('categories.borne_de_recharge'),
  parking: tx('categories.parking'), police: tx('categories.police'), hardware: tx('types.quincaillerie'), doityourself: tx('categories.bricolage'), mobile_phone: tx('types.telephonie'),
  computer: tx('types.informatique'), electronics: tx('types.electronique'), stationery: tx('types.papeterie'), copyshop: tx('types.reprographie'),
  townhall: tx('types.mairie'), musical_instrument: tx('types.instruments_de_musique'), music: tx('types.disquaire'), nightclub: tx('types.boite_de_nuit'),
  escape_game: tx('types.escape_game'), coworking: tx('categories.coworking'), chocolate: tx('types.chocolatier'), confectionery: tx('types.confiserie'),
  greengrocer: tx('types.primeur'), deli: tx('types.traiteur'), alcohol: tx('types.caviste'), beverages: tx('types.boissons'), cosmetics: tx('types.cosmetiques'),
  perfumery: tx('types.parfumerie'), bag: tx('types.maroquinerie'), atm: tx('types.distributeur'), fuel: tx('types.station_service'), yoga: tx('types.yoga'),
  climbing: tx('types.escalade'), viewpoint: tx('types.point_de_vue'), memorial: tx('types.memorial'), castle: tx('types.chateau'), guest_house: tx('types.chambre_hotes'),
  christian: tx('types.eglise'), jewish: tx('types.synagogue'), muslim: tx('types.mosquee'), buddhist: tx('types.temple_bouddhiste'), paint: tx('types.peinture'),
  house: tx('fiche.adresse'), street: tx('resultats.rue'), residential: tx('resultats.rue'), city: tx('types.ville'), suburb: tx('types.quartier')
};

export function typeLabel(key, value) {
  if (key === 'railway' && value === 'station') return tx('liste.station');
  return TYPES[value] || (key === 'highway' ? tx('resultats.rue') : key === 'place' ? tx('fiche.lieu') : null);
}

/** Type lisible d'un lieu d'après ses étiquettes OSM (« Vêtements », « Restaurant »…), ou null. */
export function typeOfTags(t) {
  for (const k of ['amenity', 'shop', 'tourism', 'leisure', 'healthcare', 'office', 'craft', 'historic', 'railway']) {
    const label = t[k] && typeLabel(k, t[k]);
    if (label) return label;
  }
  return null;
}

function address(p) {
  const line = [p.housenumber, p.street].filter(Boolean).join(' ');
  const where = p.postcode ? `${p.postcode} ${p.city || ''}`.trim() : p.district || p.city;
  return [line, where].filter(Boolean).join(', ');
}

/** Détails d'un lieu (fiche) : ses étiquettes OSM, lues dans la tuile de sa position. */
export async function details(place) {
  if (!place.osmType) return {};
  const hit = await placeById(place.osmType, place.osmId, place.lat, place.lon).catch(() => null);
  // absent : soit la zone n'est pas couverte par nos données, soit le lieu n'y est pas (supprimé, lien erroné)
  if (!hit) return (await covers(place.lat, place.lon).catch(() => false)) ? { covered: true, missing: true } : { covered: false };
  return { ...fromTags(hit.tags, hit), facade: hit.facade || null };
}

export function fromTags(t, at = null) {
  const street = streetLine(t, at);   // ordre du pays (searchscope.js)
  return {
    covered: true,
    name: t.name,
    type: typeOfTags(t),
    address: street ? [street, t['addr:postcode']].filter(Boolean).join(', ') : null,
    cuisine: t.cuisine,
    hours: t.opening_hours,
    phone: t.phone || t['contact:phone'],
    website: t.website || t['contact:website'],
    menu: t['website:menu'] || null,
    // photo publiée par le site du lieu (build_sitehours.py) : seulement son adresse ; chargée depuis le site, jamais copiée
    sitePhoto: typeof t._photo === 'string' && t._photo.startsWith('https://') ? t._photo : null,      // carte du restaurant (P6), quand OSM la connaît
    // compléments hors OSM (sites, téléphones…) : leur source, affichée sous l'information (docs/sources-donnees.md)
    sources: t._src || {},
    wheelchair: t.wheelchair,
    checkDate: t.check_date || t['check_date:opening_hours'],
    kind: kindOf(t),
    // pour les badges (badges.js) : sous-catégorie, commune et code postal
    subclass: t.amenity || t.tourism || t.leisure || t.shop || null,
    city: t['addr:city'] || null,
    postcode: t['addr:postcode'] || null,
    expectsHours: expectsHours(t),
    practical: practical(t),
    good: goodToKnow(t),
    fee: t.fee,
    wikidata: t.wikidata,
    wikipedia: t.wikipedia,
    access: Array.isArray(t._acc) ? t._acc : null,    // accès d'un grand lieu (build_places.py), pour l'itinéraire
    reviews: reviewsOf(t, at?.base || '')             // avis libres Mangrove (reviews.js), et leurs photos
  };
}

/**
 * Lieux d'une catégorie dans une zone, lus dans les tuiles préparées (complète ceux lus dans la carte,
 * utile pour les catégories rares : cimetières, piscines…). `include` : ['osm.shop.florist', …] ; `q` : un mot
 * à chercher dans le nom (« piscine »). Rendu comme les lieux de la carte : { id, properties, geometry, tags }.
 */
const fold = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export async function searchCategory(include, bounds, q = null) {
  const wanted = include.map((c) => c.replace(/^osm\./, '').split('.'));
  const word = q ? fold(q) : null;
  const all = await placesInBounds(bounds).catch(() => []);
  return all.filter((p) => {
    const t = p.tags;
    if (!t.name || !wanted.some(([k, v]) => t[k] === v)) return false;
    return !word || fold(t.name).includes(word);
  }).map((p) => {
    const kind = { 1: 'node', 2: 'way', 3: 'relation' }[p.id % 10];
    const t = p.tags;
    const sub = t.shop || t.amenity || t.tourism || t.leisure || t.craft || t.office || t.healthcare;
    return { id: `pl${p.id}`, properties: { name: t.name, subclass: sub, osm: `${kind}/${Math.floor(p.id / 10)}` },
      geometry: { coordinates: [p.lon, p.lat] }, tags: t, facade: p.facade || null };
  });
}
