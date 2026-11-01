// Adresses des images Panoramax d'une photo : on passe toujours par l'API publique de l'instance qui l'héberge
// (https://<instance>/api/pictures/<id>/sd.jpg), qui renvoie vers son stockage. L'organisation interne du stockage
// peut changer ; cette adresse-là est stable.
//
// Avant le 01/11/2026, build_facades.py notait l'hôte de l'image (« geovisio:image ») : pour une partie des photos de
// l'IGN, c'est leur stockage S3 et non l'instance, d'où des adresses inexistantes (erreur 403 en XML, bloquée par le
// navigateur). Les devantures déjà construites portent encore cet hôte : on le ramène à son instance.
const INSTANCE_OF_STORAGE = {
  'panoramax-storage-public-fast.s3.gra.perf.cloud.ovh.net': 'panoramax.ign.fr',
};

/** L'instance Panoramax (son API) à interroger pour un hôte noté dans les données. */
export const instanceHost = (host) => INSTANCE_OF_STORAGE[host] || host;

/** Image complète (2048 × 1024) et tuiles haute définition (16 × 8 de 768 px) d'une photo. */
export function pictureUrls(id, host) {
  const h = instanceHost(host);
  return { src: `https://${h}/api/pictures/${id}/sd.jpg`, tile: (col, row) => `https://${h}/api/pictures/${id}/tiled/${col}_${row}.jpg` };
}
