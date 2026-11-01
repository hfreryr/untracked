# Instructions pour Claude Code

## Avec qui tu travailles
**Le porteur du projet**, product designer et chef de projet, **non développeur**. Il pilote seul pour l'instant.
- Explique simplement ce que tu fais, sans jargon, et dis-lui comment vérifier le résultat.
- Avant toute tâche non triviale, propose un plan court et attends sa validation.
- Une tâche = une branche = une proposition de changement qu'il valide.
- Réponds en français.

## Le projet
Rendre les cartes libres basées sur OpenStreetMap (OSM) aussi fiables et agréables que Google Maps. Deux chantiers :

1. **`app/`** (SvelteKit statique + MapLibre) — notre propre app web grand public, concurrente de Google Maps, branchée sur des moteurs libres existants (OpenFreeMap, Photon, puis Valhalla et Transitous). Public : le grand public inquiet de sa dépendance aux GAFAM, celui qui a déjà choisi Signal, Proton ou Brave (pas les militants du libre). Objectif à terme : transmettre le produit à un acteur de ce type (intégration dans une suite), pas le gérer sur le long terme. Promesse : aussi bien que Google Maps, sans vous pister.
2. **`pipeline/`** (Python) — détecter les lieux OSM obsolètes (commerces fermés) en confrontant OSM à Overture Maps via DuckDB. Constat : `operating_status` d'Overture est quasi vide à Paris ; on s'appuie sur le score d'existence et l'absence.

Ville pilote : **Paris** (pipeline : 6e arrondissement).
Nom : **Untracked** (marque) / **Untracked Maps** (nom de l'app). Choisi le 12/10/2026 : seul finaliste sans marque déposée en classes 9, 38, 42 (TMview + USPTO). Écartés pour conflit de marque : Traceless, Trackless, Untraced. Dépôt GitHub à renommer `untracked`.
Ne jamais se présenter comme lié à CoMaps ou à Cartes.app.

Voir `README.md` pour la feuille de route.

## Règles non négociables
- **Écrire dans OSM uniquement via le compte de l'utilisateur**, chaque modification confirmée par une personne, et seulement après annonce à la communauté OSM (forum France, au moins 2 semaines avant, Organised Editing Guidelines). Voir `docs/contribution-osm.md`.
- **Jamais de modification automatique ni d'import** (bot, pipeline) sans le processus officiel (Automated Edits code of conduct, Import guidelines) et l'accord explicite du porteur du projet.
- **Ne jamais faire entrer dans OSM une info venant de Google Maps** (ni par nous, ni en le suggérant aux utilisateurs) : interdit par le copyright d'OSM.
- **Ne pas utiliser l'API d'édition d'OSM pour lire** des données (politique d'usage de l'API).
- **Google Maps** : l'app ne doit jamais en dépendre. On peut s'en servir pour construire et challenger l'app (relevés, comparaisons), mais rien de ce qui en vient ne doit être publié dans l'app ni envoyé dans OSM.
- **Aucune source seule ne suffit** à déclarer un lieu fermé : toujours garder la trace des signaux utilisés et leur niveau de confiance.
- **SIRENE** n'est qu'un générateur de candidats : délai pouvant atteindre 18 mois.
- **Pas de dépendance propriétaire** ni de service centralisé payant. Hébergement statique dès que possible.
- **Zéro pistage** : aucune donnée personnelle collectée par nous, pas d'analytics. Les fournisseurs tiers (tuiles, recherche, itinéraires) reçoivent IP et requêtes : ils sont documentés dans une page « Qui voit quoi », et remplacés par nos propres serveurs sans journaux d'IP avant tout lancement public. Exception décidée par le porteur (01/11/2026) : la photo publiée par le site d'un lieu est chargée depuis ce site (IP visible du site, sans traceur ; voir `docs/photos-lieux.md`). Jamais de service dont la licence ou les conditions interdisent l'usage commercial sans l'avoir noté (Transitous, Maptoolkit, FOSSGIS : pas de site à fort trafic, 1 demande par seconde).
- **Données préparées à l'avance, adressées par tuile**, avec une URL de base configurable ; jamais de service tiers interrogé lieu par lieu (Overpass interdit). Fournisseurs derrière des interfaces uniques (`search`, `details`, `route`) ; tout ce qui est parisien dans un profil de ville.
- **Licences** : code AGPL-3.0, données ODbL, documentation CC-BY-SA 4.0. Vérifier la compatibilité de licence de toute nouvelle source de données avant de l'utiliser.

## Pratiques techniques
- Données brutes dans `data/` (ignoré par Git). Ne jamais enregistrer de gros fichiers dans le dépôt.
- Scripts reproductibles : une seule commande documentée pour tout relancer.
- Ajouter des tests pour la logique de comparaison.
- **App : toute nouvelle fonction va dans son propre fichier** (`app/src/lib/ui/` pour l'écran, `app/src/lib/` pour la logique), jamais dans `app/src/routes/+page.svelte`, qui ne doit plus grossir.
- **État de l'écran** : les composants et modules le lisent par `getContext('app')` ; un nom ajouté doit figurer dans le bloc `// <app>` de `+page.svelte` (avec un `set` s'il est modifié). `npm run check` le vérifie.
- **Toute nouvelle fonction arrive avec son test** (unitaire `node --test` ou de bout en bout `npm run e2e`).
- **Tout texte affiché passe par le fichier de textes** `app/src/lib/i18n/fr.js`, appelé par `tx('clé')` (accords : entrée sous forme de fonction avec `pluriel`). Un test échoue si un texte est écrit en dur.
- Avant de publier un changement visible, comparer les captures avant/après (`app/tests/visual/`), puis publier avec `bash app/scripts/publish.sh` uniquement (jamais à la main : il préserve les données des actions automatiques).
- Plan de travail en cours : `docs/plan-nettoyage.md` (cocher les cases au fur et à mesure).
- Garder le `README.md` à jour à chaque étape franchie.
- Préférer les outils simples et répandus (Python, DuckDB, MapLibre) à des choix exotiques.
- LLM local de 7-8B si un jour nécessaire (extraction d'horaires) ; le vrai goulot sera Playwright, pas le modèle.

## Design
- Références visuelles : Google Maps et Plans d'Apple (sobriété, carte calme, lieux colorés par famille). S'en inspirer, ne jamais copier leurs icônes, logos ou éléments propres.
- Police système du téléphone pour l'interface ; sur la carte, Inter (libre, la plus proche des polices système), servie avec l'app. Aucune ressource chargée chez Google (pas de Google Fonts).
- **Règles d'interface : `docs/regles-interface.md`, à respecter à chaque modification, sans exception.**
  - Un seul menu ouvert, fermé en touchant ailleurs ou par Échap, toujours entier à l'écran : tout menu passe par `use:popover`, toute fenêtre par `Dialog.svelte`.
  - Rien de caché sous un élément flottant ; texte court, avec le détail derrière un bouton (i) ; aucune valeur en anglais.
  - Tout nouveau menu est ajouté au test e2e « règles d'interface ».
- **Accessibilité : WCAG 2.2 niveau AA** (texte contrasté à 4,5:1 au moins, chaque bouton nommé). Le test e2e « accessibilité » (axe-core) bloque les régressions ; il ne remplace pas un essai au clavier et avec VoiceOver.
- Test du couloir : quelqu'un qui n'a jamais entendu parler d'OSM doit comprendre en 5 secondes.
- La frugalité n'excuse jamais une expérience médiocre.
