"""Compléments hors OSM : appariement prudent, sites plausibles, numéros normalisés, jamais de remplacement d'OSM."""
from build_extras import same_name, completable, site_of, phone_fr, match_overture, NOT_A_SITE
from build_places import add_extras


def test_meme_nom():
    assert same_name("La Casa di Anna", "La casa di Anna paris")
    assert same_name("Café de Flore", "Cafe de Flore")
    # deux mots en commun, mais aucun distinctif : pas le même lieu
    assert not same_name("Grands Boulevards", "Holiday Inn Grands Boulevards")
    assert not same_name("Centre Culturel", "Centre culturel russe")
    assert not same_name("Chez Paul", "Chez Pierre")


def test_lieux_completes():
    assert completable({"amenity": "restaurant", "name": "X"})
    assert completable({"shop": "bakery"})
    assert completable({"tourism": "hotel"})
    assert not completable({"railway": "station", "name": "Grands Boulevards"})
    assert not completable({"amenity": "place_of_worship", "name": "Église Saint-Sulpice"})
    assert not completable({"amenity": "parking"})
    assert not completable({"tourism": "attraction"})


def test_site_du_lieu():
    assert site_of("Loca Images", "http://www.loca-images.com")
    assert site_of("Dinh Van", "http://www.dinhvan.com")
    assert site_of("5àsec", "https://www.5asec.fr/fr/magasin/pressing-paris-saint-antoine/")
    assert not site_of("Aubergine 3000", "http://www.lestendhal.net/")
    assert not site_of("Croccante", "http://www.linternaute.com/restaurant/11236/")
    assert NOT_A_SITE.search("https://www.tripadvisor.fr/Restaurant_Review")
    assert NOT_A_SITE.search("https://www.google.com/maps/place/x")


def test_numeros():
    assert phone_fr("+33142784979") == "+33 1 42 78 49 79"
    assert phone_fr("01 42 78 49 79") == "+33 1 42 78 49 79"
    assert phone_fr("0033 6 22 29 04 30") == "+33 6 22 29 04 30"
    assert phone_fr("+44 20 7946 0958") is None
    assert phone_fr("12") is None


def test_appariement():
    items = [[11, 2.3500, 48.8500, {"name": "Bistrot 38", "amenity": "pub"}],
             [21, 2.3501, 48.8501, {"name": "Gare du Nord", "railway": "station"}]]
    rows = [("Bistrot 38", 48.85002, 2.35002, ["http://www.bistrot38.fr/"], ["+33140380868"], 0.9),
            ("Bistrot 38", 48.8600, 2.3600, ["http://autre.fr"], [], 0.9),            # trop loin
            ("Gare du Nord", 48.8501, 2.3501, ["http://hotel.fr"], [], 0.9)]           # une gare n'est pas complétée
    found = match_overture(items, rows)
    assert list(found) == [0] and len(found[0]) == 1


def test_osm_jamais_remplace():
    tags = {"name": "X", "contact:phone": "+33 1 00 00 00 00"}
    assert add_extras(tags, {"phone": ["+33 1 11 11 11 11", "overture"], "website": ["https://x.fr", "overture"]})
    assert tags["contact:phone"] == "+33 1 00 00 00 00" and "phone" not in tags
    assert tags["website"] == "https://x.fr" and tags["_src"] == {"website": "overture"}
    assert not add_extras({"website": "https://osm.fr"}, {"website": ["https://x.fr", "overture"]})


# ——— Ville de Paris ———
from build_extras import day_hours, paris_opening_hours, paris_period, paris_rows, paris_keep


def test_horaires_du_jour():
    assert day_hours("07h00 - 08h30 / 11h30 - 13h30 / 16h45 - 22h00") == "07:00-08:30,11:30-13:30,16:45-22:00"
    assert day_hours("8h - 18h30") == "08:00-18:30"
    assert day_hours("10H - 19H") == "10:00-19:00"
    assert day_hours("08:00 - 20:30") == "08:00-20:30"
    assert day_hours("-") == "off" and day_hours("Fermé") == "off"
    assert day_hours("Accès libre") is None


