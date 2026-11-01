# Photos d'ambiance des lieux : ce que dit le droit, ce que font Google Maps et Plans

Recherche du 13/10/2026. Légende : ✅ vérifié dans la source citée · 🔶 notre interprétation, à faire valider par un juriste · ❓ non vérifié.
Nous ne sommes pas juristes : ce document sert à préparer la question, pas à y répondre à la place d'un avocat.

## 1. Le droit

### Le principe : une photo en ligne n'est pas libre
- ✅ **CPI, art. L.122-4** : « Toute représentation ou reproduction intégrale ou partielle faite sans le consentement de l'auteur ou de ses ayants droit » (ou ayants cause) est illicite. [Légifrance](https://www.legifrance.gouv.fr/codes/id/LEGIARTI000006278910/2006-08-03)
- ✅ **CPI, art. L.131-3** : « La transmission des droits de l'auteur est subordonnée à la condition que chacun des droits cédés fasse l'objet d'une mention distincte », avec l'étendue, la destination, le lieu et la durée. → Un accord doit être **écrit et précis**. [Texte](https://marche-public.fr/Marches-publics/Textes/Codes/CPI/CPI_article_131_3.htm)

### Copier une photo d'un site sur le nôtre : interdit sans accord
- ✅ **CJUE, Renckhoff, C-161/17, 7 août 2018**, dispositif : la communication au public « couvre la mise en ligne sur un site Internet d'une photographie préalablement publiée, sans mesure de restriction empêchant son téléchargement et avec l'autorisation du titulaire du droit d'auteur, sur un autre site Internet ».
- ✅ Raison (points 29-31, 44) : avec une copie, l'auteur perd la maîtrise ; s'il retire la photo de son site, elle reste sur l'autre. Avec un lien, il la garde. [Arrêt](https://www.droit-technologie.org/wp-content/uploads/2018/08/CURIA-Documents.pdf)
- → Stocker l'image d'un commerçant (ou une vignette) sur nos serveurs sans son accord = nouvelle communication au public non autorisée.

### Afficher l'image depuis le site du commerçant (sans la copier)
- ✅ **CJUE, VG Bild-Kunst, C-392/19, 9 mars 2021** : si l'œuvre est librement accessible sur le site d'origine, sans mesure restrictive, la transclusion ne vise pas un public nouveau ; le titulaire ne peut limiter son consentement « autrement qu'au moyen de mesures techniques efficaces ». La réduction en vignette ne change rien à la qualification. [Communiqué CJUE](https://curia.europa.eu/jcms/upload/docs/application/pdf/2021-03/cp210036fr.pdf) · [Analyse](https://www.medialaws.eu/rivista/the-cjeus-take-on-unauthorized-framing-of-online-content-only-if-technologically-precluded-then-prohibited/)
- 🔶 L'affaire porte sur la transclusion par cadre (« framing ») ; qu'une image chargée directement depuis le serveur du commerçant (« hotlink ») relève du même régime est notre lecture, à faire confirmer.
- ✅ **Bloquant pour nous, indépendamment du droit** : chaque affichage ferait envoyer l'adresse IP de l'utilisateur au serveur du commerçant. C'est contraire à notre règle « jamais de service tiers interrogé lieu par lieu » (CLAUDE.md) et à la promesse « sans vous pister ».

### L'image de partage (`og:image`)
- ✅ La spécification Open Graph la définit comme « An image URL which should represent your object within the graph » et **ne dit rien de licence ni d'autorisation** (vérifié sur [ogp.me](https://ogp.me/) : aucune occurrence de « license », « copyright », « permission »).
- ✅ Le précédent le plus proche est **allemand** : BGH, *Vorschaubilder I* (2010) a admis un « consentement implicite » aux vignettes d'un moteur de recherche quand l'image est en ligne sans blocage ; *Vorschaubilder II* (2011) a confirmé par un autre raisonnement. [Analyse](https://legalblogs.wolterskluwer.com/copyright-blog/vorschaubilder-ii-the-second-case-on-image-search-thumbnails/)
- ✅ Ces décisions sont antérieures à Renckhoff (2018), et nous n'avons trouvé **aucune décision française ou européenne** validant la reprise d'une `og:image`.
- → On ne peut pas s'appuyer sur `og:image` pour copier l'image.

### Analyser les sites (sans republier) : permis
- ✅ **Directive 2019/790, art. 4** (transposé à l'art. L.122-5-3 CPI) : la fouille de textes et de données autorise des **reproductions et extractions** d'œuvres accessibles de manière licite, sauf opposition du titulaire « par des procédés lisibles par machine ». Elle ne couvre que la reproduction et l'extraction, **pas la communication au public**. [Texte](https://www.legislation.gov.uk/eudr/2019/790/article/4)
- → Lire un site pour en extraire des horaires ou vérifier qu'un lieu existe : oui. Republier ses photos : non.

### Instagram
- ✅ Collecte automatique : « Unauthorized scraping involves automation to collect information in violation of our Terms of Service. » [Aide Instagram](https://help.instagram.com/740480200552298)
- ✅ Voie officielle : l'intégration oEmbed.
  - La documentation demande une validation de l'application par Meta (App Review) et un jeton. Meta annonce le 15/06/2026 un accès **sans jeton**. Les deux sources se contredisent, à revérifier au moment de l'utiliser. [Doc](https://developers.facebook.com/docs/instagram/oembed) · [Annonce](https://developers.facebook.com/blog/post/2026/06/15/tokenless-access-to-meta-oembed-apis/)
  - L'intégration repose sur le script `embed.js` de Meta. Sans le script, on peut afficher la miniature (`thumbnail_url`), avec attribution obligatoire : auteur, Instagram et lien vers la publication.
  - Elle fonctionne **par publication**, pas par profil.
- → **Légal mais exclu par nos règles** : les images et le script viennent des serveurs de Meta, qui voit l'adresse IP de chaque utilisateur. Et il faudrait connaître l'adresse de chaque publication.

## 2. Ce que font Google Maps et Plans (vérifié)

### Google Maps
- ✅ **Photos du propriétaire**, avec une fiche d'établissement validée : « For your photos and videos to show on your Business Profile, your business must be verified. » [Aide](https://support.google.com/business/answer/6123536?hl=en)
- ✅ **Photos des clients** : le propriétaire ne peut pas empêcher les clients de publier des photos, seulement signaler celles qui enfreignent les règles. [Aide](https://support.google.com/business/answer/9867764?hl=en)
- ✅ La photo de couverture est choisie par le propriétaire, mais Google peut lui préférer une photo d'utilisateur. [Aide](https://support.google.com/business/answer/6103862?hl=en)
- ✅ Le règlement des contributions interdit les « copied or stolen photos ». [Règlement](https://support.google.com/contributionpolicy/answer/7422880?hl=en)
- ✅ Licence accordée à Google par les conditions d'utilisation (version du 31/03/2020) : mondiale, non exclusive, gratuite, sous-licenciable aux sous-traitants. [CGU](https://policies.google.com/terms/archive/20200331)
- ✅ Aucune page consultée ne mentionne de photos récupérées sur le web.

### Plans d'Apple
- ✅ **Photos de l'établissement** via Apple Business Connect : photo de couverture, logo, album « From the Business ». Les photos sont vérifiées par Apple ; la photo de couverture doit être une seule photo, sans retouche, texte promotionnel ni filigrane. [Aide](https://support.apple.com/guide/business/abcb7557e4c4/web)
- ✅ **Photos des utilisateurs** (« Notes et photos ») : en France depuis le 28/04/2023 (iOS 16.4.1). [iPhoneSoft](https://iphonesoft.fr/2023/04/28/apple-plans-france-active-notes-photos-lieux)
  - L'utilisateur garde ses droits mais accorde à Apple et à ses partenaires une licence mondiale et gratuite.
  - L'utilisateur doit détenir les droits : « You own or have all necessary rights and permissions in the Submission. » [Conditions](https://www.apple.com/legal/internet-services/maps/ratings-photos/en/terms.html)
- ✅ **Partenaires** aux États-Unis : Yelp, TripAdvisor, Foursquare, plus quelques images Getty. [9to5Mac, 26/07/2024](https://9to5mac.com/2024/07/26/apple-maps-reviews-photos-yelp/)
- ✅ En France, la fiche affiche les avis TheFork, TripAdvisor et Yelp. [iPhoneSoft, 2023](https://iphonesoft.fr/2023/04/28/apple-plans-france-active-notes-photos-lieux)
- ❓ Nous n'avons pas trouvé quels partenaires fournissent les **photos** en France.

### Conclusion vérifiée
Dans les sources consultées, ni Google ni Apple ne prend de photos sur les sites des commerces. **Toutes leurs photos sont sous licence**, et viennent de trois sources :
- le propriétaire ;
- l'utilisateur, via les conditions d'utilisation ;
- un partenaire sous contrat (cas d'Apple).

## 3. Ce qu'on peut faire

| Voie | Droit | Nos règles | Verdict |
|---|---|---|---|
| Copier les photos ou l'`og:image` des sites sur nos serveurs | ❌ Renckhoff | — | Non, sans accord |
| Afficher l'image depuis le site du commerçant | 🔶 Probablement licite (VG Bild-Kunst) | ❌ L'IP de l'utilisateur part chez des tiers | Non |
| Instagram via oEmbed | ✅ Voie officielle Meta | ❌ Meta voit chaque utilisateur | Non |
| Instagram par collecte automatique | ❌ Conditions d'Instagram | — | Non |
| **Accord écrit du commerçant** (licence, art. L.131-3) | ✅ | ✅ | **Oui** |
| **Photos des utilisateurs** sous licence (modèle Google/Apple) | ✅ | ✅ (serveur sans journaux) | **Oui, avec P2** |
| Le commerçant publie lui-même sous licence libre (Panoramax, Wikimedia Commons) | ✅ | ✅ | Oui, et la photo devient un commun |
| Analyser les sites sans republier (horaires, existence) | ✅ Fouille de données, sauf opposition | ✅ | Oui |

Point d'attention 🔶 : le commerçant n'est pas toujours titulaire des droits sur ses photos (photographe professionnel). La licence doit donc contenir une garantie que le commerçant détient bien ces droits. C'est ce que font les conditions d'Apple et de Google.

## 4. Questions à poser à un juriste
1. Afficher une image chargée directement depuis le serveur d'un tiers, est-ce une « transclusion » au sens de VG Bild-Kunst ? *(utile seulement si nos règles changent)*
2. Un modèle de licence commerçant conforme à L.131-3 : étendue, destination (l'app et ses repreneurs), durée, territoire, garantie de titularité, retrait.
3. Pouvons-nous accepter une licence libre (CC BY-SA, Licence Ouverte) déclarée par le commerçant via un simple formulaire, ou faut-il une preuve d'identité ?

## 5. Décision du 01/11/2026 : la photo publiée par le site du lieu, affichée depuis son site

- **Décision du porteur** : afficher sans clic l'image que le site d'un restaurant ou d'un commerce publie pour se présenter
  (`og:image`, schema.org `image`), en la chargeant **depuis son site**, jamais copiée chez nous (VG Bild-Kunst ; Renckhoff
  interdit la copie). Acceptable « même à long terme », expliqué dans « Qui voit quoi ».
- **Ce que voit le site** : l'IP, le type d'appareil et de navigateur, la langue, l'heure, et « untrackedmaps.app ». Pas de nom,
  pas de compte, pas de traceur. L'IP est une donnée personnelle (CJUE, Breyer, 2016) : d'où la ligne dans « Qui voit quoi ».
- **Garde-fous** (`build_sitehours.py`, chaque semaine, avec les horaires) : on ne garde que l'adresse de l'image ; robots.txt
  respecté ; logos, petites images et bandeaux écartés ; image refusée si elle dépose un cookie ; refusée si le site ne la
  laisse pas afficher depuis untrackedmaps.app (l'app s'annonce, on ne contourne pas un refus).
- **Mesure** (120 restaurants, cafés, bars du centre de Paris dont le site est connu) : 47 images utilisables, 29 d'au moins
  800 px ; sur 44 images, 1 dépose un cookie (écartée), 1 refuse l'affichage ailleurs (respecté). Site connu pour 53 % des
  lieux de ce type au centre de Paris (OSM + compléments) : ≈ 20 à 30 % de ces lieux auraient une photo.
- **Écartés** : Google (iframe gratuite mais sans galerie, traceurs soumis à consentement, règle du projet), Instagram et
  Facebook (traceurs : consentement obligatoire, donc un clic), Tripadvisor (contrat payant, photos non stockables,
  interdiction à côté d'autres avis), relais par notre serveur (zone grise juridique ; décision : inutile).
- **À venir** : photos des avis Mangrove (licence à vérifier), devantures Panoramax dans toutes les régions, « ajouter une
  photo » avec un avis.

## 6. Bandeau de photos et photos des avis (01/11/2026)

- **Bandeau sous l'en-tête de la fiche**, comme Plans (capture du porteur) : toutes les photos du lieu, deux grandes
  vignettes visibles, la source écrite sur chacune, plein écran au toucher (`placephotos.js`, `PhotoStrip.svelte`).
  Un commerce montre d'abord ses propres photos (avis, site), un monument d'abord Wikimedia.
- **Photos des avis Mangrove** : licence CC BY 4.0 (conditions de Mangrove : le contenu soumis, texte ou non, est placé
  sous CC BY 4.0, vérifié le 01/11/2026). Copiées chaque nuit chez nous en deux tailles (480 et 1 400 px), recompressées
  (métadonnées effacées) : `review_photos.py`. Le téléphone ne contacte pas Mangrove pour les voir. Auteur (pseudo) affiché.
- **« Ajouter une photo » dans la fenêtre d'avis** : réduite à 1 600 px et recompressée sur le téléphone (la position GPS de
  la prise de vue et le modèle de l'appareil disparaissent), envoyée à Mangrove (upload.mangrove.reviews) seulement en
  publiant, jointe à l'avis signé. Consigne affichée : publique, licence libre, sans visages.
- **IP de l'auteur vue par Mangrove** à l'envoi (comme pour le texte de l'avis). La masquer demanderait un relais par
  notre serveur : prévu avec nos propres serveurs sans journaux, avant tout lancement public (règle « zéro pistage »).
