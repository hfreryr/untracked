# Sources ouvertes pour compléter les lieux (mesure du 15/10/2026)

Décision du porteur du projet (15/10) : le prototype doit être le plus complet possible **sans contribution des utilisateurs** ; toute source au coût d'intégration faible est bonne à prendre.

Mesures faites sur l'extrait OSM de Paris (73 441 lieux nommés), scripts dans `pipeline/mesures_sources/` (`bash pipeline/mesures_sources/run.sh`). Appariement simple : même enseigne à 80 m ou mots du nom en commun à 50 m. Contrôle à l'œil de 15 paires par source : ≈ 13/15 justes pour Overture, ≈ 11/15 pour All The Places (erreurs dues aux parkings, retirés du compte ci-dessous).

## Point de départ

| Lieux OSM à Paris | Total | Sans horaires |
|---|---|---|
| Restaurants, cafés, bars, restauration rapide | 17 412 | 9 343 |
| Commerces | 28 861 | 14 389 |
| Parcs | 605 | 508 |
| Médecins, dentistes | 681 | 468 |
| Pharmacies | 976 | 268 |

## Ce que chaque source apporte

| Source | Licence | Apport mesuré | Coût d'intégration |
|---|---|---|---|
| **Overture** (sites et téléphones) | CDLA-Permissive 2.0, mention « © Overture Maps Foundation » | **14 597 sites** et **17 420 téléphones** pour des lieux OSM qui n'en ont pas ; fait passer les restos sans horaires *qui ont un site* de 927 à **4 316**. ⚠️ Overture **n'a pas de champ horaires** (vérifié dans le schéma de la version 2026-09-23.1). Statut « fermé » : 1 seul lieu à Paris, inutilisable. | Faible : DuckDB est déjà dans le pipeline, lecture par HTTPS |
| **Sites des commerçants** (horaires) | Faits non protégés ; à afficher avec la source (« selon le site du lieu ») | Échantillon de 200 sites (plateformes exclues) : 114 joignables depuis notre environnement, dont **36 (32 %) affichent les horaires sur la page d'accueil**, 24 en données structurées (schema.org). Extrapolé : **≈ 700 à 1 100 restos**, soit 8 à 12 % du manque | Moyen : passage hebdomadaire poli (≈ 3 800 sites), lecture schema.org puis des textes (règles simples d'abord, modèle local ensuite) |
| **All The Places** (sites des enseignes) | CC0 | **378 horaires** (266 par enseigne, 112 par nom), 980 sites, 1 787 téléphones. Lieux sans correspondance dans OSM : 2 267 commerces, 496 banques… (appariement faible : borne haute, à vérifier) | Faible à moyen : 2,7 Go par semaine dans GitHub Actions |
| **Ville de Paris** (« îlots de fraîcheur » : parcs, piscines, musées, bibliothèques) | ODbL | **345 parcs et squares** et **39 équipements** (25 piscines) ; horaires mis à jour par la Ville, y compris les horaires d'été | Faible : 2 fichiers JSON |
| **Annuaire de l'administration** (service-public.fr) | Licence Ouverte 2.0 | 389 services parisiens avec horaires (PMI, CPAM, commissariats, France Services, mairies…), **56 gagnés** avec l'appariement actuel (jusqu'à ≈ 150 en l'améliorant) | Faible |
| **Mangrove** (avis libres, Open Reviews Association) | CC BY 4.0 ([conditions](https://mangrove.reviews/terms), vérifiées le 30/10/2026) : source, licence et lien affichés sous les avis | **201 avis en Île-de-France**, 12 à Lyon (30/10/2026) ; 198 placés sur leur lieu (170 par identifiant OSM, le reste par nom à moins de 40 m) ; 2 avis au plus par lieu, donc pas encore de note moyenne affichée (≥ 3) | Très faible : une demande par région et par construction (`fetch_reviews.py`), rangés dans les tuiles |
| **La Poste** (horaires jour par jour) | ODbL | 18 bureaux de poste seulement sans horaires dans OSM ; intérêt : fermetures exceptionnelles | Faible ; non mesuré (data.gouv.fr injoignable depuis notre environnement) |
| **Foursquare OS Places** | Apache 2.0 | Pas d'horaires ; une date de fermeture (utile pour les commerces fermés) | ⛔ Compte et jeton d'accès nécessaires sur le portail Foursquare (l'ancien accès public a été fermé) |

## Ce que ça donne au total

- **Horaires** : ≈ 1 500 à 1 900 lieux de plus, dont ≈ 800 à 1 200 restos et cafés. Ça réduit le manque, ça ne le comble pas : **aucune source ouverte ne couvre les restaurants indépendants**.
- **Sites et téléphones** : la plus grosse avancée (≈ 15 000 à 17 000 lieux), et la condition pour aller lire les horaires sur les sites.
- **Lyon (30/10/2026, Overture 2026-10-21.0)** : mêmes sources qu'à Paris, sauf la Ville de Paris (`build_extras.py --no-paris`, tâche hebdomadaire `places-zones.yml`). Sur l'extrait du Rhône : 2 660 sites, 3 767 téléphones et 7 703 adresses Overture ; 201 sites, 279 téléphones et 102 horaires All The Places ; **7 387 lieux complétés** dans le cadre de l'agglomération, en 10 min. Lieux absents d'OSM : échantillon de 12 restaurants « absents » contrôlé à l'œil, la moitié existent sous un autre nom (« Kfc Lyon République » / « KFC ») ; pas d'affichage pour l'instant.
- **Lieux absents d'OSM** : Overture compte 6 261 restos et cafés (confiance ≥ 0,8) sans correspondance dans OSM. Chiffre **non fiable** en l'état (variantes de nom, lieux fermés) : à contrôler sur un échantillon avant toute idée d'affichage.

## Règles qui ne bougent pas

- Rien de ces sources n'entre dans OSM (pas d'import, pas de modification automatique).
- Dans l'app, une donnée qui ne vient pas d'OSM est **affichée avec sa source** (« Horaires selon le site du lieu », « Téléphone : Overture ») ; elle n'est jamais présentée comme vérifiée.
- Données préparées chaque nuit ou chaque semaine dans les tuiles de lieux, jamais demandées lieu par lieu depuis le téléphone.
- Rien de Google, ni des plateformes (TheFork, Tripadvisor, Uber Eats, Deliveroo, Pages Jaunes, Instagram, Facebook) : exclues des sites lus.

## Ordre proposé (accepté le 15/10, avec l'affichage des sources dans la fiche)

1. ✅ Overture : sites et téléphones (PR #37) — 8 477 sites et 14 215 téléphones après appariement prudent.
2. ✅ Ville de Paris : parcs et piscines — 379 horaires (320 parcs, 25 jardins, 30 piscines…), seulement pour la période en cours.
3. ✅ All The Places et annuaire de l'administration — enseignes : 209 horaires, 457 sites, 941 téléphones (horaires au format OSM vérifié, parkings et consignes exclus) ; annuaire : 23 horaires de services publics (mairies, PMI, tribunaux), en écartant les « sur rendez-vous », les permanences d'un ou deux jours et les adresses partagées par plusieurs services aux horaires différents.
4. ✅ Sites des lieux : données structurées (schema.org) seulement, nom du site comparé au nom du lieu, robots.txt respecté (`build_sitehours.py`, chaque lundi). Essai sur 400 sites depuis notre environnement : 191 joignables, **23 horaires** (12 % des joignables), tous plausibles à la relecture. Sur ≈ 4 300 sites : ≈ 250 à 500 horaires attendus selon la part joignable depuis GitHub. La lecture du texte des pages (sans données structurées) n'est pas faite : plus d'erreurs possibles, à décider.

Décision attendue du porteur : afficher dans l'app des informations qui ne viennent pas d'OSM, avec leur source (condition de tout ce qui précède).

## Passer à l'échelle mondiale sans visiter les sites nous-mêmes (mesure du 15/10/2026)

Principe retenu par le porteur du projet : **ce qui est frugal et passe à l'échelle**. Lire nous-mêmes chaque site chaque semaine fonctionne pour Paris (≈ 4 300 sites, ≈ 25 min), mais pas pour le monde (millions de sites, robot à héberger, blocages, règles par pays). Les archives du web existantes permettent d'éviter une partie des visites.

| Archive | Ce qu'elle offre | Mesure sur nos sites parisiens | Verdict |
|---|---|---|---|
| **Common Crawl** (copie mensuelle de milliards de pages, accès libre) | Index en colonnes interrogeable sans compte ; une page se télécharge seule, par plage d'octets | Copie de septembre 2026 : **1 547 domaines sur 3 296 présents (47 %)** ; sur 150 tirés au hasard, 149 pages HTML (105 pages d'accueil), **16 avec des horaires lisibles (11 %)**, autant que la lecture en direct (12 %) | ✅ À utiliser en premier : ≈ 160 horaires à Paris sans aucune visite |
| **Web Data Commons** (Université de Mannheim : données structurées extraites de Common Crawl) | Déjà extrait : 84 256 sites de restaurants et 1,46 million de sites de commerces dans le monde (édition 2024-12, la plus récente trouvée) | **176 domaines parisiens avec horaires** | ⚠️ Une édition par an : horaires trop anciens pour être affichés seuls ; utile pour repérer quels sites publient des horaires |
| **Open Web Index** (projet européen OpenWebSearch.eu) | Index du web ouvert, européen | Non mesuré | ⛔ Licence « usage personnel, non commercial et recherche » : incompatible avec une reprise du produit (règle du projet) |
| **HTTP Archive** | Copie mensuelle des pages d'accueil de millions de sites | Non mesuré | ⚠️ Données dans BigQuery (Google) : quota gratuit limité, et une dépendance à Google que le projet évite |

**Architecture proposée, applicable partout** :
1. Common Crawl d'abord (les 3 dernières copies mensuelles, pour couvrir plus de sites) : aucune visite.
2. Notre robot seulement pour les sites absents de Common Crawl, et rarement : une fois par mois, une fois par trimestre pour les sites qui n'ont jamais publié d'horaires, en ne retéléchargeant que les pages modifiées.
3. Les règles de rapprochement des noms à adapter par langue (aujourd'hui : français).

Scripts : `pipeline/mesures_sources/cc_dom.py`, `cc_hours.py`.

### Mis en place le 15/10/2026 (`build_sitehours.py`)

- **Common Crawl d'abord** (2 dernières copies) : présence des domaines par l'index en colonnes, puis l'index compact pour trouver la page exacte du lieu, puis la page elle-même dans l'archive. Seulement la page exacte : pour une chaîne, la page d'accueil donnerait les horaires du siège.
- **Visite du site ensuite**, seulement si l'archive ne l'a pas, avec la question « la page a-t-elle changé ? ».
- **Rythme** : un site n'est pas relu avant 28 jours s'il publie ses horaires (ou s'il était injoignable), 90 jours sinon. L'état est gardé dans `data/sitehours.json`.

Essai sur 400 sites parisiens : semaine 1, **115 lus dans l'archive sans visite**, 285 visites tentées au lieu de 400 (**−29 %**), **26 horaires** (24 avec les seules visites) ; semaine 2, **aucune visite**, horaires conservés, 46 s de calcul.

