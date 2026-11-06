#!/usr/bin/env bash
# Télécharge un fichier d'état ou de données déjà en ligne (06/11/2026). Absent (404, première fois) : valeur par défaut.
# Toute autre erreur (réseau, serveur) : échec, pour ne JAMAIS repartir de zéro et publier un état vide par-dessus le bon
# (« curl || echo '{}' » le faisait en silence).
# Usage : bash fetch_state.sh <adresse> <fichier> [valeur par défaut, '{}' si absente]
set -uo pipefail
url="$1"; out="$2"; default="${3:-{\}}"
for i in 1 2 3; do
  code=$(curl -sSL -o "$out" -w '%{http_code}' "$url?t=$(date +%s)") || code=000
  case "$code" in
    200) exit 0 ;;
    404) printf '%s' "$default" > "$out"; echo "$url : absent, on part de $default"; exit 0 ;;
  esac
  echo "$url : réponse $code, nouvel essai ($i)"; sleep $((i * 15))
done
echo "::error::$url illisible (réponse $code) : on ne repart pas de zéro"
rm -f "$out"
exit 1
