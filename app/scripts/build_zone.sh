#!/usr/bin/env bash
# Une zone (région, ville) de bout en bout, exactement comme la nuit (places-zones.yml) : extrait OSM, compléments,
# sites, photos Wikimedia, lieux, repères, recherche, puis contrôle avant publication. Sorti du calcul le 06/11/2026
# pour être TESTÉ sur toutes les sortes de zones (tests/test_build_zone.py : longitudes négatives, frontière…) :
# le défaut « --centre -0,5,47 pris pour une option » vivait dans le calcul, que rien ne testait.
# Usage : bash build_zone.sh <id> <extrait> <ouest,sud,est,nord> <pays>
# Écrit out/<id>/ (tuiles), <id>-sitehours.json et <id>-wikiphotos.json (s'ils sont sûrs), <id>-verdict.txt et
# <id>-status : « ok » (publiable), « partial » (publiable, une étape a échoué), « refused » (baisse anormale).
# Essai : ZONE_PBF=fichier (pas de téléchargement), OFFLINE=1 (ni avis, ni compléments, ni états en ligne).
set -uo pipefail
id="$1"; extract="$2"; bbox="$3"; country="$4"
S="$(dirname "$0")"; ONLINE="${ONLINE:-https://untrackedmaps.app}"; partial=""
err() { echo "::error::$id : $1"; partial=1; }
if [ -n "${ZONE_PBF:-}" ]; then cp "$ZONE_PBF" "$id.osm.pbf"
else IDF_SOURCES="https://download.openstreetmap.fr/extracts/$extract.osm.pbf" bash "$S/fetch_idf.sh" "$id.osm.pbf" || { echo "::error::$id : extrait OSM illisible"; echo refused > "$id-status"; exit 1; }; fi
if [ -n "${OFFLINE:-}" ]; then
  echo '[]' > "$id-reviews.json"; echo '{"places":{}}' > "$id-extras.json"; echo '{}' > "$id-sitehours.json"; echo '{}' > "$id-wikiphotos.json"
else
  python "$S/fetch_reviews.py" --bbox="$bbox" --out "$id-reviews.json" || { echo "::warning::$id : avis indisponibles"; echo '[]' > "$id-reviews.json"; }
  # compléments hors OSM : Overture, All The Places, annuaire de l'administration (All The Places téléchargé une fois)
  python "$S/build_extras.py" "$id.osm.pbf" --out "$id-extras.json" --no-paris --pays "$country" $([ -f atp.zip ] && echo --atp atp.zip) \
    || { err "compléments hors OSM non calculés"; echo '{"places":{}}' > "$id-extras.json"; }
  # états des semaines précédentes : jamais remplacés par un état vide si le site ne répond pas (fetch_state.sh)
  bash "$S/fetch_state.sh" "$ONLINE/data/zones/$id/sitehours.json" "$id-sitehours.json" || err "état des sites illisible"
  bash "$S/fetch_state.sh" "$ONLINE/data/zones/$id/wikiphotos.json" "$id-wikiphotos.json" || err "état des photos illisible"
fi
# (« --centre=… » : une longitude négative, à l'ouest de Greenwich, serait prise pour une option, 05/11/2026)
centre=$(python3 -c "b=[float(x) for x in '$bbox'.split(',')]; print(f'{(b[0]+b[2])/2},{(b[1]+b[3])/2}')")
if [ -f "$id-sitehours.json" ]; then
  python "$S/build_sitehours.py" "$id.osm.pbf" --extras "$id-extras.json" --state "$id-sitehours.json" \
    --max-new "${SITES:-4000}" --centre="$centre" $([ -n "${OFFLINE:-}" ] && echo --no-cc) || { err "sites des lieux non lus"; rm -f "$id-sitehours.json"; }
fi
if [ -f "$id-wikiphotos.json" ]; then
  python "$S/build_wikiphotos.py" "$id.osm.pbf" --extras "$id-extras.json" --state "$id-wikiphotos.json" \
    || { err "photos Wikimedia non préparées"; rm -f "$id-wikiphotos.json"; }
fi
python "$S/build_places.py" "$id.osm.pbf" --out "out/$id" --bbox="$bbox" --reviews "$id-reviews.json" --extras "$id-extras.json" \
  && python "$S/build_landmarks.py" "$id.osm.pbf" --out "out/$id" --bbox="$bbox" \
  && python "$S/build_search.py" "out/$id" --extras "$id-extras.json" \
  || { echo "::error::$id : lieux, repères ou recherche non construits"; echo refused > "$id-status"; exit 1; }
# contrôle avant publication : lieux, tuiles et chaque champ, comparés à la version en ligne
if python "$S/check_publish.py" "out/$id/index.json" "$ONLINE/data/zones/$id/places/index.json" > "$id-verdict.txt"; then
  echo "${partial:+partial}" | sed 's/^$/ok/' > "$id-status"
else
  echo "::error::$id non publiée (baisse anormale) : la version en ligne reste"; echo refused > "$id-status"
fi
cat "$id-verdict.txt"
rm -f "$id.osm.pbf"
