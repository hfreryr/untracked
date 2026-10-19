# Untracked Maps — l'app (prototype)

Carte de Paris centrée sur vous à l'ouverture, recherche de lieux et de types de lieux (« pharmacie », « resto près de moi »), fiche lieu avec horaires lisibles et prochains passages en station, listes par catégorie triées depuis votre position (distance, ouvert / fermé), favoris et lieux récents (gardés sur l'appareil uniquement), mode sombre automatique, itinéraires à pied, à vélo et en transports en commun.

En ligne : https://untrackedmaps.app

## Lancer

```bash
cd app
npm install
npm run dev      # développement
npm run build    # site statique dans app/build/
npm test         # tests unitaires (logique : horaires, recherche, Mes lieux, import, itinéraires), sans réseau
npm run e2e      # tests de bout en bout sur le site construit (vrais services ; E2E_ONLY=mot pour en lancer un seul)
node tests/visual/capture.mjs /tmp/x   # captures avant/après (voir tests/visual/README.md)
```

**Publier** (depuis la racine du dépôt) : `bash app/scripts/publish.sh "message"`. Le script remplace le site sur la branche `gh-pages` **sans toucher** aux données déposées par les actions automatiques (`data/places/`, `data/facades.json`). Ne pas publier à la main : le 13/10, une publication manuelle a effacé les devantures de tout Paris (rétablies).

## Couches maison (`static/data/`)

Générées depuis l'extrait OpenStreetMap de Paris (`data/paris.osm.pbf`) :

```bash
python app/scripts/build_overlays.py data/paris.osm.pbf
```

