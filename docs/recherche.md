# Recherche

## Le problème (tests utilisateurs du 15/10/2026)

Le souci est double, et chaque moitié a sa propre solution :

1. **Lenteur.** Photon (instance publique de komoot) a mis 12 à 13 s à répondre vers 21 h 20, contre 0,9 à 2,1 s vers 0 h 30. L'app attendait 4 s avant de se rabattre sur une recherche de secours médiocre.
   - Hypothèse : une surcharge du service partagé en soirée. Elle n'est pas prouvée ; la sonde (`app/scripts/sonde_services.py`, toutes les 15 min) mesure ce temps de réponse heure par heure.
2. **Pertinence.** P6 et P7 ont insisté sur la qualité de la recherche de Google Maps. Exemples :
   - « élysée » donnait un salon de massage avant le palais ;
   - « grand palais » donnait des bureaux ;
   - des arrêts de bus et des stations de taxi apparaissaient dans les résultats.

## La solution : chercher sur le téléphone

Un **index des 71 000 lieux nommés de Paris**, préparé chaque nuit et téléchargé une fois sur le téléphone (≈ 1,6 Mo compressé), est chargé dès qu'on touche la barre de recherche.

- **Fautes de frappe tolérées** : une lettre fausse, en trop ou inversée ; deux lettres pour les mots longs. Les élisions sont comprises (« dorsay » trouve « d'Orsay »).
- **Notoriété** : [QRank](https://qrank.toolforge.org/) mesure les vues Wikipédia de l'entité Wikidata du lieu sur un an. Ces données sont dans le domaine public (CC0) et mises à jour chaque semaine.
  - Un lieu connu passe devant un homonyme proche.
  - Le fichier complet fait 125 Mo ; on n'en garde que les 4 500 lieux parisiens qui ont un identifiant Wikidata, dans `extras.json`.
- **Doublons fusionnés** : même identifiant Wikidata, ou même nom à moins de 200 m. Une gare donne un seul résultat, pas ses quais et ses entrées.
- **Type de lieu** : une gare, un musée ou un parc passent avant un parking ou des bureaux. Les entrées de métro, les quais, les taxis et les stations Vélib sont écartés.
- **Recherches par type** : « pharmacie », « restaurant italien », « vegan », « toilettes »… donnent les lieux de ce type les plus proches, lus dans nos tuiles.
- **Photon reste consulté** pour ce que l'index n'a pas (rues sans numéro, quartiers, lieux absents de nos données). Ses réponses s'ajoutent sous les nôtres quand elles arrivent, sans faire attendre les premières.

### Partout où nous avons des lieux (31/10/2026)

Même index, préparé chaque semaine avec les lieux de chaque région française et d'Amsterdam (`places-zones.yml`).

- **Découpé** : le téléphone charge l'essentiel de la région où il se trouve (communes, gares, musées, lieux connus) et
  les lieux à moins de 4 km. Près d'une limite de région, les deux régions ; une région voisine sans lieu autour n'est pas
  chargée.
- **Compressé** comme les tuiles de lieux (`search/core.json.gz`, `search/12/x/y.json.gz`, index v3).
- **Hameaux, lieux-dits et maisons isolées** restent dans leur zone : en Bretagne, ils faisaient 85 000 des 103 000 lieux
  de l'essentiel (5,7 Mo). Essentiel breton désormais : 5 757 lieux, 146 Ko ; index breton complet : 4,4 Mo.
- **Mesuré à Rennes** (index breton, sans notoriété) : 440 Ko chargés, « parlement de bretagne », « champs libres »,
  « saint-malo » trouvés en moins de 20 ms. À améliorer : « gare de rennes » (la gare s'appelle « Rennes » dans OSM).
- Loin de sa région : l'annuaire national (ci-dessous).

## Mesure

Le jeu de référence compte 144 recherches (`app/tests/search/reference.json`) ; la mesure se lance avec `npm run search-eval`.

| | Bon lieu en 1er | Dans les 3 premiers | Temps médian |
|---|---|---|---|
| Recherche sur le téléphone | **90 %** | **97 %** | **0,014 s** |
| Photon (ancienne recherche) | 76 % | 85 % | 1,5 s |
| Ancien secours local | 56 % | 67 % | 0,04 s |

⚠️ **Honnêteté de la mesure** : la recherche a été réglée en regardant 104 de ces recherches.
- Les **40 du groupe « contrôle »** ont été écrites après le réglage et n'ont pas servi à régler. Sur ce groupe : **93 %** en premier pour nous, **90 %** pour Photon.
- Sur les lieux connus, sans faute, l'écart avec Photon est donc faible.
- Le vrai gain porte sur :
  - les fautes de frappe : 81 % contre 73 % ;
  - les types de lieux : 100 % contre 33 % (réglés sur ce jeu) ;
  - les recherches des tests utilisateurs : 6 sur 6 contre 4 sur 6 ;
  - la vitesse.

## Où que l'on soit, la bonne réponse d'abord (31/10/2026)

Règle du porteur : la recherche propose la réponse pertinente **quelle que soit la distance**. La proximité ne sert qu'à départager une requête ambiguë (« 10 rue de la République » : celle de la ville où l'on est).

- **Adresses** (`addressnear.js`) : partout en France, Île-de-France comprise, le géocodeur de l'État reçoit le texte seul et le texte suivi de la commune où l'on est. Une réponse de cette commune passe devant **seulement si elle contient tout ce qui a été tapé** (le numéro peut manquer, le code postal non). Ensuite, la note du géocodeur ; à note égale (écart ≤ 0,03), la plus proche. Avant : hors Île-de-France, la commune où l'on est passait toujours devant (« 2 place du château Gordes » vu de Marseille donnait « 2 Rue gorde, 13010 Marseille » ; « 12 rue de la République Marseille » vu de Lyon, la rue de Lyon) ; en Île-de-France, une seule réponse francilienne écartait les autres.
- **Rues sans numéro** (« rue Paradis Marseille ») : envoyées aussi au géocodeur de l'État, affichées dès qu'il répond, sans attendre Photon.
- **Ligne « enseigne »** (« Afficher les lieux ») : seulement si l'enseigne est la meilleure réponse. Elle s'affichait en tête dès que deux lieux du même nom figuraient plus bas (deux arrêts « Rue de Marseille » devant la rue Paradis).

**Grille de mesure** : `node app/tests/search/grid.mjs` (après `npm run build`, option `--sans-photon`). 6 points de départ (Paris, Marseille, Lyon, Rennes, Felletin, Amsterdam) × 27 recherches (`grid.json`), avec les vrais services : le taux peut varier d'un jour à l'autre.

| Bonne réponse en premier (31/10) | Avant | Après |
|---|---|---|
| Adresses avec numéro | 32/42 | 42/42 |
| Rues sans numéro | 24/42 | 41/42 |
| Requêtes ambiguës (la plus proche) | 3/4 | 4/4 |
| Lieux par leur nom | 42/54 | 48/54 |
| **Total** | **71 %** | **95 %** |
| Lieux par leur nom, Photon coupé | — | 7/54 |

Sans Photon, adresses et rues tiennent (seul Amsterdam échoue) ; les lieux s'effondrent. Restent : les lieux loin d'ici que notre index ne couvre pas (« Gordes », « Palais des Papes », « Parlement de Bretagne » vus de Paris : étape suivante, l'annuaire national) ; une rue française cherchée depuis l'étranger, laissée à Photon pour ne pas confondre une rue de Bruxelles avec son homonyme française.

## Annuaire national des lieux (01/11/2026)

Pour trouver « Gordes », le Palais des Papes ou le Rijksmuseum depuis n'importe où, sans service tiers.

- **Contenu** : l'essentiel de chaque région publiée, réuni (`build_directory.py`, à chaque passage de `places-zones.yml`) :
  communes, gares, musées, châteaux, parcs, stades, et tout lieu assez connu (notoriété QRank ≥ 25). Quartiers et
  lieux-dits seulement s'ils sont connus. ≈ 90 000 lieux, ≈ 6,7 Mo en tout.
- **Découpé par début de mot** (`data/directory/<début>.json.gz`) : un lieu figure sous chacun de ses mots ; un début trop
  fréquent est redécoupé sur une lettre de plus. Une recherche charge les fichiers des deux mots les plus rares tapés
  (souvent 20 à 40 Ko). Gros fichiers restants : les mots entiers « château », « gare », « saint » (≈ 200 Ko), chargés
  seulement quand aucun autre mot n'est plus rare.
- **« Gare de Rennes »** : chaque gare de train reçoit l'autre nom « Gare de <nom> » (pas les stations de métro).
- **Prudence loin d'ici** : un lieu de l'annuaire n'est montré avant Photon que si le texte tapé couvre presque tout son
  nom, sans faute de frappe (sinon « puy de dome » donnait la cathédrale Notre-Dame-du-Puy). Il reste affiché après.
- **Limites** : une faute de frappe dans les premières lettres des deux mots les plus rares ; un lieu cherché avec le nom
  de sa commune quand celle-ci n'est pas dans son nom (« musée Jean Cocteau Menton ») ; les sommets (« Puy de Dôme »),
  absents de nos lieux. Photon reste consulté pour ces cas.
- **Complet au plus tard le 07/11/2026** : 13 régions, calculées avant l'index par région, l'auront à leur calcul
  hebdomadaire ; l'annuaire est refait à chaque passage.
- Hors de France et d'Amsterdam : Photon seul, inchangé.

**Mesure** (grille, 01/11, annuaire construit avec toutes les régions) :

| Bonne réponse en premier | Avant (#117) | Avec l'annuaire |
|---|---|---|
| Avec Photon : lieux par leur nom | 48/54 | **53/54**\* |
| Avec Photon : total | 134/142 (95 %) | **140/142 (99 %)** |
| Photon coupé : lieux par leur nom | 7/54 | **42/54** |
| Photon coupé : total | 57 % | **82 %** |

\* Contrôle « Puy de Dôme » rendu plus strict (le premier résultat doit être le sommet) : il pouvait réussir à tort, par exemple avec
« Archives départementales du Puy-de-Dôme ». Échec restant vu de Paris : « Antenne du Puy-de-Dôme », un lieu
parisien, défaut antérieur. Photon coupé, échouent seulement « musée Jean Cocteau Menton » et « Puy de Dôme » (et,
depuis Amsterdam, les adresses françaises, confiées à Photon).

## Adresse dans la liste des résultats

Comme Google Maps, chaque lieu de la liste montre sa rue.
- Adresse d'OpenStreetMap, ou, à défaut, d'Overture.
- Sinon, **la rue la plus proche** (à moins de 40 m), affichée « près de Rue X », sans numéro. Elle est calculée par `build_places.py` (étiquette `_rue`) et ne sert qu'à cette liste : la fiche du lieu n'affiche que de vraies adresses.
- Mesure du 21/10, sur 3 000 lieux dont l'adresse est connue : la rue la plus proche est la bonne dans 78 % des cas, une rue voisine (lieu à un angle, en retrait) dans 19 %, aucune rue à 40 m dans 3 %. D'où le « près de ».
- Couverture de l'index : environ 95 % des lieux ont une rue, contre environ 48 % avant.

## Fabrication

- `app/scripts/build_extras.py` (chaque lundi) : notoriété QRank des lieux qui ont un identifiant Wikidata (clé `qrank` d'`extras.json`).
- `app/scripts/build_search.py` (chaque nuit, après les tuiles) : écrit `data/places/search.json`.
- `app/src/lib/searchindex.js` contient la recherche, `searchintent.js` les types de lieux et `geocode.js` l'assemblage avec Photon et le géocodeur de l'État.

## Passage à l'échelle

Un index par ville, ou par tuile pour le monde entier, sur le modèle des tuiles de lieux. QRank couvre toute la planète.
