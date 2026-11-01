"""Devantures (build_facades.py) : l'hôte noté est celui de l'instance Panoramax, jamais celui de son stockage."""
from build_facades import instance_host

S3 = "https://panoramax-storage-public-fast.s3.gra.perf.cloud.ovh.net/main-pictures/a4/d6/22/ec/bf42.jpg"


def test_lien_via_prioritaire_sur_l_image_en_s3():
    # réponse réelle du méta-catalogue (01/11/2026) pour une photo IGN servie depuis S3
    f = {"properties": {"geovisio:image": S3},
         "links": [{"rel": "self", "href": "https://api.panoramax.xyz/api/collections/c/items/i"},
                   {"rel": "via", "href": "https://panoramax.ign.fr", "instance_name": "ign"}]}
    assert instance_host(f) == "panoramax.ign.fr"


def test_sans_lien_via():
    assert instance_host({"properties": {"geovisio:image": "https://panoramax.openstreetmap.fr/api/pictures/x/hd.jpg"}}) == "panoramax.openstreetmap.fr"
    assert instance_host({"properties": {"geovisio:image": S3}}) == ""   # stockage : photo écartée plutôt que cassée
