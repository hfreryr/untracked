// Pseudo tiré au hasard (bouton « Générer ») : un animal des villes et un lieu, « Héron du canal ».
// Les deux listes sont dans le fichier de textes (fr.js) ; aucun nom propre, aucun lien avec la personne.
import { tx } from '#lib/i18n/index.js';

export function makePseudo(rand = Math.random) {
  const a = tx('pseudo.animaux').split('|'), b = tx('pseudo.lieux').split('|');
  return `${a[Math.floor(rand() * a.length)]} ${b[Math.floor(rand() * b.length)]}`;
}
