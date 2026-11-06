#!/usr/bin/env bash
# Publie le site construit (app/build) sur la branche gh-pages, SANS toucher à ce que les actions automatiques y déposent :
#   data/places/      tuiles de lieux, refaites chaque nuit (places.yml)
#   data/bikes/, data/bikes.geojson  réseau cyclable de la carte vélo, refait chaque nuit (places.yml)
#   data/facades.json devantures Panoramax, refaites chaque dimanche (facades.yml)
#   data/extras.json  compléments hors OSM (sites, téléphones…), refaits chaque lundi (extras.yml)
#   data/sitehours.json état des lectures de sites (dates, horaires trouvés), tenu par extras.yml
#   data/wikiphotos.json état des photos Wikimedia (lieux déjà interrogés), tenu par extras.yml (oublié jusqu'au 05/11/2026 :
#                     chaque publication de l'app l'effaçait, et la recherche de photos repartait de zéro)
#   data/zones/       lieux par tuile des autres villes, refaits chaque semaine (places-zones.yml)
#   data/directory/   annuaire national des lieux par nom, refait à chaque passage de places-zones.yml
# Usage :  bash app/scripts/publish.sh "message"      (depuis la racine du dépôt, après npm run build)
set -euo pipefail
MSG="${1:-Publication}"
ROOT="$(git rev-parse --show-toplevel)"
REMOTE="$(git -C "$ROOT" remote get-url origin)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git clone -q --depth 1 --branch gh-pages "$REMOTE" "$WORK/site"
cd "$WORK/site"
# tout retirer sauf les données produites par les actions
# (liste unique : app/scripts/pages_data.txt)
KEEP=$(grep -v -E '^\s*(#|$)' "$ROOT/app/scripts/pages_data.txt" | sed -E 's/\./\\./g; s#^#^#; s#([^/])$#\1$#' | paste -sd'|')
git ls-files -z | grep -z -v -E "$KEEP" | xargs -0 -r git rm -q
# copier le site, sans les données des calculs (celles en ligne font foi)
(cd "$ROOT/app/build" && find . -type f -print0) | while IFS= read -r -d '' f; do
  printf '%s\n' "${f#./}" | grep -q -E "$KEEP" && continue
  mkdir -p "$(dirname "$f")"; cp "$ROOT/app/build/$f" "$f"
done
touch .nojekyll
bash "$ROOT/app/scripts/site_budget.sh" .
git add -A
# garde-fou : aucune donnée des calculs ne doit disparaître de la publication
if git diff --cached --name-only --diff-filter=D | grep -E "$KEEP"; then echo "ERREUR : ces données des calculs disparaîtraient" >&2; exit 1; fi
git commit -q -m "$MSG" || { echo "rien à publier"; exit 0; }
bash "$ROOT/app/scripts/push_pages.sh"
echo "envoyé : $(git rev-parse --short HEAD)"
# « publié » seulement quand le site sert vraiment cette version (05/11/2026 : mise en ligne refusée par GitHub, non vue)
bash "$ROOT/app/scripts/wait_live.sh" "$(python3 -c "import json;print(json.load(open('$ROOT/app/build/_app/version.json'))['version'])")"
