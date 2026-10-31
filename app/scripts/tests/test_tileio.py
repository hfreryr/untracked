"""Tuiles adaptatives et compressées (tileio.py) : grands fichiers là où il y a peu de lieux, fins en ville,
rien de perdu, fichiers identiques d'une construction à l'autre."""
import gzip, json, os, random
import tileio


def lieu(i, cx, cy):
    return [i * 10 + 1, 0, 0, {"name": f"lieu {i}", "amenity": "cafe"}]


def test_campagne_un_fichier_ville_decoupee(tmp_path):
    rnd = random.Random(1)
    cells = {}
    # campagne : 40 carrés de zoom 14 avec 3 lieux chacun, dans le même carré de zoom 10
    for k in range(40):
        cells[(16 * 500 + k % 8, 16 * 300 + k // 8)] = [lieu(k * 10 + j, 0, 0) for j in range(3)]
    # ville : 4 carrés très remplis (textes variés, peu compressibles), dans un autre carré de zoom 10
    for k in range(4):
        cells[(16 * 600 + k, 16 * 300)] = [[(k * 10_000 + j) * 10 + 1, 0, 0, {"name": "".join(rnd.choice("abcdefghij") for _ in range(40))}]
                                           for j in range(2_000)]
    sizes = tileio.write(str(tmp_path), cells, {"count": 8120})
    idx = json.load(open(tmp_path / "index.json"))
    assert idx["v"] == 2 and idx["cells"] == 44 and idx["count"] == 8120
    assert "10/500/300" in idx["tiles"]                       # toute la campagne dans un seul fichier
    assert [t for t in idx["tiles"] if t.startswith("14/")]   # la ville, coupée jusqu'aux carrés de base
    assert len(sizes) == len(idx["tiles"])
    ids = sorted(it[0] for it in tileio.iter_items(str(tmp_path)))
    assert ids == sorted(it[0] for v in cells.values() for it in v)   # rien de perdu ni de doublé


def test_meme_contenu_memes_octets(tmp_path):
    cells = {(8000, 5000): [lieu(1, 0, 0)]}
    a, b = tmp_path / "a", tmp_path / "b"
    tileio.write(str(a), cells, {}); tileio.write(str(b), cells, {})
    fa = (a / "10/500/312.json.gz").read_bytes()
    assert fa == (b / "10/500/312.json.gz").read_bytes() and fa[:2] == b"\x1f\x8b"
    assert json.loads(gzip.decompress(fa))["t"][0][0] == 11


def test_ancien_format_encore_lu(tmp_path):
    d = tmp_path / "14" / "8000"; d.mkdir(parents=True)
    (d / "5000.json").write_text(json.dumps({"v": 1, "t": [lieu(7, 0, 0)]}))
    assert [it[0] for it in tileio.iter_items(str(tmp_path))] == [71]
