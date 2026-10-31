#!/usr/bin/env bash
# Plafond de poids du site (branche gh-pages) : GitHub Pages limite un site à 1 Go ; on s'arrête à 700 Mo pour garder
# de la marge (décision du 30/10/2026, voir docs/villes.md). Affiche le poids total et celui de chaque ville, et
# échoue au-delà du plafond : la publication n'a pas lieu, il faut arbitrer (retirer ou alléger une ville).
# Usage : bash app/scripts/site_budget.sh <dossier du site>      (SITE_BUDGET_MO remplace le plafond, pour les tests)
set -euo pipefail
DIR=${1:?dossier du site}
MAX_MO=${SITE_BUDGET_MO:-700}
mo() { du -sb --exclude=.git "$1" 2>/dev/null | awk '{printf "%.1f", $1/1e6}'; }
TOTAL=$(mo "$DIR")
echo "poids du site : $TOTAL Mo (plafond $MAX_MO Mo)"
[ -d "$DIR/data/places" ] && echo "  Île-de-France : $(mo "$DIR/data/places") Mo"
for z in "$DIR"/data/zones/*/; do [ -d "$z" ] && echo "  $(basename "$z") : $(mo "$z") Mo"; done
if awk -v t="$TOTAL" -v m="$MAX_MO" 'BEGIN{exit !(t>m)}'; then
  echo "plafond dépassé : publication annulée (voir docs/villes.md)" >&2
  exit 1
fi
