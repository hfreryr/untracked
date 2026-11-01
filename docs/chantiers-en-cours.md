# Chantiers en cours

Liste tenue à jour à chaque étape, pour ne rien perdre entre les sujets menés en parallèle (demande du porteur,
31/10/2026). Une ligne par sujet : où on en est, et la prochaine action.

## À fusionner
| PR | Sujet | Après fusion |
|---|---|---|
| (cette PR) | Carte plus dense (comme Plans) : échelle corrigée, tous les lieux visibles de près | Publier ; les zones se recalculent au fil de la semaine |
| #129 | Bandeau de photos sous l'en-tête, photos des avis, « Ajouter une photo » (contient #127) | Publier ; photos des avis à la nuit suivante |
| #129 | Photo publiée par le site des restaurants et commerces, affichée depuis leur site | Lancer `extras.yml` (Île-de-France), puis la nuit suivante les tuiles la portent |
| #122 | Import Google par l'annuaire national et l'adresse (Photon en dernier recours) | Publier |

## Décisions attendues du porteur
| Sujet | Question posée | Où regarder |
|---|---|---|

## En cours (tourne seul)
- **Index de recherche des 13 régions qui n'en ont pas** (pour l'annuaire national) : recalcul lancé le 01/11, une
  région après l'autre, PACA d'abord (≈ 4 h).

## Chantiers ouverts
### Classement des lieux sur la carte
- 01/11 : rang dans le quartier (#121, fusionnée, `docs/villes.md`) ; appliqué à chaque zone à son prochain calcul : Île-de-France la nuit suivante, régions au fil de la semaine (toutes au 08/11) : Rijksmuseum dès le zoom 14, même nombre de bons lieux
  avec 18 % d'étiquettes en moins.
- 01/11 : carte trop vide à Amsterdam (porteur) → échelle corrigée (×2), tous les lieux visibles dès le zoom 16,5 (cette PR).
- Reste : la notoriété (« Marché Saint-Germain » devant l'église ; Plans privilégie les enseignes connues) ; les restaurants réputés.

### Recherche : la bonne réponse où que l'on soit (règle du porteur, 31/10)
Règle : la réponse pertinente d'abord, quelle que soit la distance ; la proximité ne départage que l'ambigu.
Mesure : `node app/tests/search/grid.mjs` (6 points de départ × 27 recherches, voir `docs/recherche.md`).
1. ✅ **Index par région et Amsterdam** (#116, fusionnée).
2. ✅ **Adresses et rues** (#117, fusionnée, publiée le 01/11) : 71 % → 95 % de bonnes réponses en premier.
3. ✅ **Annuaire national des lieux** (#118, fusionnée, publiée le 01/11) : ≈ 90 000 lieux, 6,7 Mo, découpé par début de mot. Photon coupé, lieux
   7/54 → 42/54. Complet quand les 13 régions calculées avant #116 auront leur index (au plus tard le 07/11, calcul
   hebdomadaire). « gare de rennes » réglé. Restent : « musée Jean Cocteau Menton » (commune absente du nom),
   « Puy de Dôme » (sommets absents de nos lieux).
4. 🔧 **Import Google** par l’annuaire (#122) : lieux sûrs 44 → 63 sur un vrai export, 142 → 100 s.
- Limite connue : une rue française cherchée depuis l'étranger reste confiée à Photon.
- Avant tout lancement public : notre propre Photon (règle « zéro pistage »).

### Récompenses (#119, fusionnée et publiée le 01/11)
- Badges (Gourmet 10 restaurants, Explorateur 5 villes, Du quartier 5 avis dans un même quartier, Culture, Pause café,
  Oiseau de nuit : 5 chacun), carte de mes avis, couleur du point « vous êtes ici » (et de la flèche du guidage).
- Annonce (niveau ou badge) seulement juste après l'avis qui la donne ; sinon « Nouveau » sur Mes contributions
  (retour du porteur : pop-up surgi en ouvrant une fiche sans rapport).
- Avis d'avant le 01/11 : position et genre retrouvés dans notre index de recherche autour de soi, ou en rouvrant leur
  fiche. Limite : un avis loin d'ici, sur un lieu peu connu, n'apparaît qu'après avoir rouvert sa fiche.
- Écartée : « vos avis ont été lus N fois » (demanderait de compter les lectures).

### Villes européennes (mises en pause le 31/10, la France d'abord)
- Londres, Madrid, Rome, Bruxelles ; avant : formats de téléphone et d'adresse de tous les pays (`phonenumbers`).

### Petits défauts connus
- `tests/search/eval.mjs` lit encore les tuiles de lieux à l'ancien format (non compressé) : à remettre à jour.
- Codes postaux néerlandais tels que saisis dans OSM (« 1016GC » au lieu de « 1016 GC »).
- Lieux connus seulement d'Overture (ex. « Kek! Pop-up ») non affichés : la moitié sont des doublons de noms.
- Tests de bout en bout en échec aussi sur main : vue de la rue, compléments hors OSM, sortie conseillée
  (données locales) ; info trafic (contraste de `.badge` signalé par axe — **vrai défaut d'accessibilité à corriger**) ;
  autres passages et station de métro (services en temps réel, instables).
- Import Google : beaucoup de lieux « position à vérifier » quand le nom Google diffère du nom OSM.

### Photos des lieux (01/11)
- Décision : photo du site du lieu, affichée depuis son site, sans clic (cette PR) ; Île-de-France d'abord (relevé avec les
  horaires, `extras.yml`), régions ensuite.
- Bandeau de photos sous l'en-tête (comme Plans), photos des avis Mangrove copiées chez nous (CC BY 4.0 vérifiée),
  « Ajouter une photo » à un avis (cette PR, qui contient #127).
- Ensuite : devantures Panoramax dans les régions ; relais sans journaux pour masquer l'IP à Mangrove (avec nos serveurs).

### Marque
- INPI : marque verbale « Untracked », classes 9, 38, 42 ; avis d'un conseil en propriété industrielle recommandé
  (suivi dans Notion, section INPI).