- `landmarks.geojson` : ~7 300 lieux affichés jusqu'au zoom 18 : monuments, musées, parcs et gares, plus les adresses du quotidien (restaurants, cafés, boutiques, hôtels). Chaque lieu a un score de notoriété (traductions du nom, Wikidata, fiche OSM complète ; les enseignes de chaîne ne profitent pas de leurs traductions automatiques) et un **zoom d'apparition** `z`, calculé pour garder un écart régulier à l'écran (plus serré pour les lieux très connus). Au-delà du zoom 17, le fond de carte complète avec tous les lieux.
- `places/14/{x}/{y}.json` : **tous les lieux** (≈ 89 000 : commerces, services, monuments, stations), avec leurs étiquettes utiles (horaires, téléphone, site, accès, paiement, régimes, date de vérification…), découpés par tuile de ≈ 2,4 km. Généré par `python app/scripts/build_places.py data/paris-latest.osm.pbf` (≈ 1 min, 80 tuiles, 16 Mo bruts / ≈ 3,5 Mo compressés, 95 Ko par tuile en médiane). Reconstruit chaque nuit par l'action GitHub `places.yml` dans `data/places/` du site. Non versionné dans Git.
- `traffic-paris.json` : trafic habituel de Paris, généré par `python app/scripts/build_traffic.py` depuis les comptages routiers permanents de la Ville de Paris (ODbL) : pour chaque jour et chaque heure, la vitesse mesurée (débit ÷ taux d'occupation) rapportée à l'heure la plus rapide de la semaine. Ce ralentissement mesuré (de 1,0 la nuit à 1,96 le jeudi à 18 h) allonge directement le temps « route libre » de Valhalla : aucun coefficient fixé à la main. Seule hypothèse restante : que le temps Valhalla corresponde à la circulation de nuit ; à vérifier par comparaisons manuelles. Ordres de grandeur cohérents avec le TomTom Traffic Index 2025 (Paris, pointe du soir : +73 %).
- `transit-lines.geojson` : lignes de métro, RER et tram à leurs couleurs officielles (mode « Transports »).

## Briques utilisées, et ce que chacune reçoit (mis à jour le 13/10/2026)

Aucune donnée personnelle n'est collectée **par nous** ; la position ne quitte l'appareil que pour calculer un itinéraire. Mais chaque service tiers reçoit l'adresse IP et la requête. Politique de chaque fournisseur vérifiée le 13/10/2026.

| Brique | Service | Ce qu'il reçoit | Conditions d'usage (source) |
|---|---|---|---|
| Fond de carte | [OpenFreeMap](https://openfreemap.org), style maison (`src/lib/mapstyle.js`) | IP + zone regardée | Sans limite, commercial OK ; journaux anonymisés effacés sous 7 j ([politique](https://openfreemap.org/privacy/)) |
| Détails d'un lieu, listes de catégories, horaires | **Tuiles de lieux préparées la nuit** (`scripts/build_places.py`, action GitHub `places.yml`), servies avec le site | Rien : fichiers statiques chez nous | Extrait OSM Paris d'openstreetmap.fr, quotidien |
| Adresses (France) | [Géoplateforme / Base Adresse Nationale](https://www.data.gouv.fr/dataservices/api-geoplateforme-geocodage/discussions) | IP + texte tapé | Service public, 50 req/s par IP |
| Noms de lieux | [Photon](https://photon.komoot.io) (instance publique komoot) | IP + texte tapé | « Usage raisonnable », sans garantie ; à auto-héberger avant lancement |
| Itinéraires à pied / vélo / voiture | [Valhalla FOSSGIS](https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/) | IP + départ + arrivée | Usage jugé « raisonnable » par FOSSGIS (16/10). Leurs conditions : **1 req/s max** (file d'attente `ratelimit.js`), lien fixthemap, e-mail de contact visible (contact@untrackedmaps.app), **pas de site à fort trafic ni d'usage commercial où le service est essentiel** ; adresse configurable (`VITE_ROUTING_URL`) ; à auto-héberger avant lancement |
| Transports en commun | [Transitous](https://transitous.org/api/) (MOTIS) | IP + départ + arrivée, station consultée | Projets libres, **usage commercial interdit** ; validé par les mainteneurs ; MOTIS à auto-héberger avant lancement |
| Photos et textes | Wikidata, Wikipédia, Wikimedia Commons | IP + lieu consulté | Identification par en-tête `Api-User-Agent` |
| Horaires, guidage, Mes lieux, boussole | Sur l'appareil | Rien | — |
| Police de l'interface | Police système | Rien | Aucun appel à Google Fonts |

Interdits par les règles du projet : Overpass (limites d'usage incompatibles avec une app), l'API d'édition d'OSM en lecture, Maptoolkit (licence limitée aux petits projets).

### Structure pour tenir au-delà de Paris
- **Données par tuile** (`src/lib/placestore.js`), URL de base configurable (`VITE_DATA_BASE`, `src/lib/config.js`).
- **Une interface par besoin** : `geocode.js` (adresses et noms, fournisseur selon le pays), `places.js` (détails et catégories, depuis les tuiles), `routing.js`.
- **Profil de ville** (`src/lib/cities/paris.js`) : boîtes, arrondissements, enrichissements locaux (sorties, rame, trafic). Une donnée absente = fonction désactivée.
- **Découpage de l'écran** (fait le 14/10) : `src/routes/+page.svelte` (3 770 → environ 730 lignes) ne garde que l'état, la carte et l'assemblage.
  - **Comment les morceaux se parlent** : la page déclare l'état (lieu ouvert, catégorie, itinéraire, Mes lieux…) et le partage par un objet `app` (bloc généré entre `// <app>` et `// </app>`, transmis par `setContext('app', app)`). Un composant écrit `const app = getContext('app')` puis lit ou modifie `app.place`, `app.directions`… `npm run check` vérifie que chaque `app.nom` utilisé existe bien dans ce bloc.
  - **Écran** (`src/lib/ui/`) : `TopBar` (barres du haut), `ResultList` et `PinnedRow` (résultats de recherche), `CategorySheet` (liste d'une catégorie), `PlaceSheet` (fiche lieu et station), `RouteSheet` (itinéraire), `NavView` (guidage), `MapControls` (boussole, type de carte, position), `PhotoViewer` et `StreetThumb` (photos, vue de la rue), `ListPicker`, `TransferSheet`, `ImportSheet`, `ChipsEditor`, `PromiseBanner`, petits éléments (`ModeIcon`, `LegChain`, `ListDot`, `Facade`), styles communs `base.css`.
  - **Logique** (`src/lib/`), une fonction `createX(app)` par sujet : `mapsetup.svelte.js` (mise en place de la carte), `mapdraw.js` (dessin et cadrage), `searchflow.js` (recherche et catégories), `placeflow.js` (fiche lieu), `directionsflow.js` (itinéraire), `navflow.js` (guidage), `location.js` (position, boussole), `myplacesflow.js`, `shortcutsflow.js`, `chipsflow.js`, `importflow.js` (Mes lieux), `screen.js` (messages, retour arrière), `zoom.js` (visionneuse). Plus les modules sans état déjà existants (`routing.js`, `hours.js`, `myplaces.js`, `routeview.js`, `maplayers.js`…).
  - **Écart avec le plan initial** : l'état n'a pas été déplacé dans un `state.svelte.js` ; il reste déclaré dans la page et passe par l'objet `app`. Même effet pour les composants (ils lisent l'état au lieu de tout recevoir), sans réécrire les ~160 déclarations d'état. On pourra le faire plus tard si besoin.

  Chaque étape a été vérifiée par comparaison de captures avant/après et par les tests e2e.
- **Icône** (14/10) : piste A « Sans trace » (un repère, derrière lui deux points qui s'effacent), version claire : fond blanc, repère bleu `#2A5BD7`. Choix **provisoire**, à valider par les tests utilisateurs (protocole dans Notion). Sources `static/icon.svg` et `static/icon-maskable.svg` (dessin réduit pour Android, qui découpe l'icône en rond) ; les PNG (512, 192, iPhone 180, onglet 32) se régénèrent avec `node scripts/build_icons.mjs`. Une icône personnalisable par l'utilisateur demanderait une app native : une app web installée garde l'icône du manifeste.
- **Accessibilité** (14/10) : objectif WCAG 2.1 AA. Audit automatique axe-core sur 7 écrans, en clair et en sombre, dans `npm run e2e` (échec au moindre défaut). Corrigés le 14/10 : contraste du raccourci de catégorie actif (fond assombri), du bouton « Aller » et du vert « Ouvert » (`#18843d`), des liens de « Qui voit quoi » en mode sombre ; liste de résultats nommée ; rôles corrigés (lieux épinglés, carte). Pas encore fait : essai au clavier et avec VoiceOver.
- **Textes** (fait le 14/10) : tous les textes affichés sont dans `src/lib/i18n/fr.js`, rangés par écran, et appelés par `tx('fiche.itineraire')` ou `tx('meslieux.lieu_restaure', { n: 3 })` (accords par une petite fonction et `pluriel`). `tests/unit/textes.test.js` refuse un texte écrit en dur, une clé manquante ou inutilisée, une valeur oubliée. Exceptions : vocabulaire de recherche (`intent.js`, mots-clés de `categories.js`) et profil de ville.

## Retours des premiers tests (12/10/2026)
- **Métro** : raccourci « Métro » (stations les plus proches, prochains passages directement dans la liste) ; la recherche comprend « métro », « station », « métro le plus proche » ; les stations restent toujours visibles sur la carte dès le zoom 13.
- **Distributeurs, Banques, Stations-service** : nouveaux raccourcis et pictogrammes.
- **Sorties de métro** : fiche station (« Sorties ») et « sortie conseillée » dans les trajets en transport. Index `static/data/exits.json` construit depuis OSM par `scripts/build_overlays.py`. **Place dans la rame** : jeu « Positionnement dans la rame » (RATP / Île-de-France Mobilités, Licence Ouverte 2.0), converti par `python app/scripts/build_rame.py` en `static/data/rame.json` ; le quai est retrouvé grâce à l'identifiant IDFM donné par Transitous. Depuis le 14/10 : les sorties RATP sont **situées** grâce au « Référentiel des arrêts : Accès » d'IDFM (Licence Ouverte 2.0 ; 3 023 couples quai-sortie sur 3 027), et l'app choisit la sortie RATP la plus proche de la suite du trajet, avec la voiture où monter. Avant, on rapprochait les noms de rue OSM et RATP, ce qui échouait presque toujours (0 conseil affiché sur 4 trajets testés ; 4 sur 4 après correctif). La sortie OSM reste en secours, sans placement. Vers un bus ou un tram, on conseille la sortie la plus proche de l'arrêt ; entre métro et RER, la voiture pour la correspondance.
- **Maison / Travail** : raccourcis en tête de la recherche (itinéraire en un geste), définissables depuis la fiche d'un lieu.
- **Import Google Maps** : archive Google Takeout « Maps (vos adresses) » lue sur le téléphone (`src/lib/importgoogle.js`), lieux enregistrés → favoris, adresses « Domicile / Travail » → raccourcis.
- **Raccourcis personnalisables** : affichage, ordre et nom, gardés sur l'appareil.
- **Promesse visible** à la première ouverture et en bas de la recherche ; explication sous « Horaires non renseignés » ; libellé vélo explicite.
- **Fiches dans l'ordre de l'utile** : station → prochains passages et sorties avant la photo ; commerce → horaires, téléphone, site avant le texte Wikipédia ; monument → photo et histoire d'abord.
- **59 raccourcis de catégories** (11 affichés d'origine, les autres activables dans « Personnaliser les raccourcis ») : fleuristes, cimetières, piscines, toilettes, cavistes, coiffeurs, vétérinaires, bornes de recharge… Les lieux de la carte sont complétés par la recherche Photon par catégorie (`include=osm.shop.florist`) pour les lieux hors de la vue ; tous sont posés sur la carte.
- **Arrêt intermédiaire** dans les itinéraires (« Ajouter un arrêt ») : à pied, vélo, voiture via Valhalla (plusieurs points) ; en transport, deux recherches Transitous enchaînées (`transitWithStop`).
- **Choix de l'itinéraire puis guidage** (refait le 14/10, sur le modèle de Google Maps et Plans) : en haut, départ et arrivée sur 2 lignes ; dans la fiche, les modes en onglets avec leur temps, puis le **résumé de l'itinéraire choisi** (durée, arrivée, distance, **Aller**, **+ Arrêt**). La fiche s'ouvre à ce résumé : la carte garde 65 % de l'écran (31 % avant, mesuré dans Chromium 390 × 844). En tirant la fiche : étapes, puis autres itinéraires (jusqu'à 3 à pied, à vélo, en voiture, via Valhalla `alternates` ; plusieurs propositions en transport). Les variantes restent aussi sur la carte, avec leur écart de temps, à toucher pour choisir. Le guidage (`src/lib/nav.js`) : bandeau de la prochaine manœuvre et sa distance, carte qui suit et s'oriente, heure d'arrivée et temps restant, voix (synthèse du téléphone, coupable), écran gardé allumé quand le navigateur le permet, nouveau calcul après ~3 positions hors du trajet, arrivée confirmée par deux positions. En transport : marcher, monter (place dans la rame), descendre (sortie), avec avance à l'horaire sous terre. Tout est calculé sur le téléphone.
- **Mes lieux** (`src/lib/myplaces.js`) : raccourci en tête qui n'affiche que vos lieux et ouvre la fiche de gestion. Lieux épinglés (Maison, Travail, puis vos lieux) en haut de la recherche ; listes « Favoris », « À tester » et listes personnelles ; « Enregistrer » en un geste (dans Favoris, puis « Changer ») ; chaque lieu garde l'icône de sa liste sur la carte (masquable dans le menu du type de carte) ; import Google qui conserve les listes ; partage d'une liste par un lien qui la contient.
- **Sans serveur** : transfert vers un autre appareil par un lien ou un QR code (données après le « # », jamais envoyées au site) ; sauvegarde dans un fichier à ranger dans son propre cloud, chiffrée par mot de passe si on le souhaite (PBKDF2 + AES-GCM), avec rappel discret au-delà de 30 jours ; restauration par fusion. Bibliothèque QR : `qrcode-generator` (MIT).

## Retours des tests P3 et P4, et du porteur (15/10/2026)
Synthèse complète dans Notion (« Synthèse des séances »). Corrigé et testé (un test e2e par point) :
- **Guidage** : le tronçon parcouru disparaît du tracé ; le point de départ (rond bleu) n'est plus affiché sous la flèche (`remaining()` dans `nav.js`).
- **Aperçu d'itinéraire** : la fiche se réduit à une fine bande (poignée + durées), option `min` de `sheet.js` ; à l'aperçu, le haut des étapes dépasse sous « Aller », coupé exprès pour montrer qu'il y a une suite (option `tease`).
- **Recherche de secours** : si Photon est en panne ou met plus de 4 s, la recherche par nom se fait dans nos données de lieux (`localsearch.js`).
- **Zones** (« Paris 8e », un quartier) : la carte s'y cadre, sans fiche, les raccourcis restent disponibles.
- **Listes** : « Enregistré dans … · Modifier » dans le menu ⋯ de la fiche ; pictogramme et couleur au choix (mode Modifier).
- **Raccourcis** : chercher une catégorie absente des raccourcis propose « + Ajouter … à vos raccourcis ».
- **Preuve de non-pistage** : « 0 traceur · 0 cookie · code ouvert · Vérifier » sous la recherche, section « Vérifiez vous-même » dans Qui voit quoi ; un test e2e vérifie l'affirmation (aucun cookie, aucun service hors de la liste).
- **Résumé d'un trajet en transports** : place dans la rame et sortie à l'arrivée, sans faire défiler.
- **Photos** : 1 200 px sur téléphone (au lieu de 2 400).
- **Raccourcis** (décision du 15/10) : bouton « + » fixé à droite de la rangée (le crayon n'était pas vu), 5 raccourcis par défaut (Mes lieux, Restaurants, Cafés, Métro, Pharmacies).
- **Recherche** : exemples touchables à l'ouverture (« restaurant ouvert demain dans le 8e »…), texte de la barre recentré ; à l'ouverture de l'app, 2 exemples s'écrivent puis s'effacent dans la barre vide, une seule fois, en moins de 5 s (WCAG 2.2.2), arrêtés au premier toucher, absents si « réduire les animations » (`typedhint.js`).
- **Guidage sans localisation** : flèches pour passer les étapes à la main tant qu'aucune position n'arrive.
- **Transports** : prix estimé (tickets à l'unité IDFM 2026, `fares.js`, tarifs dans le profil de ville), choix des modes (Tous, Métro, Métro et RER, Bus et tram ; paramètre `transitModes` de Transitous), 2 prochains passages dans la liste des stations.
- **Calcul de nuit** : second lancement de secours à 05:15 UTC, sans effet si les données du jour sont déjà en ligne.
- **Horaires manquants** : mesure et plan dans `docs/chantier-horaires.md` (52 % des restaurants, cafés, bars et boulangeries sans horaires ; 9 % d'entre eux seulement ont un site web).
- Écartés, avec justification dans la synthèse : notes et avis (aucune source ouverte compatible pour l'instant), affluence en direct (calculée par Google à partir du pistage de position), compteur « traceurs évités » (trompeur : nous n'en bloquons pas, nous n'en avons pas), menu « burger ».

## Fiche lieu (13/10/2026)

Inspirée de Plans, avec une différence assumée : pas de notes (aucune source ouverte), mais la **date de vérification** (`check_date` d'OSM) en tête de fiche.

- En tête : statut d'ouverture, « Infos vérifiées en … » (ou « non vérifiées depuis … » au-delà de 2 ans).
- Boutons de même largeur : temps à pied (bleu), Appeler, Site web ; les boutons sans info disparaissent.
- Bandeau : distance, accès fauteuil, entrée gratuite/payante. Sections : Bon à savoir (tags OSM : paiement, terrasse, régimes, chiens…), Horaires, Détails.
- Barre flottante ♡ (Favoris) · ＋ (autre liste) · ••• (Maison, Travail, copier, partager).
- Contribution : liens vers OpenStreetMap (modifier / signaler). L'utilisateur modifie lui-même sur le site d'OSM ; l'app n'écrit rien dans OSM.

## Recherche « ouvert ce soir » (13/10/2026)

- Taper « restaurant ce soir 8e », « boulangerie ouverte dimanche », « bar vers 23 h 11e » : la carte se place sur la zone et la liste n'affiche que les lieux ouverts à ce moment (`src/lib/intent.js`, analyse faite sur le téléphone).
- Dans une liste de catégorie : pastilles « Ouvert maintenant » et « Ouvert à… » (raccourcis Midi / Ce soir / Demain soir, ou jour + heure).
- **Limite assumée** : à Paris, environ la moitié des commerces ont leurs horaires dans OSM (49 % sur 29 630 lieux de 13 types, extrait du 12/10/2026). Les lieux sans horaires ne sont jamais supprimés : ils sont repliés sous la liste (« Afficher les N lieux aux horaires inconnus »).
- Les horaires viennent des tuiles de lieux (`data/places/`), plus d'index séparé.
- La liste d'une catégorie se recharge quand on déplace la carte ; la carte reste sur la zone choisie (fermeture de fiche, bouton Retour, position arrivée tard).
- Détails d'un lieu lus via Overpass (serveur de secours : overpass.openstreetmap.fr), et non plus via l'API d'édition d'OSM.

## Direction (boussole) (13/10/2026)

- Le point bleu porte un faisceau qui montre la direction où l'on regarde (boussole du téléphone ; à défaut, sens de la marche donné par le GPS). Le point suit vos déplacements tant que l'app est à l'écran.
- Bouton de localisation comme Plans et Maps : 1er toucher → centré sur vous et suivi ; 2e → la carte tourne avec vous ; 3e → nord en haut. Déplacer la carte à la main arrête le suivi.
- Sur iPhone, l'accès à la boussole est demandé au premier toucher du bouton. Tout reste sur l'appareil.

## Trajet à pied depuis la sortie conseillée (13/10/2026)

En transports, quand on descend du métro ou du RER, le trajet à pied qui suit part de la **sortie conseillée** (celle d'OSM la plus proche de la destination), plus du centre de la station : un calcul Valhalla supplémentaire pour le trajet choisi. Remarque venue du forum OSM France. Les tracés à pied, à vélo et en voiture suivent désormais exactement les rues (le lissage coupait les angles et faisait traverser des immeubles).

## Devantures : une photo de chaque commerce (13/10/2026)

**Source** : [Panoramax](https://panoramax.fr), l'équivalent libre de Street View. À Paris, la campagne de la **Ville de Paris** (photos 360°, 2024-2025, instance IGN, **Licence Ouverte 2.0**) couvre l'essentiel ; les photos d'autres contributeurs (CC-BY-SA 4.0) servent en second choix, avec leur crédit. Il n'existe aucune autre source ouverte de photos de commerces : Wikimedia n'en couvre que 307 sur 46 000 à Paris.

- `scripts/build_facades.py` (action `facades.yml`, chaque dimanche) : pour chaque lieu, la photo 360° prise à 4–18 m, Licence Ouverte d'abord, puis la plus proche de 9 m et la plus récente ; on note l'identifiant de la photo et le **cap vers le lieu**. Mesuré sur le 6e : 31 000 photos, **75 % des lieux** (82 % des commerces) ont une devanture. Résultat dans `data/facades.json` du site, intégré aux tuiles de lieux chaque nuit (5e élément de chaque lieu).
- **Aucune requête Panoramax à l'usage** : l'app charge seulement l'image choisie (`sd.jpg`, 2048 × 1024, ≈ 230 Ko) et la **recadre à l'affichage** (CSS : secteur de 45° orienté vers le lieu). Plein écran : le panorama entier, ouvert sur le lieu, à faire défiler.
- Où : **vignette posée sur la carte**, en bas à gauche, juste au-dessus de la fiche lieu (comme Plans et Google Maps) ; elle suit la fiche quand on la fait glisser (événement `sheetmove` de `sheet.js`) et disparaît quand la fiche est dépliée. Au toucher : le panorama en plein écran, avec le crédit. Retirées des listes et des pastilles de carte le 13/10 (jugées moches, sans rien dire de l'ambiance), puis de la fiche le 14/10.
- **Limites** : ≈ 230 Ko par photo (des vignettes préparées à l'avance demanderaient un serveur : prévu avec P2) ; le cadrage est automatique, donc parfois la boutique voisine (vérifié sur un échantillon : 3 sur 4 justes) ; `container-type` / `cqw` requis (navigateurs depuis 2023).

## Place laissée à la carte (14/10/2026)

Enquête et mesures : [`docs/espace-ecran.md`](../docs/espace-ecran.md). Appliqué :
- écran itinéraire compact (ci-dessus) ;
- raccourcis de catégories masqués quand une fiche lieu est ouverte ;
- une échelle de tailles unique (`--fs-body`, `--fs-meta`, `--fs-small`, `--gutter` dans `src/lib/ui/base.css`), avec une densité proche de Google Maps : barre de recherche, raccourcis, champs et marges des fiches plus compacts. Les champs de saisie restent à 16 px, sinon Safari zoome au moment de taper ;
- le cadrage de la carte tient compte de la hauteur réelle du haut d'écran et de la fiche, mesurée au lieu de valeurs fixes.

## Fond de carte clair et polices (14/10/2026)

Retours de test : en mode clair on voyait mal les rues, puis le contour gris ajouté « fait cheap ». Comme Plans, mesuré sur ses captures :
- **rues grises pleines à tous les zooms, sans liseré** (`#CBD1D1`) ;
- **îlots crème** (`#F4EFDF`) et bâtiments à peine plus soutenus (`src/lib/mapstyle.js`).

Le mode sombre garde ses couleurs : chaque nouvelle couleur claire a sa traduction sombre d'origine.

**Polices de la carte** :
- **Inter** (SIL Open Font License 1.1) remplace Open Sans. C'est la police libre la plus proche des polices système des téléphones.
- Les noms de rues sont **en capitales espacées** et les quartiers en gras, comme dans Plans.
- Les glyphes sont préparés par `scripts/build_fonts.sh` dans `static/fonts/` (12 Mo, servis avec l'app, rien chez Google). La licence est dans `static/fonts/Inter-OFL.txt`.

## Listes de catégories : comportement (13/10/2026, soir)

Aligné sur Google Maps et Plans : toucher « Restaurants » met les résultats **sur la carte** et ouvre la liste **en aperçu** (une bande en bas), pas en grand. Glisser la liste vers le bas la réduit à cet aperçu **sans désélectionner la catégorie** ; seules la croix et un nouveau toucher du raccourci la ferment. Pendant un itinéraire, les pastilles de la liste **disparaissent** de la carte et reviennent quand on quitte l'itinéraire (`dimPlaces`, couche `cat-hit`). « Mes lieux » garde l'ancien comportement (glisser ferme).

## Sécurité (14/10/2026)

Voir [`SECURITY.md`](../SECURITY.md) :
- politique de sécurité du contenu (`vite.config.js`) ;
- vérification des liens et fichiers reçus (`myplaces.js`, `importgoogle.js`) ;
- liens sortants neutralisés (`links.js`) ;
- actions GitHub verrouillées ;
- audit des dépendances et mises à jour proposées automatiquement (Dependabot).

Les tests de bout en bout échouent si la politique bloque un fournisseur.

## Page « Qui voit quoi » (13/10/2026)

`/confidentialite` : ce que l'app envoie, à qui, et ce que chaque service en fait (politiques vérifiées le 13/10/2026), ce qui ne quitte jamais le téléphone, et ce qui changera avant un lancement public. Liée depuis le message d'accueil et les crédits de la carte. À mettre à jour à chaque changement de service.
