#!/usr/bin/env bash
# Historique du site (branche gh-pages) limité aux N derniers jours, pour que le dépôt ne grossisse pas sans fin
# à chaque publication de nuit (porteur, 30/10/2026 : « garder de quoi revenir en arrière », sobriété).
#   - les publications des N derniers jours sont gardées telles quelles (contenu, message, auteur, date) ;
#   - tout ce qui précède est regroupé en une seule publication : l'état du site il y a N jours.
# On peut donc toujours revenir à n'importe quelle publication des N derniers jours (restore.yml).
# Usage :  bash app/scripts/prune_history.sh <ref> <jours>     (dans un clone complet ; écrit l'empreinte du
#          nouveau sommet sur la sortie, ou rien s'il n'y a rien à regrouper). Ne pousse rien.
set -euo pipefail
REF="$1"; DAYS="$2"
CUTOFF=$(( $(date -u +%s) - DAYS * 86400 ))
mapfile -t ALL < <(git rev-list --reverse --first-parent "$REF")
# première publication des N derniers jours
first=""
for c in "${ALL[@]}"; do
  if [ "$(git log -1 --format=%ct "$c")" -ge "$CUTOFF" ]; then first="$c"; break; fi
done
[ -n "$first" ] || { echo "aucune publication récente : rien à faire" >&2; exit 0; }
base=$(git rev-parse "$first^" 2>/dev/null) || { echo "historique déjà court : rien à faire" >&2; exit 0; }
[ "$(git rev-list --count "$base")" = 1 ] && { echo "historique déjà court : rien à faire" >&2; exit 0; }   # une seule publication ancienne
when=$(git log -1 --format=%cd --date=format:%d/%m/%Y "$base")
new=$(GIT_AUTHOR_NAME=untracked-bot GIT_AUTHOR_EMAIL=bot@untrackedmaps.app GIT_COMMITTER_NAME=untracked-bot \
  GIT_COMMITTER_EMAIL=bot@untrackedmaps.app GIT_AUTHOR_DATE="$(git log -1 --format=%cI "$base")" GIT_COMMITTER_DATE="$(git log -1 --format=%cI "$base")" \
  git commit-tree "$base^{tree}" -m "Site au $when (publications antérieures regroupées)")
for c in $(git rev-list --reverse --first-parent "$base..$REF"); do
  new=$(GIT_AUTHOR_NAME="$(git log -1 --format=%an "$c")" GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae "$c")" \
    GIT_AUTHOR_DATE="$(git log -1 --format=%aI "$c")" GIT_COMMITTER_NAME="$(git log -1 --format=%cn "$c")" \
    GIT_COMMITTER_EMAIL="$(git log -1 --format=%ce "$c")" GIT_COMMITTER_DATE="$(git log -1 --format=%cI "$c")" \
    git commit-tree "$c^{tree}" -p "$new" -m "$(git log -1 --format=%B "$c")")
done
echo "$new"
