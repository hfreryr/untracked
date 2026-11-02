"""Photos Wikimedia préparées à l'avance (build_wikiphotos.py), avec un faux Wikimedia : rien n'est demandé au réseau."""
import urllib.parse

from build_wikiphotos import prepare, photo_of, THUMB

T = THUMB + "a/ab/Flore.jpg/960px-Flore.jpg"


def fake(calls):
    def get(url):
        calls.append(url)
        u = urllib.parse.unquote(url)
        if "wikidata.org" in u:
            return {"entities": {"Q1": {"claims": {"P18": [{"mainsnak": {"datavalue": {"value": "Flore.jpg"}}}],
                                                   "P373": [{"mainsnak": {"datavalue": {"value": "Café de Flore"}}}]},
                                        "sitelinks": {"frwiki": {"title": "Café de Flore"}}}}}
        if "fr.wikipedia.org" in u:
            return {"query": {"pages": {"1": {"title": "Café de Flore", "pageprops": {"wikibase_item": "Q1"}}}}}
        if "categorymembers" in u:
            return {"query": {"pages": {
                "2": {"index": 2, "title": "File:Salle.jpg", "imageinfo": [{"thumburl": THUMB + "c/cd/Salle.jpg/960px-Salle.jpg"}]},
                "3": {"index": 1, "title": "File:Plan.pdf", "imageinfo": [{"thumburl": THUMB + "x/xy/Plan.pdf/960px-Plan.pdf.jpg"}]},
                "4": {"index": 3, "title": "File:Flore.jpg", "imageinfo": [{"thumburl": T}]}}}}
        return {"query": {"pages": {"1": {"title": "File:Flore.jpg", "imageinfo": [{"thumburl": T, "extmetadata": {
            "Artist": {"value": "<a href='x'>Jean Dupont</a>"}, "LicenseShortName": {"value": "CC BY-SA 4.0"}}}]}}}}
    return get


def test_image_principale_puis_categorie_sans_doublon_ni_pdf():
    calls, state = [], {}
    prepare({"n1": ("Q1", None)}, state, "2026-11-01", get=fake(calls))
    s = state["Q1"]
    assert s["t"] == "Café de Flore"
    assert s["p"][0] == ["a/ab/Flore.jpg/960px-Flore.jpg", "Jean Dupont · CC BY-SA 4.0"]
    assert [p[0] for p in s["p"]] == ["a/ab/Flore.jpg/960px-Flore.jpg", "c/cd/Salle.jpg/960px-Salle.jpg"]


def test_article_seul_et_resultat_garde_90_jours():
    calls, state = [], {}
    found, asked, _ = prepare({"n1": (None, "Café de Flore")}, state, "2026-11-01", get=fake(calls))
    assert found == {"Café de Flore": "Q1"} and asked == 1
    calls.clear()
    _, asked, cats = prepare({"n1": ("Q1", None)}, state, "2026-12-01", get=fake(calls))
    assert asked == 0 and cats == 0 and calls == []           # rien de redemandé un mois plus tard
    _, asked, _ = prepare({"n1": ("Q1", None)}, state, "2027-03-01", get=fake(calls))
    assert asked == 1                                          # relu après 90 jours


def test_categories_limitees_par_passage():
    calls, state = [], {}
    _, _, cats = prepare({"n1": ("Q1", None)}, state, "2026-11-01", get=fake(calls), max_categories=0)
    assert cats == 0 and not state["Q1"]["c"] and len(state["Q1"]["p"]) == 1
    _, _, cats = prepare({"n1": ("Q1", None)}, state, "2026-11-08", get=fake(calls))
    assert cats == 1 and state["Q1"]["c"] and len(state["Q1"]["p"]) == 2


def test_pas_une_photo():
    assert photo_of({"title": "File:Plan.pdf", "imageinfo": [{"thumburl": THUMB + "x"}]}) is None
    assert photo_of({"title": "File:a.jpg", "imageinfo": [{"thumburl": "https://ailleurs/a.jpg"}]}) is None


def page(title, year=None, desc="", w=4000, h=3000):
    meta = {"ImageDescription": {"value": desc}}
    if year:
        meta["DateTimeOriginal"] = {"value": f"{year}-06-01 12:00"}
    return {"title": "File:" + title, "imageinfo": [{"thumburl": THUMB + f"a/ab/{title}/960px-{title}", "width": w, "height": h, "extmetadata": meta}]}


def test_classement_comme_maps_la_gravure_en_dernier_meme_choisie_par_wikidata():
    from build_wikiphotos import ranked
    pages = [page("Saint-Sulpice gravure 1850.jpg", desc="Gravure du XIXe siècle"), page("Saint-Sulpice 2023.jpg", 2023),
             page("Saint-Sulpice 2009.jpg", 2009), page("Plan Saint-Sulpice.png", w=800, h=900)]
    order = [p[0].split("/")[2] for p in ranked(pages, main_title="File:Saint-Sulpice gravure 1850.jpg")]
    assert order[:2] == ["Saint-Sulpice 2023.jpg", "Saint-Sulpice 2009.jpg"]
    assert set(order[2:]) == {"Saint-Sulpice gravure 1850.jpg", "Plan Saint-Sulpice.png"}


def test_photo_ancienne_par_sa_date():
    from build_wikiphotos import photo_score
    assert photo_score(page("Rue.jpg", 1925)) < photo_score(page("Rue.jpg", 2021))
