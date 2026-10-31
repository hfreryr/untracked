"""Tâche des villes (places-zones.yml) : un cadre à l'ouest de Greenwich commence par « - » (Rennes : -1.80,…) ;
passé en « --bbox -1.80,… », Python le prend pour une option et la ville échoue (vu en mesurant Rennes le 30/10/2026)."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_cadre_toujours_colle_a_l_option():
    yml = (ROOT / ".github/workflows/places-zones.yml").read_text()
    assert re.search(r'--bbox[ =]"?\$bbox', yml)
    assert not re.search(r'--bbox\s+"?\$', yml), "écrire --bbox=\"$bbox\" (cadre négatif à l'ouest)"


def test_cadre_negatif_accepte():
    r = subprocess.run([sys.executable, str(ROOT / "app/scripts/build_places.py"), "absent.pbf", "--bbox=-1.8,48.03,-1.55,48.2",
                        "--out", "/nonexistent/x"], capture_output=True, text=True)
    assert "expected one argument" not in r.stderr


def test_zones_retirees_quittent_le_site(tmp_path):
    # bloc de places-zones.yml qui retire du site les zones absentes de zones.json (Lyon → région Rhône-Alpes, 31/10/2026)
    yml = (ROOT / ".github/workflows/places-zones.yml").read_text().splitlines()
    i = next(k for k, l in enumerate(yml) if "zones retirées de zones.json" in l)
    j = next(k for k in range(i, len(yml)) if yml[k].strip() == "done")
    block = "\n".join(l[10:] for l in yml[i:j + 1])
    (tmp_path / "app/src/lib/cities").mkdir(parents=True)
    (tmp_path / "app/src/lib/cities/zones.json").write_text('[{"id": "rhone-alpes"}, {"id": "amsterdam"}]')
    for z in ("lyon", "rhone-alpes", "amsterdam"):
        (tmp_path / "pages/data/zones" / z / "places").mkdir(parents=True)
    subprocess.run(["bash", "-c", block], cwd=tmp_path, check=True, capture_output=True)
    assert sorted(p.name for p in (tmp_path / "pages/data/zones").iterdir()) == ["amsterdam", "rhone-alpes"]
