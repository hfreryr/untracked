# Chantiers en cours

Liste tenue à jour à chaque étape, pour ne rien perdre entre les sujets menés en parallèle (demande du porteur,
31/10/2026). Une ligne par sujet : où on en est, et la prochaine action.

## À fusionner
| PR | Sujet | Après fusion |
|---|---|---|
| #113 | Import Google : un lieu par seconde, essais espacés, toutes les listes créées, « Réessayer » (129 lieux sur 137 au lieu de 5) | Publier ; le porteur supprime puis réimporte son fichier |
| #114 | Nouveau niveau de contribution annoncé une fois, avec la flèche à choisir (empilée sur #113) | Publier |
| #116 | Recherche par nom sur le téléphone dans toutes les régions et à Amsterdam (étape 1 de 3) | Publier ; les régions ont leur index à leur prochain calcul |

## Décisions attendues du porteur
| Sujet | Question posée | Où regarder |
|---|---|---|
| Récompenses | Valider la maquette : badges à collectionner, carte de mes avis, couleur du point « vous êtes ici » | maquette-recompenses.png (conversation du 31/10) |
| Classement des lieux | Lancer la nouvelle méthode de placement (rang dans le quartier, la carte arbitre les chevauchements) + deux classements séparés | Résultats ci-dessous |

## En cours (tourne seul)
- **Lieux mis en avant des 21 régions et d'Amsterdam** : recalcul région par région (≈ 8 h, relancé à chaque arrêt). En ligne
  avec leurs lieux : Île-de-France, Rhône-Alpes, Provence-Alpes-Côte d'Azur, Nord-Pas-de-Calais, Midi-Pyrénées, Aquitaine,
  Pays de la Loire (31/10, 21 h). Les autres gardent le fond de carte en attendant.

## Chantiers ouverts
### Classement des lieux sur la carte
- Mesuré le 31/10 (`app/scripts/eval_landmarks.py`, étalon `docs/mesures/etalon-classement.json`, branche
  `mesure-classement`) : 9 variantes, aucune nettement meilleure ; QRank aide Rennes, dégrade Paris ; aucun signal ouvert ne
  classe bien les restaurants ; deux classements séparés = gain modeste pour les restaurants.
- Cause du Rijksmuseum au zoom 15,5 : la méthode de placement (une place voisine moins connue, placée plus tôt, le bloque),
  pas seulement la notoriété. Même famille de défaut : « Musée du chocolat » visible avant le Panthéon à Paris.
- Prochaine action : méthode à la Google (zoom selon le rang dans le quartier, collisions arbitrées par la carte), remesurer.
- Densité à Amsterdam autour du zoom 15,5 : la moitié des lieux prévus pas dessinés (chevauchements) — à revoir avec la
  nouvelle méthode.

### Recherche par nom dans toute la France (plan validé le 31/10, 3 étapes)
1. **Index par région et Amsterdam** (branche `recherche-regions`) : compressé, essentiel sans hameaux (Bretagne :
   5,7 Mo → 146 Ko ; index complet 4,4 Mo), construit chaque semaine. Rennes : résultats en moins de 20 ms.
2. **Annuaire national par début de nom** (≈ 40 Mo pour la France, fichiers de 40 Ko au plus) : chercher loin de sa région
   sans Photon. À traiter aussi : « gare de rennes » (la gare s'appelle « Rennes » dans OSM).
3. **Import Google** par l'annuaire, Photon seulement pour l'étranger.
- Avant tout lancement public : notre propre Photon (règle « zéro pistage »).

### Récompenses (validées 1, 2, 3 le 31/10, maquette à confirmer)
- Badges à collectionner, carte de mes avis, couleur du point « vous êtes ici ». Pictos à dessiner (pas d'émojis).
- Écartée : « vos avis ont été lus N fois » (demanderait de compter les lectures).

### Villes européennes (mises en pause le 31/10, la France d'abord)
- Londres, Madrid, Rome, Bruxelles ; avant : formats de téléphone et d'adresse de tous les pays (`phonenumbers`).

### Petits défauts connus
- `tests/search/eval.mjs` lit encore les tuiles de lieux à l'ancien format (non compressé) : à remettre à jour.
- Codes postaux néerlandais tels que saisis dans OSM (« 1016GC » au lieu de « 1016 GC »).
- Lieux connus seulement d'Overture (ex. « Kek! Pop-up ») non affichés : la moitié sont des doublons de noms.
- Tests de bout en bout en échec aussi sur main : vue de la rue, compléments hors OSM, sortie conseillée
  (données locales) ; info trafic (contraste de `.badge` signalé par axe — **vrai défaut d'accessibilité à corriger**) ;
  autres passages et station de métro (services en temps réel, instables).
- Import Google : beaucoup de lieux « position à vérifier » quand le nom Google diffère du nom OSM.

### Marque
- INPI : marque verbale « Untracked », classes 9, 38, 42 ; avis d'un conseil en propriété industrielle recommandé
  (suivi dans Notion, section INPI).
