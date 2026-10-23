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
