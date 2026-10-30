"""Historique du site limité aux N derniers jours (prune_history.sh) : publications récentes intactes, les plus
anciennes regroupées en une seule, contenu final identique."""
import os
import subprocess
import time
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "prune_history.sh"


def git(repo, *args, env=None):
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True,
                          env={**os.environ, **(env or {})}).stdout.strip()


def publish(repo, days_ago, content):
    (repo / "data.txt").write_text(content)
    d = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - days_ago * 86400))
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", f"publication {content}", env={"GIT_AUTHOR_DATE": d, "GIT_COMMITTER_DATE": d})


def make(tmp, ages):
    repo = tmp / "site"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "gh-pages")
    git(repo, "config", "user.name", "t"); git(repo, "config", "user.email", "t@t")
    for i, a in enumerate(ages):
        publish(repo, a, f"v{i}")
    return repo


def prune(repo, days=7):
    r = subprocess.run(["bash", str(SCRIPT), "gh-pages", str(days)], cwd=repo, check=True, capture_output=True, text=True)
    return r.stdout.strip()


def test_garde_7_jours_et_regroupe_le_reste(tmp_path):
    repo = make(tmp_path, [30, 20, 10, 8, 6, 3, 1, 0.1])
    new = prune(repo)
    msgs = git(repo, "log", "--format=%s", new).splitlines()
    assert msgs[:4] == ["publication v7", "publication v6", "publication v5", "publication v4"]
    assert len(msgs) == 5 and msgs[4].startswith("Site au ")          # v0 à v3 regroupées
    assert git(repo, "rev-parse", f"{new}^{{tree}}") == git(repo, "rev-parse", "gh-pages^{tree}")
    assert git(repo, "show", f"{new}~4:data.txt") == "v3"                # l'état d'il y a 7 jours reste accessible


def test_rien_a_faire(tmp_path):
    assert prune(make(tmp_path, [3, 1])) == ""                           # tout est récent
    other = tmp_path / "b"; other.mkdir()
    assert prune(make(other, [20, 1])) == ""                             # une seule publication ancienne : déjà court
