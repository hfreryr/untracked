#!/usr/bin/env bash
# Attend que untrackedmaps.app serve la version donnée (_app/version.json), au plus 25 min (06/11/2026). Si la mise en
# ligne de GitHub Pages a échoué, elle est relancée (une fois) ; sinon échec bruyant. Usage : bash wait_live.sh <version>
set -uo pipefail
want="$1"; SITE="${SITE:-https://untrackedmaps.app}"; REPO="${REPO:-hfreryr/untracked}"; rerun=0
for i in $(seq 1 100); do
  got=$(curl -s "$SITE/_app/version.json?t=$(date +%s%N)" | python3 -c "import json,sys; print(json.load(sys.stdin).get('version',''))" 2>/dev/null)
  [ "$got" = "$want" ] && { echo "publié : version $want en ligne"; exit 0; }
  if command -v gh >/dev/null && [ $((i % 4)) -eq 0 ]; then
    run=$(gh api "repos/$REPO/actions/runs?per_page=1&branch=gh-pages" --jq '.workflow_runs[0] | "\(.id) \(.status) \(.conclusion)"' 2>/dev/null)
    case "$run" in
      *"completed failure"*|*"completed cancelled"*)
        if [ $rerun -lt 1 ]; then echo "mise en ligne refusée par GitHub : relance"; gh api -X POST "repos/$REPO/actions/runs/${run%% *}/rerun" >/dev/null; rerun=1
        else echo "ERREUR : mise en ligne refusée deux fois par GitHub ; le site sert encore $got" >&2; exit 1; fi ;;
    esac
  fi
  sleep 15
done
echo "ERREUR : après 25 min, le site sert encore $got au lieu de $want" >&2
exit 1
