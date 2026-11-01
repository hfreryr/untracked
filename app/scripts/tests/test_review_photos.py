"""Photos des avis : copiées en deux tailles, sans métadonnées ; une photo illisible quitte la fiche."""
import io
import os

from PIL import Image

from build_places import attach_reviews
from review_photos import copy_photos


def jpeg_with_gps():
    im = Image.new("RGB", (2000, 1500), "red")
    exif = Image.Exif()
    exif[0x8825] = {2: (48.0, 51.0, 0.0)}          # bloc GPS
    buf = io.BytesIO()
    im.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


def test_copie_et_nettoyage(tmp_path):
    tiles = {(1, 1): [[31, 2.35, 48.85, {"name": "Chez A", "amenity": "cafe"}]]}
    reviews = [{"osm": "node/3", "lat": 48.85, "lon": 2.35, "name": "Chez A", "r": 80, "o": "", "n": "Lou", "t": 1700000000,
                "s": "sig", "img": 2, "ph": ["bonnephoto1234", "cassee123456"]}]
    attach_reviews(tiles, reviews, 14)
    assert tiles[(1, 1)][0][3]["_rev"]["ph"] == [["bonnephoto1234", "Lou", 1700000000], ["cassee123456", "Lou", 1700000000]]
    raw = jpeg_with_gps()
    n = copy_photos(tiles, str(tmp_path), get=lambda u: raw if "bonne" in u else b"pas une image")
    assert n == 1
    assert tiles[(1, 1)][0][3]["_rev"]["ph"] == [["bonnephoto1234", "Lou", 1700000000]]
    big, thumb = Image.open(tmp_path / "photos/bonnephoto1234.jpg"), Image.open(tmp_path / "photos/bonnephoto1234.t.jpg")
    assert max(big.size) == 1400 and max(thumb.size) == 480
    assert 0x8825 not in big.getexif()          # plus de position GPS
