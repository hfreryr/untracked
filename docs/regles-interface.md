# Règles d'interface (non négociables)

Ces règles reprennent les pratiques standard des interfaces mobiles : Apple Human Interface Guidelines, Material Design, WCAG 2.2 niveau AA et les heuristiques de Nielsen.

Elles s'appliquent à **toute** modification de l'app. Une règle marquée 🔒 est vérifiée par un test : un changement qui la casse ne passe pas.

## Menus, panneaux et fenêtres

1. 🔒 **Un seul menu ouvert à la fois.** En ouvrir un ferme le précédent. Ouvrir une fiche ou une fenêtre ferme le menu ouvert.
2. 🔒 **Toucher en dehors ferme le menu**, sans déclencher ce qui se trouve dessous.
3. 🔒 **Échap et le bouton Retour du téléphone ferment d'abord ce qui est le plus au-dessus** : le menu, puis la fenêtre, puis la fiche.
4. 🔒 **Un menu est toujours entièrement visible.**
   - Il n'est jamais rogné par un bord de l'écran ou par une fiche.
   - Il s'ouvre du côté où il y a la place.
   - S'il est plus haut que la place disponible, il défile.
5. 🔒 **Le bouton qui ouvre un menu indique son état** (`aria-expanded`). Le retoucher ferme le menu.
6. **Le focus entre dans la fenêtre ouverte et revient au bouton à la fermeture.**
7. 🔒 **Une fenêtre modale a un fond assombri, une croix en haut à droite et un titre.** Elle se ferme par la croix, par Échap, en touchant le fond, ou **en la glissant vers le bas** (téléphone).
   - Sur téléphone, toute fenêtre est une fiche qui monte du bas, avec une poignée.
   - Une fiche-fenêtre (choisir une liste, importer, raccourcis, transfert) se ferme d'un seul glissement vers le bas, sans passer par l'aperçu.
   - Les fiches de la carte (lieu, catégorie) passent d'abord par l'aperçu, puis se ferment au glissement suivant. Une liste de catégorie s'arrête à l'aperçu sans se fermer : c'est une décision issue des tests utilisateurs.
   - Les visionneuses de photos se ferment aussi en glissant vers le bas.
8. **Une seule fiche à la fois en bas d'écran.** On la glisse vers le bas pour la réduire ou la fermer, et sa croix est toujours au même endroit.

**Comment l'appliquer dans le code :**
- tout menu ou panneau flottant passe par `use:popover` (`app/src/lib/popover.js`), qui applique les règles 1 à 5 ;
- toute fenêtre passe par `Dialog.svelte` (règles 6 et 7, glissement par `swipeclose.js`) ; une fiche-fenêtre par `use:draggable={{ …, modal: true }}` ;
- un nouveau menu est ajouté au test e2e « règles d'interface ».

## Contenu visible

9. **Toutes les options d'un choix sont visibles.**
   - S'il y en a trop pour la largeur, la dernière est coupée par le bord de l'écran, pour montrer qu'on peut faire défiler.
   - Une option n'est jamais cachée derrière un menu sans indice visible.
10. **Rien ne reste caché sous un élément flottant.** Une barre flottante laisse un espace en fin de fiche, pour que tout le contenu puisse remonter au-dessus d'elle.
11. **Texte court.** Une information tient sur une ligne ; le détail va dans une fenêtre ouverte par un bouton (i). Un texte coupé (…) a toujours son texte complet accessible.
12. **Aucun texte affiché en anglais ni en code brut.** Pas de valeur OSM comme « georgian » ou « fast_food ». Une valeur sans traduction n'est pas affichée.

## Toucher et lisibilité

13. 🔒 **Zone tactile d'au moins 24 × 24 px** (WCAG 2.2 AA), et **44 × 44 px visés** (Apple). Un petit bouton agrandit sa zone avec `::after`.
14. 🔒 **Contraste d'au moins 4,5:1** pour le texte, en thème clair comme en sombre (WCAG AA).
15. 🔒 **Chaque bouton a un nom** : un texte visible ou un `aria-label`.
16. **Les tailles suivent celles des cartes de référence.**
    - Point de position : 18 px.
    - Textes : 15 px pour le corps, 13,5 px pour les informations secondaires.
    - Champs de saisie : 16 px, en dessous Safari zoome au moment de taper.

## Retour et prudence

17. **Chaque action a un retour visible** (message, changement d'état) en moins d'une seconde. Une attente montre qu'elle charge.
18. **Une action qui retire ou efface peut être annulée** (« Annuler » dans le message), ou demande confirmation si elle est définitive.
19. **Un écran vide explique pourquoi** et propose quoi faire.
20. **Les animations respectent « réduire les animations »** du téléphone.

## Cohérence

21. **Un même geste fait la même chose partout.** Les boutons ronds de la carte ont tous la même taille (48 px). Croix en haut à droite, glisser vers le bas, bouton principal bleu plein.
22. **Inspiré des cartes de référence (Google Maps, Plans, Citymapper), jamais copié** : ni icônes, ni logos, ni éléments propres à ces apps.

## Tests qui font respecter ces règles

- `npm run e2e`, test « règles d'interface » :
  - menu ⋯ d'une fiche, menu des cartes, fenêtre « À propos » (bouton ⓘ) et choix de l'heure d'un trajet ;
  - petit écran (375 × 667) ;
  - chaque menu est vérifié entier et non masqué, puis fermé en touchant ailleurs (sans effet dessous) et par Échap.
- `npm run e2e`, test « glisser vers le bas ferme les fenêtres » (règle 7).
- `npm run e2e`, test « accessibilité » : axe-core, WCAG 2.2 AA, sur 8 écrans, en clair et en sombre (règles 13 à 15).
- `npm test`, `popover.test.js` : placement des menus (règle 4).
- `npm test`, `textes.test.js` : aucun texte écrit en dur (règle 12, en partie).
