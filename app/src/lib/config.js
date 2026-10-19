// Réglages de déploiement. Les données préparées à l'avance (lieux par tuile, sorties, horaires des
// transports…) peuvent être servies ailleurs que le site (stockage objet, CDN) : une seule URL à changer.
export function dataBase() {
  const env = import.meta.env?.VITE_DATA_BASE;
  if (env) return env.endsWith('/') ? env : `${env}/`;
  return new URL('data/', location.href).toString();
}

// Identification de l'app auprès des services tiers qui le demandent (Wikimedia).
export const APP_AGENT = 'UntrackedMaps/0.2 (https://untrackedmaps.app)';

// Services d'itinéraires : adresse modifiable au déploiement (FOSSGIS recommande de ne pas la figer dans l'app),
// pour passer sur nos propres serveurs sans toucher au code.
export const ROUTING_URL = import.meta.env?.VITE_ROUTING_URL || 'https://valhalla1.openstreetmap.de/route';

// Adresse de contact de l'éditeur, exigée par les conditions de FOSSGIS (elle doit être facile à trouver).
export const CONTACT_EMAIL = 'contact@untrackedmaps.app';
