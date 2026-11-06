import datetime
from health_check import check_index, check_extras

TODAY = datetime.date(2026, 11, 6)


def test_zone_trop_ancienne_ou_photos_a_zero():
    idx = {"count": 1000, "built": "2026-10-25T10:00:00Z", "metrics": {"wiki_photos": 0, "site_photos": 12, "hours": 40}}
    p = check_index("Bourgogne", idx, TODAY, "zone")
    assert any("12 jours" in x for x in p) and any("wiki_photos = 0" in x for x in p)
    assert check_index("Bourgogne", None, TODAY, "zone") == ["Bourgogne : aucune donnée en ligne"]
    assert check_index("Bretagne", {"count": 9, "built": "2026-11-05T10:00:00Z"}, TODAY, "zone") == []


def test_complements_sans_photos():
    """Le cas du 02/11/2026 : compléments d'Île-de-France sans photo Wikimedia ni article."""
    p = check_extras({"places": {str(i): {"website": 1, "_photo": 1} for i in range(500)}})
    assert any("photos Wikimedia" in x for x in p) and any("articles" in x for x in p) and not any("sites" in x for x in p)
