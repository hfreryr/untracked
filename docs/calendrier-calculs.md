# Calendrier des calculs

Les données de l'app (lieux, photos, horaires, recherche) sont préparées à l'avance par des calculs automatiques sur
GitHub (onglet **Actions**), puis publiées sur le site. L'app elle-même (le code) est publiée à part, après chaque
fusion (`bash app/scripts/publish.sh`). Page écrite le 02/11/2026, à la demande du porteur.

## Règle : relancer un calcul est une décision, pas un réflexe

Après chaque fusion, se poser trois questions (porteur, 02/11/2026) :
1. **La fusion change-t-elle les données ?** Seulement l'app (écran, code du téléphone) : publier l'app, aucun calcul.
   Un script de `app/scripts/` ou un calcul de `.github/workflows/` : passer à la question 2.
2. **Quand le calendrier l'appliquera-t-il, et qu'est-ce qu'on perd à attendre ?** Si le calcul tourne dans la nuit, ou
   si le changement n'est utile qu'à une mesure ou un essai plus tard, attendre. Si le porteur doit le voir ou le tester
   avant, ou si un défaut visible reste en ligne pendant ce temps, lancer.
3. **Si on lance : quoi, et quand ?** Seulement les calculs touchés, une fois toutes les fusions liées faites (pas après
   chacune) ; une zone précise plutôt que « toutes » ; jamais pendant qu'un calcul du même groupe tourne déjà.

La décision est dite au porteur avec sa raison (« je lance X parce que… » ou « rien à lancer : Y s'en charge cette nuit »).

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
