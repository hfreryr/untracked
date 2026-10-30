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

**Total du site au 30/10/2026 : 140 Mo sur 700**, mesuré avec `site_budget.sh`.
Le reste se répartit entre le réseau cyclable (18 Mo), la police Inter (7,5 Mo) et l'app (≈ 30 Mo).

## Prévu
| Lot | Villes | Estimation |
|---|---|---|
| 1 | Marseille, Lille, Toulouse, Bordeaux, Nantes, Strasbourg, Montpellier, Rennes, Grenoble, Nice | ≈ +75 Mo |
| 2 | Londres, Madrid, Rome, Bruxelles (après les formats de téléphone et d'adresse de tous les pays) | ≈ +125 Mo |

Total prévu : ≈ 340 Mo.

**Toute la France** : ≈ 0,65 à 0,8 Go et ≈ 180 000 fichiers, hors de portée en l'état. Avant de décider, on fait un
essai sur une région (Bretagne) avec des tuiles plus grandes hors des villes et des tuiles allégées, pour mesurer le
gain réel.
