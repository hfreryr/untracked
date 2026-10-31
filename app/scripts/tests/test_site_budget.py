"""Plafond de poids du site (site_budget.sh) : publication bloquée au-delà, poids détaillé par ville."""
import os, subprocess
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "site_budget.sh"


def site(tmp: Path) -> Path:
    for rel, n in [("data/places/14/1/1.json", 300_000), ("data/zones/lyon/places/14/2/2.json", 200_000),
                   ("index.html", 1_000), (".git/objects/x", 5_000_000)]:
        f = tmp / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(b"x" * n)
    return tmp


def run(d: Path, mo: str):
    return subprocess.run(["bash", str(SCRIPT), str(d)], env={**os.environ, "SITE_BUDGET_MO": mo}, capture_output=True, text=True)


def test_sous_le_plafond(tmp_path):
    r = run(site(tmp_path), "1")
    assert r.returncode == 0
    assert "0.5 Mo" in r.stdout and "lyon : 0.2 Mo" in r.stdout and "Île-de-France : 0.3 Mo" in r.stdout   # .git ignoré


def test_au_dessus_du_plafond(tmp_path):
    r = run(site(tmp_path), "0.4")
    assert r.returncode != 0 and "plafond dépassé" in r.stderr
