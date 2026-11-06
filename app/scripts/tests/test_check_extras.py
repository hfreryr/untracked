from check_extras import verdict, counts


def _ex(n, wph=0, wt=0):
    return {"places": {str(i): {"website": ["x", "overture"], **({"_wph": [[], "wikimedia"]} if i < wph else {}),
                                 **({"_wt": ["t", "wikipedia"]} if i < wt else {})} for i in range(n)}}


def test_photos_wikimedia_disparues_publication_refusee():
    """02/11/2026 : compléments publiés sans aucune photo Wikimedia ni article ; aujourd'hui, refusé."""
    ok, why = verdict(_ex(1000, wph=0, wt=0), _ex(1000, wph=400, wt=300))
    assert not ok and "photos Wikimedia : 400 → 0" in why


def test_petite_variation_acceptee_et_premiere_fois():
    assert verdict(_ex(1000, wph=390), _ex(1000, wph=400))[0]
    assert verdict(_ex(10), None)[0]
    assert counts(_ex(3, wph=1))["photos Wikimedia"] == 1
