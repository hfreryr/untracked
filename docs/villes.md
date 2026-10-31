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

## Villes
| Ville | Pays | Habitants couverts (≈) | Poids mesuré | Lieux | Complétés hors OSM | Mise à jour | Depuis |
|---|---|---|---|---|---|---|---|
| Île-de-France | FR | 12,3 M | 84,6 Mo | — | voir `sources-donnees.md` | chaque nuit | 10/2026 |
| Lyon | FR | 1,4 M | 8,3 Mo | 49 521 | 7 387 | mercredi | 29/10/2026 |
| Amsterdam | NL | 1 M | 6,8 Mo (essai local) | 33 948 | 3 988 | jeudi | 30/10/2026 |
| Marseille (avec Aix) | FR | 1,9 M | 6,6 Mo* | 42 261 | — | lundi | lot 1 |
| Nice (avec Cannes, Antibes) | FR | 0,7 M | 5,5 Mo* | 34 254 | — | lundi | lot 1 |
| Lille | FR | 1,2 M | 5,7 Mo* | 36 124 | — | mardi | lot 1 |
| Rennes | FR | 0,5 M | 3,0 Mo* | 18 874 | — | mardi | lot 1 |
| Toulouse | FR | 1 M | 5,9 Mo* | 36 554 | — | mercredi | lot 1 |
| Bordeaux | FR | 0,9 M | 5,5 Mo* | 30 223 | — | jeudi | lot 1 |
| Nantes | FR | 0,7 M | 4,4 Mo* | 25 116 | — | vendredi | lot 1 |
| Grenoble | FR | 0,5 M | 3,9 Mo* | 25 615 | — | vendredi | lot 1 |
| Strasbourg | FR | 0,5 M | 3,5 Mo* | 19 988 | — | samedi | lot 1 |
| Montpellier | FR | 0,5 M | 3,2 Mo* | 20 246 | — | dimanche | lot 1 |

\* Mesuré en local le 30/10/2026, sans les compléments hors OSM (≈ +10 à 15 %) : **47 Mo pour les 10 villes**, contre 75 Mo estimés. Habitants : ordres de grandeur, non vérifiés.

**Total du site au 30/10/2026 : 140 Mo sur 700**, mesuré avec `site_budget.sh`.
Le reste se répartit entre le réseau cyclable (18 Mo), la police Inter (7,5 Mo) et l'app (≈ 30 Mo).

## Prévu
| Lot | Villes | Estimation |
|---|---|---|
| 2 | Londres, Madrid, Rome, Bruxelles (après les formats de téléphone et d'adresse de tous les pays) | ≈ +125 Mo |

Total prévu après le lot 2 : ≈ 320 Mo.

**Toute la France** : ≈ 0,65 à 0,8 Go et ≈ 180 000 fichiers, hors de portée en l'état. Avant de décider, on fait un
essai sur une région (Bretagne) avec des tuiles plus grandes hors des villes et des tuiles allégées, pour mesurer le
gain réel.
