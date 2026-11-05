#!/usr/bin/env bash
# Pousse le commit courant sur gh-pages, même si un autre calcul (ou une publication de l'app) a poussé entre-temps.
# Le 04/11/2026, les lieux de 4 régions (Bourgogne, Corse, Haute-Normandie, Pays de la Loire) calculés pendant 3 h ont
# été perdus : « git push » refusé (gh-pages avait avancé), et l'échec était masqué. Ici : jusqu'à 5 essais ; à chaque
# refus, on repart du gh-pages en ligne et on y réapplique notre commit (chaque calcul ne touche que ses propres
# fichiers ; en cas de conflit, notre version l'emporte). Échec bruyant si rien n'y fait.
# Usage : bash push_pages.sh   (depuis le dossier de travail gh-pages, notre commit en tête)
set -uo pipefail
mine="$(git rev-parse HEAD)"
for i in 1 2 3 4 5; do
  git push -q origin HEAD:gh-pages && { echo "poussé sur gh-pages (essai $i)"; exit 0; }
  echo "gh-pages a avancé : on réapplique notre commit sur la version en ligne (essai $i)"
  sleep $((i * 10))
  git fetch -q --depth=1 origin gh-pages || continue
  git checkout -q --detach FETCH_HEAD && git cherry-pick -X theirs --allow-empty "$mine" >/dev/null || { git cherry-pick --abort 2>/dev/null; git checkout -q --detach "$mine"; }
done
echo "::error::publication sur gh-pages impossible après 5 essais"
exit 1
