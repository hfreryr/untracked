"""Secours du téléchargement de l'extrait OSM (fetch_idf.sh) : si la première source manque ou est corrompue,
la seconde est utilisée ; si aucune ne répond, la tâche échoue."""
import hashlib, os, subprocess
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "fetch_idf.sh"


def source(d: Path, name: str, data: bytes, md5: str | None = None) -> str:
    f = d / name
    f.write_bytes(data)
    (d / (name + ".md5")).write_text(f"{md5 or hashlib.md5(data).hexdigest()}  {name}\n")
    return f.as_uri()


def run(tmp: Path, *urls: str):
    out = tmp / "idf.osm.pbf"
    env = {**os.environ, "IDF_SOURCES": " ".join(urls), "IDF_RETRY": "0"}
    r = subprocess.run(["bash", str(SCRIPT), str(out)], env=env, capture_output=True, text=True)
    return r, out


def test_source_principale(tmp_path):
    r, out = run(tmp_path, source(tmp_path, "a.pbf", b"AAA"), source(tmp_path, "b.pbf", b"BBB"))
    assert r.returncode == 0 and out.read_bytes() == b"AAA"


def test_secours_si_principale_absente(tmp_path):
    r, out = run(tmp_path, (tmp_path / "absent.pbf").as_uri(), source(tmp_path, "b.pbf", b"BBB"))
    assert r.returncode == 0 and out.read_bytes() == b"BBB"


def test_secours_si_somme_fausse(tmp_path):
    r, out = run(tmp_path, source(tmp_path, "a.pbf", b"AAA", md5="0" * 32), source(tmp_path, "b.pbf", b"BBB"))
    assert r.returncode == 0 and out.read_bytes() == b"BBB"


def test_echec_si_aucune_source(tmp_path):
    r, out = run(tmp_path, (tmp_path / "x.pbf").as_uri(), (tmp_path / "y.pbf").as_uri())
    assert r.returncode != 0 and not out.exists()
