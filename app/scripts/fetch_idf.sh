#!/usr/bin/env bash
# Télécharge l'extrait OSM d'Île-de-France et vérifie sa somme de contrôle.
# Source principale : OSM France. Secours : Geofabrik, si OSM France ne répond pas
# (panne du 25/10/2026 : erreur 502 toute la matinée, tâche de nuit en échec).
# Mêmes données (OSM, licence ODbL) ; seul le contour de la région peut légèrement différer.
# Si la somme publiée ne correspond pas (OSM France la met parfois à jour un jour après l'extrait, 30/10/2026),
# l'extrait est lu en entier (verify_pbf.py) : accepté s'il est complet et lisible, rejeté sinon.
# Usage : bash app/scripts/fetch_idf.sh idf.osm.pbf
set -uo pipefail
OUT=${1:-idf.osm.pbf}
# IDF_SOURCES (adresses séparées par des espaces) remplace la liste, pour les tests
read -r -a SOURCES <<< "${IDF_SOURCES:-https://download.openstreetmap.fr/extracts/europe/france/ile_de_france.osm.pbf https://download.geofabrik.de/europe/france/ile-de-france-latest.osm.pbf}"
for url in "${SOURCES[@]}"; do
  echo "essai : $url"
  if curl -sSfL --retry "${IDF_RETRY:-3}" --retry-all-errors -o "$OUT" "$url" \
     && { curl -sSfL --retry "${IDF_RETRY:-3}" "$url.md5" | awk -v f="$OUT" '{print $1"  "f}' | md5sum -c - \
          || { echo "somme de contrôle différente (peut-être pas encore mise à jour) : lecture complète de l'extrait";
               python3 "$(dirname "$0")/verify_pbf.py" "$OUT"; }; }; then
    echo "extrait téléchargé depuis : $url"
    exit 0
  fi
  echo "échec, source suivante"
  rm -f "$OUT"
done
echo "aucune source n'a répondu" >&2
exit 1
