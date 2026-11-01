# Chantiers en cours

Liste tenue à jour à chaque étape, pour ne rien perdre entre les sujets menés en parallèle (demande du porteur,
31/10/2026). Une ligne par sujet : où on en est, et la prochaine action.

## À fusionner
| PR | Sujet | Après fusion |
|---|---|---|
| #118 | Recherche : annuaire national des lieux (lieux loin d'ici trouvés sans Photon) | Publier, puis lancer `places-zones.yml` (zone corse) pour créer l'annuaire tout de suite |

## Décisions attendues du porteur
| Sujet | Question posée | Où regarder |
|---|---|---|
| Récompenses | Valider la maquette : badges à collectionner, carte de mes avis, couleur du point « vous êtes ici » | maquette-recompenses.png (conversation du 31/10) |
| Classement des lieux | Lancer la nouvelle méthode de placement (rang dans le quartier, la carte arbitre les chevauchements) + deux classements séparés | Résultats ci-dessous |

## Fait récemment
- **Lieux mis en avant des 21 régions et d'Amsterdam** : recalcul terminé le 01/11 (dernières : Poitou-Charentes,
  Champagne-Ardenne, Franche-Comté, Auvergne, Limousin, Corse, Amsterdam). Celles calculées après la fusion de #116 ont
  aussi leur index de recherche ; les autres l'auront à leur calcul hebdomadaire.

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

### Recherche : la bonne réponse où que l'on soit (règle du porteur, 31/10)
Règle : la réponse pertinente d'abord, quelle que soit la distance ; la proximité ne départage que l'ambigu.
Mesure : `node app/tests/search/grid.mjs` (6 points de départ × 27 recherches, voir `docs/recherche.md`).
1. ✅ **Index par région et Amsterdam** (#116, fusionnée).
2. ✅ **Adresses et rues** (#117, fusionnée, publiée le 01/11) : 71 % → 95 % de bonnes réponses en premier.
3. 🔧 **Annuaire national des lieux** (#118) : ≈ 90 000 lieux, 6,7 Mo, découpé par début de mot. Photon coupé, lieux
   7/54 → 42/54. Complet quand les 13 régions calculées avant #116 auront leur index (au plus tard le 07/11, calcul
   hebdomadaire). « gare de rennes » réglé. Restent : « musée Jean Cocteau Menton » (commune absente du nom),
   « Puy de Dôme » (sommets absents de nos lieux).
4. **Import Google** par l'annuaire, Photon seulement pour l'étranger.
- Limite connue : une rue française cherchée depuis l'étranger reste confiée à Photon.
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
