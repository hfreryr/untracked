# Calendrier des calculs

Les données de l'app (lieux, photos, horaires, recherche) sont préparées à l'avance par des calculs automatiques sur
GitHub (onglet **Actions**), puis publiées sur le site. L'app elle-même (le code) est publiée à part, après chaque
fusion (`bash app/scripts/publish.sh`). Page écrite le 02/11/2026, à la demande du porteur.

## Règle

Après une fusion : on publie l'app, **on ne relance rien à la main**. Les données suivent ce calendrier. Un lancement à
la main n'a lieu que si un changement doit être visible dès le lendemain ; dans ce cas, un seul calcul est indiqué
au porteur, avec la raison.

## Le calendrier (heure de Paris en hiver ; une heure de plus en été)

| Calcul (nom dans Actions) | Quand | Ce qu'il fait | Ce qui le suit |
|---|---|---|---|
| **Devantures Panoramax (hebdo)** | dimanche, 4 h 20 | une photo de rue par lieu (Panoramax) | **Lieux par tuile** dès la fin |
| **Compléments des lieux (hebdo)** | lundi, 4 h 40 | Île-de-France : ce qu'OSM n'a pas (Overture, enseignes, annuaire), horaires et photo publiés par les sites (4 000 sites par semaine), photos Wikimedia | **Lieux par tuile** dès la fin |
| **Lieux par tuile (nuit)** | chaque nuit, 3 h 45 (secours à 6 h 15), et après les deux précédents | Île-de-France : assemble OSM, compléments, devantures et avis dans les données de l'app ; carte, recherche, vélo | publication des données |
| **Lieux des régions et autres villes (hebdomadaire)** | chaque nuit, 4 h 35, les zones du jour (chaque zone a son jour) | pour ces zones, tout d'un coup : compléments, sites (4 000 par semaine), photos Wikimedia, lieux, recherche ; puis l'annuaire national | publication des données |
| **Sonde des services** | toutes les 15 min | vérifie que les services utilisés répondent | — |

Deux calculs du même groupe (les lieux d'Île-de-France et ceux des régions) ne tournent jamais en même temps :
le second attend la fin du premier.

## Lancements à la main utiles

- **Compléments des lieux**, champ « Sites à lire » : rattrapage des sites (ex. 16 000), une fois ; les lieux suivent seuls.
- **Lieux des régions**, champ « Ville » : une seule zone (ex. `bretagne`) ; champ « Sites à lire » pour son rattrapage.
  Éviter « toutes » : plusieurs heures, et cela bloque le calcul de l'Île-de-France.
