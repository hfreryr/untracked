# Contribuer à OpenStreetMap depuis Untracked Maps

*Brouillon du 13/10/2026 — à valider par le porteur du projet avant toute publication.*

## 1. Les règles qui s'appliquent (vérifiées le 13/10/2026)

| Règle | Ce qu'elle impose | Nous concerne ? |
|---|---|---|
| [Copyright OSM](https://wiki.openstreetmap.org/wiki/Copyright) | « Do not use data from copyrighted maps or any other proprietary data! » | **Oui, toujours.** Aucune info tirée de Google Maps ne doit entrer dans OSM, même recopiée à la main par un utilisateur. |
| [Organised Editing Guidelines](https://osmfoundation.org/wiki/Organised_Editing_Guidelines) (OSMF, 2018) | Annonce publique au moins 2 semaines avant ; page wiki listée dans *Organised Editing/Activities* ; hashtag dans les commentaires de modification ; plan de vérification des modifs des nouveaux contributeurs. Pas d'autorisation formelle : le silence vaut accord, mais une critique justifiée ignorée peut entraîner l'arrêt et l'annulation. | **Probablement**, dès qu'on *pousse* nos utilisateurs à modifier (micro-questions, campagnes). Le texte ne tranche pas pour les apps ; il dit « en cas de doute, contactez la communauté locale ». On applique donc ces règles. |
| [Automated Edits code of conduct](https://wiki.openstreetmap.org/wiki/Automated_Edits_code_of_conduct) | Pour toute modification faite « sans revue individuelle par la personne qui la contrôle » : page wiki, discussion sur le forum, compte dédié, `mechanical=yes`, démarrage sur un petit nombre. | **Non**, tant que chaque modification est confirmée par une personne. **Oui** si le pipeline écrivait lui-même → on s'interdit ce cas. |
| [Import/Guidelines](https://wiki.openstreetmap.org/wiki/Import/Guidelines) | Processus d'import complet, vérification de licence. | **Non**, on n'importe rien (Overture sert à repérer, pas à écrire). |
| [Politique d'usage de l'API](https://operations.osmfoundation.org/policies/api/) | User-Agent identifiant l'app ; l'API d'édition **n'est pas faite pour la lecture seule** ; discuter avec les administrateurs au préalable. | **Oui.** ⚠️ Aujourd'hui, la fiche lieu *lit* les détails via cette API : à remplacer par une source de lecture. |

## 2. Principes retenus pour Untracked Maps

1. **Une personne confirme chaque modification**, avec son propre compte OSM (connexion OAuth 2.0 depuis l'app, sans serveur).
2. **Le pipeline ne modifie jamais OSM.** Il repère les lieux douteux ; l'app pose la question aux gens qui sont sur place.
3. **Les questions portent sur ce qu'on constate sur place** (« Ce lieu est-il ouvert ? », « Ouvert le dimanche ? »), jamais sur ce qu'on lit ailleurs. L'app rappelle de ne pas recopier Google Maps.
4. **Transparence** : modifications signées `created_by=Untracked Maps <version>` et hashtag `#untrackedmaps` ; page wiki publique ; contact joignable.
5. **Prudence** : démarrage limité au 6e arrondissement, petit nombre de questions, revue des premières modifications avec la communauté.
6. **Opt-out** : un contributeur OSM peut demander qu'on ne pose plus de questions sur un lieu ou un type de donnée.

## 3. Annonce au forum OSM France

**Publiée le 13/10/2026** par le porteur, avec le compte du projet : questions sur ce qu'on voit sur place, modification avec le compte OSM de la personne, à partir du 27/10, 6e arrondissement. Un membre a demandé quelles ressources communautaires l'app utilise (fond de carte, API…) : à lui répondre dans le même fil.

**Complément proposé (02/11/2026), à publier en réponse dans le même fil** — pas une nouvelle annonce ni un nouveau délai de 2 semaines : le cadre annoncé (ce qu'on constate sur place, compte de la personne, confirmation, hashtag) ne change pas, seul le périmètre s'élargit. À réécrire avec ses propres mots.

> Bonjour, un point d'étape sur Untracked Maps. En plus des questions courtes annoncées, la fiche d'un lieu permettra de corriger ce que la personne constate sur place : horaires (écran jour par jour qui produit un `opening_hours` valide), téléphone, site, ou « ce lieu a fermé ». Même cadre qu'annoncé : compte OSM de la personne, écran de confirmation, `created_by=Untracked Maps`, `#untrackedmaps`, rappel de ne rien recopier d'autres cartes, 6e arrondissement d'abord. Aucune modification n'est faite par le compte du projet : chaque modification porte le compte de la personne. Sans compte OSM, l'app proposera une note à l'endroit du lieu, rédigée précisément (« Horaires constatés : … »). Pour répondre à la question posée : [ressources utilisées]. Retours bienvenus ici ou à contact@untrackedmaps.app.

## 4. Page wiki (à créer après le retour du forum)

Titre proposé : `Organised Editing/Activities/Untracked Maps`. Contenu requis par les lignes directrices :
- coordinateur et contact ;
- hashtag `#untrackedmaps` ;
- objectif et raison ;
- calendrier ;
- outils (Untracked Maps, code source) et sources (aucune donnée externe copiée ; Overture sert seulement à choisir les questions) ;
- mesures de réussite : nombre de lieux vérifiés, calculé depuis les données publiques d'OSM ;
- instructions données aux utilisateurs (textes des questions) ;
- plan de vérification des modifications des nouveaux contributeurs ;
- bilan mensuel.

## 5. Étapes

1. ☑ Porteur : créer un compte OSM pour le projet (contact public) — fait le 13/10/2026.
2. ☑ Porteur : relire puis publier le message du forum — publié le 13/10/2026 ; complément du 02/11 à publier dans le même fil.
3. ☑ Attendre au moins 2 semaines et intégrer les retours — délai écoulé le 27/10/2026.
4. ☐ Créer la page wiki.
5. ☐ Enregistrer l'app sur openstreetmap.org (OAuth 2.0, client public).
6. ☐ Coder la modification dans l'app (horaires d'abord, puis téléphone, site, fermeture), les micro-questions (6e arrondissement seulement) et la note rédigée dans l'app.
   En attendant (02/11/2026) : sur téléphone, « Ajouter les horaires » ouvre une note sur le site d'OSM au lieu de l'éditeur pour ordinateur (`osmlinks.js`).
7. ☐ Bilan avec la communauté après le premier mois.
