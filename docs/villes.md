# Villes couvertes et budget du site

Le tableau de bord des villes dont l'app a les fiches détaillées : horaires, compléments, avis, recherche par type.
Ailleurs, l'app affiche seulement les lieux du fond de carte (OpenFreeMap).

## Règles (décision du 30/10/2026)
- **Plafond : 700 Mo pour tout le site.** GitHub Pages limite un site à 1 Go ; les 300 Mo restants servent de marge.
  `app/scripts/site_budget.sh` vérifie le plafond à chaque publication (`publish.sh`, `places.yml`, `places-zones.yml`) :
  si une publication le dépasse, elle n'a pas lieu.
- **Une ville entre** si c'est une destination fréquente des Français et si le budget restant le permet.
  On ajoute **un lot à la fois** : on mesure, on remplit ce tableau, puis on décide du lot suivant.
- **Estimation avant ajout : ≈ 7 Mo par million d'habitants** couverts en ville. Ce chiffre est mesuré à Lyon et à
  Amsterdam. À la campagne, c'est plus : ≈ 9 Mo en Ille-et-Vilaine, ≈ 15 Mo en Creuse (mesuré le 30/10, sans compléments).
- Chaque ville se configure dans `app/src/lib/cities/zones.json` : extrait OSM, cadre, pays, jour de mise à jour.
  Les lieux sont refaits une fois par semaine par `places-zones.yml`.

## Zones couvertes (31/10/2026)
**Toute la France métropolitaine** en 21 régions (les anciennes régions, comme les découpe OpenStreetMap France),
plus l'Île-de-France chaque nuit et **Amsterdam**. Les zones de villes françaises (Lyon, Marseille, Rennes…) sont
remplacées par leur région ; leurs tuiles quittent le site à la mise à jour suivante (`places-zones.yml`).

| Zone | Poids mesuré en ligne | Mise à jour |
|---|---|---|
| Île-de-France | 36,2 Mo (84,6 Mo avant les tuiles compressées) | chaque nuit |
| Amsterdam | 1,4 Mo (33 948 lieux, 3 988 complétés) | jeudi |

| Région | Extrait OSM | Poids | Mise à jour |
|---|---|---|---|
| Alsace | 162 Mo | ≈ 4 Mo (estimé) | lundi |
| Rhône-Alpes | 619 Mo | ≈ 14 Mo (estimé) | lundi |
| Franche-Comté | 147 Mo | ≈ 3 Mo (estimé) | mardi |
| Lorraine | 204 Mo | ≈ 5 Mo (estimé) | mardi |
| Provence-Alpes-Côte d'Azur | 447 Mo | ≈ 10 Mo (estimé) | mardi |
| Bourgogne | 230 Mo | ≈ 5 Mo (estimé) | mercredi |
| Corse | 38 Mo | ≈ 1 Mo (estimé) | mercredi |
| Haute-Normandie | 122 Mo | ≈ 3 Mo (estimé) | mercredi |
| Pays de la Loire | 424 Mo | ≈ 9 Mo (estimé) | mercredi |
| Auvergne | 181 Mo | ≈ 4 Mo (estimé) | jeudi |
| Languedoc-Roussillon | 311 Mo | ≈ 7 Mo (estimé) | jeudi |
| Limousin | 115 Mo | ≈ 3 Mo (estimé) | jeudi |
| Champagne-Ardenne | 121 Mo | ≈ 3 Mo (estimé) | vendredi |
| Midi-Pyrénées | 414 Mo | ≈ 9 Mo (estimé) | vendredi |
| Poitou-Charentes | 261 Mo | ≈ 6 Mo (estimé) | vendredi |
| Bretagne | 368 Mo | **8,2 Mo** (en ligne, 254 978 lieux, 13 414 complétés) | samedi |
| Nord-Pas-de-Calais | 271 Mo | ≈ 6 Mo (estimé) | samedi |
| Picardie | 157 Mo | ≈ 4 Mo (estimé) | samedi |
| Aquitaine | 336 Mo | ≈ 8 Mo (estimé) | dimanche |
| Basse-Normandie | 164 Mo | ≈ 4 Mo (estimé) | dimanche |
| Centre-Val de Loire | 282 Mo | ≈ 6 Mo (estimé) | dimanche |

Les régions sont réparties sur la semaine par taille d'extrait : ≈ 800 Mo à télécharger et ≈ 1 h de calcul par jour.
La Bretagne, mesurée en ligne, a pris **30 min pour 368 Mo** (lieux et compléments). L'estimation des autres
régions suit la Bretagne : 8,2 Mo pour 368 Mo d'extrait.

**Total du site au 31/10/2026 : 95,6 Mo sur 700**, mesuré avec `site_budget.sh`.
**Avec toute la France : ≈ 210 Mo** (estimé). Le reste du site : réseau cyclable 18 Mo, police Inter 7,5 Mo, app ≈ 30 Mo.

## Prévu
| Lot | Zones | Estimation |
|---|---|---|
| Europe | Londres, Madrid, Rome, Bruxelles (après les formats de téléphone et d'adresse de tous les pays) | ≈ +30 Mo avec les tuiles compressées |

## Format des tuiles (31/10/2026) : adaptatif et compressé
- **Taille adaptée à la densité** (`app/scripts/tileio.py`). On part de carrés d'≈ 40 km et on les coupe en 4 tant
  qu'un fichier compressé dépasse 48 Ko, jusqu'à ≈ 2,4 km en ville. Résultat : un fichier par canton à la campagne,
  des fichiers fins en ville.
- **Stockage compressé** (gzip) : c'est la taille stockée qui compte dans la limite de 1 Go. L'app décompresse
  elle-même (`gzjson.js`).
- Les compteurs de tuiles de `check_publish.py` portent sur les carrés de 2,4 km couverts (`cells`), plus sur les
  fichiers.

| Zone | Avant | Après |
|---|---|---|
| Ille-et-Vilaine (essai) | 2 984 fichiers, 9,6 Mo | 120 fichiers, 2,4 Mo |
| Île-de-France (données locales) | 4 332 fichiers, 53,6 Mo | 472 fichiers, 12,6 Mo |
| Lyon | 307 fichiers, 9,2 Mo | 73 fichiers, 2,1 Mo |

**Toute la France** devient possible : ≈ 150 à 200 Mo et ≈ 10 000 à 15 000 fichiers (déduit de l'Ille-et-Vilaine),
contre ≈ 0,65 à 0,8 Go et 180 000 fichiers avec l'ancien format.

## Régions (31/10/2026)
- Une région entière se déclare comme une ville dans `zones.json`, avec `"region": true` et le cadre de la région
  (moins de 6° de côté). Les extraits d'OSM France suivent les **22 anciennes régions** (`europe/france/bretagne`,
  `rhone_alpes`…) : 21 hors Île-de-France, soit 3 par jour sur la semaine.
- Là où deux jeux de tuiles se chevauchent (bordure entre régions, ou Île-de-France), l'app réunit leurs lieux, sans
  doublon.
- **Bretagne, mesurée en local** (sans compléments) : extrait de 369 Mo, **254 978 lieux, 417 fichiers, 7,9 Mo**,
  calculés en 14 min. Rennes y est inclus : sa zone de ville est retirée.
- **Extrapolation à la France**, à surface égale : la Bretagne fait ≈ 5 % du territoire, donc **≈ 160 Mo et
  ≈ 8 500 fichiers** pour toute la France. Calcul : ≈ 5 h par semaine pour les lieux, plus les compléments.
