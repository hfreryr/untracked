"""Lecture des sites : plafond par passage, les plus proches de Paris d'abord, relectures avant les nouveaux."""
from build_sitehours import pick_fresh


def test_plafond_et_priorite():
    fresh = [("1", "A", "https://versailles.fr", 2.13, 48.80),
             ("2", "B", "https://louvre.fr", 2.33, 48.86),
             ("3", "C", "https://meaux.fr", 2.88, 48.96),
             ("4", "D", "https://connu.fr", 2.88, 48.96)]
    state = {"https://connu.fr": {"checked": "2026-09-01"}}
    picked = [j[0] for j in pick_fresh(fresh, state, 3)]
    assert picked == ["4", "2", "1"]          # relecture d'abord, puis Paris, puis Versailles ; Meaux attendra


def test_photo_publiee_par_le_site():
    from build_sitehours import photo_candidates, photo_in, due
    html = '''<head><meta property="og:image" content="/img/logo.png"><meta content="https://cdn.resto.fr/salle.jpg?w=1200&amp;q=80" property="og:image">
      <script type="application/ld+json">{"@type":"Restaurant","name":"Chez A","image":["https://cdn.resto.fr/plat.jpg","http://x.fr/insecure.jpg"]}</script></head>'''
    c = photo_candidates(html, "https://resto.fr/")
    # le logo est écarté, l'adresse relative complétée, http (non sécurisé) refusé
    assert c == ["https://cdn.resto.fr/salle.jpg?w=1200&q=80", "https://cdn.resto.fr/plat.jpg"]
    assert photo_in(html, "https://resto.fr/", check=lambda u: "plat" in u) == "https://cdn.resto.fr/plat.jpg"
    assert photo_in(html, "https://resto.fr/", check=lambda u: False) is None
    # un site lu avant que l'on cherche les photos est relu une fois
    assert due({"checked": "2026-10-30", "hours": "Mo 10:00-12:00"}, "2026-11-01")
    assert not due({"checked": "2026-10-30", "hours": "Mo 10:00-12:00", "photo": None}, "2026-11-01")


def test_photo_ok_refuse_cookie_et_petite(monkeypatch):
    import io
    import build_sitehours as b
    from PIL import Image

    def img(w, h):
        buf = io.BytesIO(); Image.new("RGB", (w, h)).save(buf, "JPEG"); return buf.getvalue()

    class R:
        def __init__(self, raw, cookie=False):
            self.raw, self.cookie = raw, cookie
            self.headers = self
        def get(self, k, d=None): return "image/jpeg" if k == "Content-Type" else d
        def get_all(self, k): return ["a=b"] if self.cookie and k == "Set-Cookie" else None
        def read(self, n): return self.raw
        def __enter__(self): return self
        def __exit__(self, *a): pass

    for raw, cookie, ok in ((img(1200, 800), False, True), (img(1200, 800), True, False), (img(300, 200), False, False), (img(1600, 300), False, False)):
        monkeypatch.setattr(b.urllib.request, "urlopen", lambda *a, **k: R(raw, cookie))
        assert b.photo_ok("https://cdn.resto.fr/x.jpg") is ok


def test_regions_du_centre_de_la_zone_vers_l_exterieur():
    # Brest et Rennes : autour de Brest, Brest d'abord ; avec le centre par défaut (Paris), Rennes passerait devant
    fresh = [("1", "Brest", "brest.fr", -4.49, 48.39, True), ("2", "Rennes", "rennes.fr", -1.68, 48.11, True)]
    assert [j[0] for j in pick_fresh(fresh, {}, 1, centre=(-4.4, 48.4))] == ["1"]
    assert [j[0] for j in pick_fresh(fresh, {}, 1)] == ["2"]
