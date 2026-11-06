"""push_pages.sh : deux calculs publient en même temps sur gh-pages ; le second réapplique son commit sur la version en
ligne. Essai SANS identité git configurée, comme sur les serveurs de GitHub (06/11/2026 : la réapplication échouait
faute d'identité ; le premier essai, local, avait une identité et ne l'avait pas vu)."""
import os
import subprocess
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "push_pages.sh"


def git(cwd, *args, env):
    return subprocess.run(["git", *args], cwd=cwd, env=env, check=True, capture_output=True, text=True)


def test_course_entre_deux_publications_sans_identite(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(HOME=str(home), GIT_CONFIG_NOSYSTEM="1", GIT_SLEEP="0")
    who = ["-c", "user.name=t", "-c", "user.email=t@t"]
    git(tmp_path, "init", "-q", "--bare", "remote.git", env=env)
    git(tmp_path, "clone", "-q", "remote.git", "a", env=env)
    a = tmp_path / "a"
    git(a, "checkout", "-q", "-b", "gh-pages", env=env)
    (a / "places.json").write_text("1")
    (a / "zones.json").write_text("1")
    git(a, "add", "-A", env=env)
    git(a, *who, "commit", "-qm", "init", env=env)
    git(a, "push", "-q", "origin", "gh-pages", env=env)
    for n in ("b", "c"):
        git(tmp_path, "clone", "-q", "--depth", "1", "--branch", "gh-pages", f"file://{tmp_path}/remote.git", n, env=env)
    b, c = tmp_path / "b", tmp_path / "c"
    (b / "places.json").write_text("2")
    git(b, *who, "commit", "-qam", "places", env=env)
    git(b, "push", "-q", "origin", "HEAD:gh-pages", env=env)
    (c / "zones.json").write_text("2")
    git(c, *who, "commit", "-qam", "zones", env=env)            # (le calcul donne son identité à son propre commit)
    r = subprocess.run(["bash", str(SCRIPT)], cwd=c, env=env, capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr
    git(a, "pull", "-q", "origin", "gh-pages", env=env)
    assert (a / "places.json").read_text() == "2" and (a / "zones.json").read_text() == "2"
