import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { defineConfig } from 'vite';

// Politique de sécurité du contenu (CSP) : le navigateur n'exécute que nos scripts (empreintes calculées
// à la construction) et ne contacte que les fournisseurs documentés dans « Qui voit quoi ».
// GitHub Pages ne permet pas d'envoyer l'en-tête HTTP : elle est posée dans la page (balise meta).
// Ajouter un fournisseur ici = l'ajouter aussi à la page « Qui voit quoi ».
const dataBase = process.env.VITE_DATA_BASE ? [new URL(process.env.VITE_DATA_BASE).origin] : [];
const csp = {
  mode: 'hash',
  directives: {
    'default-src': ['self'],
    'script-src': ['self'],
    'worker-src': ['self', 'blob:'],
    'style-src': ['self', 'unsafe-inline'],
    'img-src': ['self', 'data:', 'blob:', 'https:'],          // photos Wikimedia et Panoramax (plusieurs hébergeurs)
    'font-src': ['self'],
    'connect-src': ['self', ...dataBase,
      'https://tiles.openfreemap.org',                          // fond de carte
      'https://photon.komoot.io',                               // recherche de lieux
      'https://data.geopf.fr',                                  // adresses (Géoplateforme)
      'https://valhalla1.openstreetmap.de',                     // itinéraires à pied, vélo, voiture
      'https://api.transitous.org',                             // transports en commun
      'https://api.mangrove.reviews',                           // publier un avis (seulement quand on touche « Publier »)
      'https://upload.mangrove.reviews',                        // et sa photo, s'il y en a une (photoupload.js)
      'https://www.wikidata.org', 'https://fr.wikipedia.org', 'https://commons.wikimedia.org'],
    'manifest-src': ['self'],
    'object-src': ['none'],
    'base-uri': ['self'],
    'form-action': ['self']
  }
};

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter(),
      paths: { relative: true },
      // nouvelle version en ligne : vérifiée à l'ouverture, au retour dans l'app et toutes les 10 min (UpdateBanner.svelte)
      version: { pollInterval: 600_000 },
      csp
    })
  ]
});
