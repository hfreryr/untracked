# Incidents

## 06/11/2026 — Données des régions perdues, photos Wikimedia disparues, sans alerte

**Découvert par** le porteur (« il manque des lieux en Charente-Maritime »), puis en cherchant à sa demande. Aucun outil
ne l'avait signalé. Correctifs : #165 à #168 ; protections : #169 (cran de sûreté, échecs visibles, publication
vérifiée), #170 (contrôle quotidien avec signalement), #171 (zones testées de bout en bout, règles, ce document).

### Ce qui s'est passé

| # | Défaut | Depuis | Effet | Pourquoi rien ne l'a signalé |
|---|---|---|---|---|
| 1 | Résultats d'un calcul refusés par gh-pages quand un autre calcul publie entre-temps | ≥ 02/11 | 6 régions calculées puis jetées ; Bourgogne jamais en ligne | échec masqué (`|| echo "rien de nouveau"`), calcul vert |
| 2 | `publish.sh` effaçait `data/wikiphotos.json` | sa création | recherche de photos repartant de zéro | fichier absent de la liste à garder |
| 3 | `--centre -0.5,47` pris pour une option | 01/11 | 5 régions de l'Ouest sans aucun site lu | avertissement jaune, non lu |
| 4 | Wikimedia sert ses vignettes sur `thumb.wikimedia.org` | ≈ 03/11 | 0 photo dans toutes les régions | « 0 avec photos » dans le journal, rien ne s'en alarmait |
| 5 | Demande trop longue (414) | 02/11 | Île-de-France : 0 photo, 0 article ; les bonnes données écrasées | seul le nombre de lieux était contrôlé |
| 6 | Une page mal formée faisait planter la lecture des sites | 05/11 | Auvergne sans sites | comme 3 |
| 7 | Mise en ligne refusée par GitHub Pages | 05/11 | correctifs annoncés « publiés » mais pas en ligne | l'envoi était pris pour la publication |
| 8 | Lieux écartés aux frontières entre régions (app) | 31/10 | Jonzac, Marans | testé en Île-de-France, Lyon, Amsterdam seulement |
| 9 | Fond de carte effacé dans le cadre rectangulaire des régions (app) | 31/10 | Genève, Bâle, Kehl… sans commerces | comme 8 |
| 10 | 14 régions jamais recalculées depuis (conséquence de 1) | 31/10 | carte moins dense, pas de recherche à Lyon et Nantes | aucune mesure de l'âge des données |

### Causes de fond
1. **Échecs silencieux** : `|| echo`, calculs verts, avertissements non lus.
2. **Pas de cran de sûreté** : un calcul raté pouvait remplacer de bonnes données par du vide ; seul le nombre de lieux
   était contrôlé.
3. **Pas de vérification de la production** : âge des données, fichiers présents, champs, version servie.
4. **Services extérieurs non surveillés sur le fond** (Wikimedia, Transitous).
5. **Façon de travailler** : validation sur l'Île-de-France seulement, « envoyé » pris pour « fait », journaux non relus.

### Protections mises en place
- **Cran de sûreté** : mesures par champ dans l'index (`tileio.metrics`), contrôle avant publication champ par champ
  (`check_publish.py`, `check_extras.py`) ; états téléchargés sans jamais repartir de zéro sur une panne
  (`fetch_state.sh`) ; une demande Wikimedia ratée ne remplace plus des photos connues.
- **Échecs visibles** : erreurs en rouge, calcul en échec, résumé par zone.
- **Publication vérifiée** : liste unique des données des calculs (`pages_data.txt`), `wait_live.sh`.
- **Contrôle quotidien** (`health_check.py`, `controle.yml`) : signalement GitHub `controle`, mail au porteur.
- **Tests** : une zone de bout en bout à l'ouest, en Corse, à une frontière (`test_build_zone.py`) ; fichiers de calcul
  lus comme GitHub (`check_workflows.py`) ; frontières dans l'app (`regionborder2.test.js`, `cover.test.js`).
- **Règles** : `CLAUDE.md`, « Fiabilité des données ».

### Ce qui reste fragile
GitHub Actions (calculs lancés avec des heures de retard) et GitHub Pages (mise en ligne parfois refusée) : les
protections limitent les dégâts, pas la cause. Avant un lancement public : une machine à nous, supervisée.
