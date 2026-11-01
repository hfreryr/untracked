# Untracked Maps

**Une carte aussi agréable que Google Maps, qui ne vous piste pas.**
Pour celles et ceux qui ont déjà choisi Signal, Proton ou Brave.

👉 **[untrackedmaps.app](https://untrackedmaps.app)** (à ouvrir sur un téléphone)

Untracked Maps est une app web de cartographie grand public, construite sur [OpenStreetMap](https://www.openstreetmap.org) et des moteurs libres. Ce n'est ni un fork ni une extension d'une autre app : c'est notre propre app, qui vise le niveau de finition de Google Maps et de Plans d'Apple. Zone couverte : **Île-de-France** (lieux et leurs compléments, recherche, carte vélo, transports) ; horaires de la Ville et devantures : Paris. **Toute la France métropolitaine** (21 régions) et **Amsterdam** : fiches des lieux avec horaires, catégories, recherche par type et par nom sur le téléphone, adresses, rues et lieux connus de toute la France trouvés d’où que l’on cherche (annuaire national, `docs/recherche.md` ; adresses et téléphones au format du pays) (données refaites chaque semaine, `places-zones.yml` ; régions, villes et jours dans `app/src/lib/cities/zones.json`, tableau de bord et plafond de 700 Mo dans [`docs/villes.md`](docs/villes.md)). Ailleurs : fond de carte et lieux d'OpenFreeMap (musées et monuments dès le zoom 14), plan des métros et trams des 11 grandes villes françaises (`app/scripts/build_transit_cities.py`).

- **Aucune donnée personnelle collectée**, pas de mesure d'audience, pas de compte.
- **Aucune dépendance à Google.**
- **Code libre** (AGPL-3.0) ; tout ce qui est corrigé sur la carte repart dans OpenStreetMap.

## Ce que fait l'app

- **Recherche** en langage courant : « restaurant ce soir 8e », « boulangerie ouverte dimanche » ; 60 catégories que chacun choisit et réordonne ; filtres « ouvert maintenant », « ouvert à… », terrasse, végétarien, à emporter, fauteuil roulant (seulement ceux qui servent ; les lieux sans information restent à part) ; Entrée montre tous les lieux du nom cherché.
- **Fiche lieu** : ouvert ou fermé, date de dernière vérification sur place, horaires de la semaine, « bon à savoir » (paiement, terrasse, accessibilité…), photos Wikimedia en plein écran.
- **Transports en commun** : prochains passages en temps réel, sorties de métro, place conseillée dans la rame, info trafic (travaux, incidents, stations non desservies) d'Île-de-France Mobilités via Transitous.
- **Carte vélo** : pistes, bandes et voies bus, double-sens cyclables et voies où le vélo est autorisé (réseau refait chaque nuit depuis OSM, Île-de-France), affichée aussi pendant un itinéraire à vélo.
- **Itinéraires** à pied, à vélo, en transports et en voiture : choix entre plusieurs trajets, départ ou arrivée à l'heure choisie, arrêt intermédiaire, guidage pas à pas vocal (panneau inspiré de Plans, flèche de position qui glisse en continu ; depuis votre position, l'itinéraire suit vos déplacements). En transports, le détail se lit étape par étape (meilleure entrée, rame dessinée, arrêts dépliables, meilleure sortie) et toucher une étape la montre sur la carte.
- **Mes lieux** sans compte ni serveur : listes, Maison, Travail et raccourcis personnels (nom et icône au choix), import depuis Google Takeout, transfert vers un autre appareil par lien ou QR code, sauvegarde chiffrée.
- **Position** : direction façon boussole, carte qui tourne avec vous.
- **À propos (bouton ⓘ)** : la promesse (montrée une seule fois, à la première ouverture), l'origine de chaque information et ses licences, signaler une erreur. La mention « © OpenStreetMap » s'affiche 5 s à chaque ouverture, comme le permettent les règles d'attribution d'OSM.

Détails techniques et sources de données : [`app/README.md`](app/README.md).

## Deux chantiers

### 1. 🗺️ L'app (`app/`)
SvelteKit + MapLibre, site statique. Fond de carte OpenFreeMap, recherche sur le téléphone (index préparé chaque nuit, voir `docs/recherche.md`) complétée par Photon, détails des lieux dans des tuiles préparées chaque nuit depuis OSM (sans Overpass), itinéraires Valhalla (FOSSGIS) et Transitous. Testée avec de vrais utilisateurs, chronométrés face à Google Maps.

**Données publiées** : une publication de nuit qui ferait baisser les lieux ou les tuiles de plus de 10 % est bloquée (`check_publish.py`, mail d'échec, la veille reste en ligne). Historique du site gardé 7 jours, regroupé chaque dimanche (`historique.yml`) ; pour revenir en arrière : Actions → « Revenir à une version du site » → date (`restore.yml`).

### 2. 🔍 Fraîcheur des lieux (`pipeline/`)
Repérer les lieux d'OSM qui ne sont plus à jour, en commençant par les **commerces fermés**, en croisant OSM avec [Overture Maps](https://overturemaps.org). Pilote : Paris 6e.

L'objectif : que l'app affiche « vérifié il y a 3 semaines » plutôt que des notes, et invite les gens sur place à confirmer ou corriger, avec leur propre compte OSM.

## Contribuer à OpenStreetMap, dans les règles

- **Aucune modification automatique ni aucun import.** Le pipeline repère, une personne confirme.
- Les futures questions posées sur place partiront **avec le compte OSM de chaque utilisateur**, signées `created_by=Untracked Maps`.
- Rien ne vient de Google Maps ou d'une autre carte protégée.
- Annonce à la communauté : [forum OSM France](https://forum.openstreetmap.fr/t/untracked-maps-annonce-questions-de-verification-sur-place-a-paris-6e/47449). Règles détaillées : [`docs/contribution-osm.md`](docs/contribution-osm.md).

## Feuille de route

| Étape | Objectif | État |
|---|---|---|
| App : carte, recherche, fiche lieu, itinéraires, guidage | Prototype en ligne | ✅ |
| Tests utilisateurs | 5 personnes face à Google Maps | 4 faites, 1 prévue (+ 2 mini-séances icône) |
| Comparaison chiffrée | 20 recherches types, Untracked vs Google | À faire |
| Fraîcheur des lieux | Détection Paris 6e, puis vérification de 50 cas sur le terrain | Détection ✅, vérification à faire |
| Questions sur place | Vérification par les utilisateurs, avec leur compte OSM | Après l'annonce à la communauté |
| Autonomie | Nos propres serveurs Île-de-France (recherche, itinéraires, transports) | À chiffrer |
| Magasins d'applications | Être aussi dans Google Play et l'App Store (« ah mais c'est seulement sur internet ? ») | **Question ouverte** (28/10) : Google Play faisable, App Store risqué ; à reprendre si l'absence des magasins freine l'adoption malgré le bouton « Installer » ([docs/magasins-applications.md](docs/magasins-applications.md)) |
| Photos d'ambiance des lieux | Ce que Google et Apple ont et qu'aucune source ouverte n'a | Mesuré et cadre juridique vérifié le 13/10 ([docs/photos-lieux.md](docs/photos-lieux.md)) : seules voies propres = accord du commerçant, photos des utilisateurs. **En suspens** (décision du 13/10) |

### Photos d'ambiance : ce qui a été mesuré (13/10/2026)

Aucune source ouverte ne couvre les commerces (Wikimedia : 307 sur 46 466 à Paris ; Panoramax donne la rue, pas l'ambiance : retiré des listes après test).
Piste testée : l'image que le **site web du lieu** propose pour les partages (`og:image`), script `app/scripts/test_ogimage.py`, zone Paris 6e :
1 296 restaurants / cafés / bars, **496 ont un site web (38 %)** ; 105 sites injoignables, 174 sans `og:image`, 93 logos ou trop petites, **112 images retenues** dont ≈ 80 % sont de vraies photos à l'œil
→ **≈ 90 lieux, soit 7 % de la zone**. Qualité bonne quand elle existe, couverture trop faible pour en faire la source principale ; question juridique (réutilisation hors aperçu de lien) non tranchée.
Même test avec les sites connus d'**Overture** (6e) : 882 restaurants / cafés / bars, **713 ont un site (81 %)** contre 38 % dans OSM ; sur 698 sites testés : 136 images retenues (**15 %** des lieux), 253 sites injoignables depuis notre environnement de test (filtrage réseau probable, plafond réel estimé ≈ 25 %).

**Terminé le 15/10/2026** : [plan de nettoyage](docs/plan-nettoyage.md) (tests, sécurité, rangement du code, textes) ; restent les actions du porteur du projet listées à la fin du plan.

## Valeurs

- **Zéro pistage** : aucune donnée personnelle collectée.
- **Communs** : tout ce qui est corrigé repart dans OSM, aucun silo.
- **Frugalité** : coût minimal, auto-hébergeable, pas de dépendance propriétaire.
- **Exigence UX** : la frugalité n'excuse pas une mauvaise expérience.

## Licences

- Code : [AGPL-3.0](LICENSE)
- Données produites : ODbL (comme OSM)
- Documentation : CC-BY-SA 4.0
