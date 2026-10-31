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


def petit_pbf(path: Path) -> bytes:
    import osmium
    w = osmium.SimpleWriter(str(path))
    w.add_node(osmium.osm.mutable.Node(id=1, location=(2.35, 48.85), tags={"name": "x"}))
    w.close()
    return path.read_bytes()


def test_somme_pas_a_jour_mais_extrait_sain(tmp_path):
    # OSM France, 30/10/2026 : extrait refait, somme de contrôle restée à la veille → lecture complète, accepté
    data = petit_pbf(tmp_path / "gen.osm.pbf")
    r, out = run(tmp_path, source(tmp_path, "a.pbf", data, md5="0" * 32), source(tmp_path, "b.pbf", b"BBB"))
    assert r.returncode == 0 and out.read_bytes() == data, r.stdout + r.stderr


def test_somme_fausse_et_extrait_tronque(tmp_path):
    data = petit_pbf(tmp_path / "gen.osm.pbf")[:-20]
    r, out = run(tmp_path, source(tmp_path, "a.pbf", data, md5="0" * 32), source(tmp_path, "b.pbf", b"BBB"))
    assert r.returncode == 0 and out.read_bytes() == b"BBB"
