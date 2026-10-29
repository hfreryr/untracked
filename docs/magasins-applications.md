# Magasins d'applications : Google Play et App Store

**Statut : question ouverte** (décision du porteur, 28/10/2026 : « on fera ça plus tard »).

Pourquoi la question : « ah mais c'est seulement sur internet ? Je ne l'utiliserai pas si ce n'est pas une app » est la
première remarque de beaucoup d'utilisateurs. Réponse déjà en place : installation depuis le site, proposée dès la
première ouverture et par un bouton permanent (PR #81). Les magasins seraient un canal de distribution en plus, pas une
dépendance technique : l'app marche sans eux.

## Google Play : faisable

- Notre app web emballée telle quelle (Trusted Web Activity), avec l'outil officiel Bubblewrap ; une mise à jour du site
  met l'app à jour, sans repasser par le magasin ([guide Chrome](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)).
- Prouver que le site est à nous : fichier `.well-known/assetlinks.json` sur untrackedmaps.app, accordé à la clé de signature.
- Coût : 25 $, une seule fois ([aide Google](https://support.google.com/googleplay/android-developer/answer/6112435)).
- Obstacle : compte **personnel** créé après le 13/11/2023 → 12 testeurs inscrits pendant 14 jours d'affilée avant la
  publication pour tous ([détail, 2026](https://primetestlab.com/blog/google-play-changed-20-to-12-testers)). Compte
  **d'organisation** (une association) : hors du champ de cette règle, sans exemption écrite ; papiers d'entreprise
  demandés (numéro D-U-N-S, non vérifié).
- Effort estimé : 1 à 2 jours, plus les 14 jours de test.

## App Store : risqué

- 99 $ par an (chiffre connu, non reconfirmé sur le site d'Apple) ; exonérations possibles pour certaines associations
  ([Apple](https://developer.apple.com/help/account/membership/fee-waivers)).
- Règle 4.2 : « plus qu'un site web reconditionné ». Une app web emballée est souvent refusée
  ([analyse d'un vendeur, partiale](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper/)) ;
  passer demanderait des fonctions propres à l'iPhone (notifications, partage natif…), donc un projet iOS à maintenir.
- Effort estimé : plusieurs semaines, sans garantie.

## Ce que seule une app des magasins permettrait (29/10/2026)

- **Guidage en haut de l'écran** pendant un itinéraire, comme Plans et Google Maps : « Activités en direct » (Dynamic
  Island) sur iPhone, réservées aux apps écrites avec les outils d'Apple ; notification de guidage sur Android, qu'une
  app web ne peut pas tenir à jour une fois quittée (suivi de la position mis en pause). Constat, non contredit par nos
  recherches ; pas de source officielle l'énonçant mot pour mot.

## Recommandation (28/10/2026)

1. Google Play plus tard, avec un compte d'organisation (structure porteuse du projet).
2. App Store : non pour l'instant.
3. D'ici là : noter dans les retours utilisateurs combien installent depuis le site, et si le blocage « pas dans
   l'App Store » revient malgré le bouton.
