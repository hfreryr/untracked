#!/usr/bin/env bash
# Publie le site construit (app/build) sur la branche gh-pages, SANS toucher à ce que les actions automatiques y déposent :
#   data/places/      tuiles de lieux, refaites chaque nuit (places.yml)
#   data/bikes/, data/bikes.geojson  réseau cyclable de la carte vélo, refait chaque nuit (places.yml)
#   data/facades.json devantures Panoramax, refaites chaque dimanche (facades.yml)
#   data/extras.json  compléments hors OSM (sites, téléphones…), refaits chaque lundi (extras.yml)
#   data/sitehours.json état des lectures de sites (dates, horaires trouvés), tenu par extras.yml
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
git ls-files -z | grep -z -v -E '^data/places/|^data/zones/|^data/directory/|^data/bikes/|^data/bikes\.geojson$|^data/facades\.json$|^data/extras\.json$|^data/sitehours\.json$' | xargs -0 -r git rm -q
# copier le site, sans les tuiles locales (celles de la nuit font foi)
(cd "$ROOT/app/build" && find . -type f ! -path './data/places/*' ! -path './data/zones/*' ! -path './data/directory/*' ! -path './data/bikes.geojson' ! -path './data/bikes/*' -print0) | while IFS= read -r -d '' f; do
  mkdir -p "$(dirname "$f")"; cp "$ROOT/app/build/$f" "$f"
done
touch .nojekyll
bash "$ROOT/app/scripts/site_budget.sh" .
git add -A
git commit -q -m "$MSG" || { echo "rien à publier"; exit 0; }
git push -q origin HEAD:gh-pages
echo "publié : $(git rev-parse --short HEAD)"