def rec(**days):
    base = {f"horaires_{d}": "08h00 - 20h30" for d in ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")}
    base.update({f"horaires_{k}": v for k, v in days.items()})
    return base


def test_semaine_au_format_osm():
    assert paris_opening_hours(rec()) == "Mo-Su 08:00-20:30"
    assert paris_opening_hours(rec(samedi="09h00 - 20h30", dimanche="09h00 - 20h30")) == "Mo-Fr 08:00-20:30; Sa,Su 09:00-20:30"
    assert paris_opening_hours(rec(lundi="-")) == "Tu-Su 08:00-20:30"
    assert paris_opening_hours({"ouvert_24h": "Oui"}) == "24/7"
    assert paris_opening_hours(rec(mardi="Accès libre")) is None          # un jour illisible : rien plutôt que faux
    assert paris_opening_hours(rec(**{d: "-" for d in ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")})) is None


def test_periode_en_vigueur():
    assert paris_period("du 01/10/26 au 24/10/26", "2026-10-15") == "2026-10-24"
    assert paris_period("du 26/10/25 au 28/02/26", "2026-10-15") is None   # passée : horaires d'une autre saison
    assert paris_period("", "2026-10-15") == ""


def test_lignes_de_la_ville():
    recs = [dict(rec(), nom="SQUARE DU TEMPLE - ELIE WIESEL", type="Promenades ouvertes", horaires_periode="du 01/10/26 au 24/10/26",
                 geo_point_2d={"lat": 48.864, "lon": 2.360}),
            dict(rec(), nom="Ombrière", type="Ombrière pérenne", geo_point_2d={"lat": 48.8, "lon": 2.3}),
            dict(rec(), nom="Jardin X", type="Bois", horaires_periode="du 26/10/25 au 28/02/26", geo_point_2d={"lat": 48.8, "lon": 2.3})]
    assert paris_rows(recs, "2026-10-15") == [("SQUARE DU TEMPLE - ELIE WIESEL", 48.864, 2.360, "Mo-Su 08:00-20:30", "2026-10-24")]
    assert paris_keep({"leisure": "park"}) and paris_keep({"tourism": "museum"}) and not paris_keep({"amenity": "restaurant"})


def test_complement_perime_ignore():
    tags = {"name": "Square"}
    assert not add_extras(tags, {"opening_hours": ["Mo-Su 08:00-20:30", "paris", "2026-10-24"]}, today="2026-10-25")
    assert add_extras(tags, {"opening_hours": ["Mo-Su 08:00-20:30", "paris", "2026-10-24"]}, today="2026-10-15")
    assert tags["_src"] == {"opening_hours": "paris"}


# ——— Enseignes et annuaire ———
from build_extras import valid_hours, annuaire_hours, annuaire_keep


def test_horaires_valides():
    assert valid_hours("Mo-Fr 10:00-19:30; Sa 10:00-19:00")
    assert valid_hours("Mo closed; Tu-Fr 09:30-13:00,14:00-18:00; Su off")
    assert valid_hours("24/7")
    assert not valid_hours("Mo 14:00-18:30; Su clos")                       # « clos » n'est pas du format OSM
    assert not valid_hours("Fr 08:30-16:15,09:00-15:30")                    # plages qui se chevauchent
    assert not valid_hours("")


def test_annuaire():
    p = lambda a, b, h1, h2, h3="", h4="", c="": {"nom_jour_debut": a, "nom_jour_fin": b, "valeur_heure_debut_1": h1,
                                                  "valeur_heure_fin_1": h2, "valeur_heure_debut_2": h3, "valeur_heure_fin_2": h4, "commentaire": c}
    assert annuaire_hours([p("Lundi", "Vendredi", "08:30:00", "12:30:00", "13:30:00", "17:30:00")]) == "Mo-Fr 08:30-12:30,13:30-17:30"
    assert annuaire_hours([p("Lundi", "Vendredi", "09:00:00", "12:45:00", c="Uniquement sur rendez-vous.")]) is None
    assert annuaire_keep({"amenity": "townhall"}) and not annuaire_keep({"amenity": "school"}) and not annuaire_keep({"leisure": "park"})


def test_annuaire_permanence_ecartee():
    p = {"nom_jour_debut": "Jeudi", "nom_jour_fin": "Jeudi", "valeur_heure_debut_1": "09:00:00", "valeur_heure_fin_1": "17:00:00"}
    assert annuaire_hours([p]) is None


# ——— Horaires publiés par les sites des lieux (schema.org) ———
from build_sitehours import week_to_osm, from_spec, from_text, hours_in, wanted, similar


def test_semaine_vers_osm():
    w = [["12:00-14:30", "19:00-22:30"]] * 5 + [["19:00-23:00"], []]
    assert week_to_osm(w) == "Mo-Fr 12:00-14:30,19:00-22:30; Sa 19:00-23:00"
    assert week_to_osm([[]] * 7) is None


def test_specification_schema_org():
    spec = [{"@type": "OpeningHoursSpecification", "dayOfWeek": ["https://schema.org/Monday", "Tuesday"], "opens": "12:00:00", "closes": "14:30"},
            {"dayOfWeek": "Saturday", "opens": "19:00", "closes": "00:00"},
            {"dayOfWeek": "Sunday", "opens": "10:00", "closes": "12:00", "validFrom": "2026-12-25", "validThrough": "2026-12-25"}]
    assert from_spec(spec) == "Mo,Tu 12:00-14:30; Sa 19:00-24:00"
    assert from_text(["Mo-Fr 09:00-18:00", "Sa 10:00-12:00"]) == "Mo-Fr 09:00-18:00; Sa 10:00-12:00"


def test_page_du_lieu():
    page = ('<html><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Restaurant",'
            '"name":"Le Grand Pan","openingHours":"Mo-Fr 12:00-14:00,19:30-23:00"}]}</script></html>')
    assert hours_in(page, "Le Grand Pan") == "Mo-Fr 12:00-14:00,19:30-23:00"
    assert hours_in(page, "Chez Paul") is None                   # nom différent : horaires d'un autre établissement
    bad = page.replace("Mo-Fr 12:00-14:00,19:30-23:00", "Lundi midi")
    assert hours_in(bad, "Le Grand Pan") is None                 # format illisible : rien plutôt que faux


def test_lieux_cherches():
    assert wanted({"amenity": "restaurant"}) and wanted({"shop": "bakery"})
    assert not wanted({"amenity": "restaurant", "opening_hours": "Mo-Su 12:00-22:00"})
    assert not wanted({"amenity": "bank"})
    assert similar("Restaurant Petrus", "Petrus Paris") and not similar("Café de Paris", "Paris Brasserie")


# ——— Rythme des lectures et archive Common Crawl ———
from build_sitehours import due, norm_path, reg_candidates, host_of


def test_rythme_des_lectures():
    assert due(None, "2026-10-15")
    assert not due({"checked": "2026-10-01", "hours": "Mo-Fr 09:00-18:00"}, "2026-10-15")   # 14 jours : trop tôt
    assert due({"checked": "2026-09-10", "hours": "Mo-Fr 09:00-18:00"}, "2026-10-15")       # 35 jours : on relit
    assert not due({"checked": "2026-08-01", "hours": None}, "2026-10-15")                  # sans horaires : 75 jours, trop tôt
    assert due({"checked": "2026-07-01", "hours": None}, "2026-10-15")                      # 106 jours : on relit
    assert due({"checked": "2026-09-10", "hours": None, "via": "échec"}, "2026-10-15")      # injoignable : réessai à 28 jours
    assert not due({"checked": "2026-10-08", "hours": None, "via": "échec"}, "2026-10-15")


def test_adresses_archive():
    assert norm_path("") == "/" and norm_path("/fr/") == "/fr" and norm_path("/") == "/"
    assert host_of("https://www.Resto.fr/menu") == "www.resto.fr" and host_of("resto.fr") == "resto.fr"
    assert reg_candidates("resto.fr") == {"resto.fr"}
    assert reg_candidates("boutique.marque.co.uk") == {"co.uk", "marque.co.uk"}


def test_cle_archive():
    from build_sitehours import surt
    assert surt("https://www.Resto.fr/") == "fr,resto)/"
    assert surt("resto.fr") == "fr,resto)/"
    assert surt("https://www.5asec.fr/fr/Magasin/pressing/") == "fr,5asec)/fr/magasin/pressing"


def test_adresse_overture():
    from build_extras import street_address
    assert street_address("172 Bd Saint-Germain", "75006") == ("172", "Boulevard Saint-Germain", "75006")
    assert street_address("5 bis Av. de la République", "") == ("5 bis", "Avenue de la République", None)
    # adresses confuses : rien plutôt qu'une erreur
    assert street_address("Issy Coeur De Ville Rue Du General Leclerc 92130", "92130") is None
    assert street_address("Promenade Cœur de ville", None) is None
    tags = {"name": "Café de Flore"}
    add_extras(tags, {"addr": [["172", "Boulevard Saint-Germain", "75006"], "overture"]})
    assert tags["addr:street"] == "Boulevard Saint-Germain" and tags["_src"]["addr:street"] == "overture"
    osm = {"name": "X", "addr:street": "Rue Y"}
    add_extras(osm, {"addr": [["1", "Rue Z", None], "overture"]})
    assert osm["addr:street"] == "Rue Y"


def test_formats_neerlandais():
    """Pays-Bas (zones.json) : téléphones +31 et adresses « rue numéro » (Amsterdam, 30/10/2026)."""
    from build_extras import phone_nl, street_address_nl
    assert phone_nl("020 123 4567") == "+31 20 123 4567"
    assert phone_nl("+31612345678") == "+31 6 1234 5678"
    assert phone_nl("0031 299 123 456") == "+31 299 123 456"
    assert phone_nl("+33 1 23 45 67 89") is None
    assert street_address_nl("Amstelzijde 4", "1184 VA") == ("4", "Amstelzijde", "1184 VA")
    assert street_address_nl("Prinsengracht 263-267", "1016GV") == ("263-267", "Prinsengracht", "1016GV")
