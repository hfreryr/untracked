// Où chercher selon l'endroit regardé (retour du porteur, 30/10/2026 : « Starbucks » à Amsterdam proposait un
// Starbucks d'Île-de-France). Nos données (index du téléphone, tuiles de lieux) ne couvrent que la zone de la ville ;
// le géocodeur d'adresses de l'État ne couvre que la France. Ailleurs, seul Photon (monde entier) a du sens.
import { city } from '#lib/cities/index.js';
import ZONES from '#lib/cities/zones.json' with { type: 'json' };

const inBox = ([w, s, e, n], p) => !!p && p.lon > w && p.lon < e && p.lat > s && p.lat < n;
// France métropolitaine et Corse (cadre large : le géocodeur filtre ensuite)
const FRANCE = [-5.3, 41.3, 9.7, 51.2];

/** Le point est-il dans la zone couverte par nos données ? */
export const covered = (at) => inBox(city.searchBbox, at);
/** Le géocodeur d'adresses français a-t-il du sens ici ? */
export const inFrance = (at) => city.country === 'FR' && inBox(FRANCE, at);
/** Avons-nous des fiches de lieux ici (Île-de-France, ou une ville de zones.json) ? Sans index de recherche ailleurs
 *  qu'en Île-de-France : « boulangerie », « pharmacie ouverte » y passent par les tuiles, les noms par Photon. */
export const hasPlaces = (at) => covered(at) || ZONES.some((z) => inBox(z.bbox, at));

/** Ligne d'adresse (numéro et rue) dans l'ordre du pays : « 4 rue X » en France, « Amstelzijde 4 » aux Pays-Bas. */
export function streetLine(t, at) {
  const z = at && ZONES.find((zz) => inBox(zz.bbox, at));
  const parts = [t['addr:housenumber'], t['addr:street']];
  return (z && z.country !== 'FR' ? parts.reverse() : parts).filter(Boolean).join(' ');
}
