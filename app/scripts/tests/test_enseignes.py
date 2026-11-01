"""Enseignes (build_overlays.richness) : un magasin d'enseigne passe devant, un restaurant de chaîne reste derrière."""
from types import SimpleNamespace

from build_overlays import richness


def tags(**kw):
    return [SimpleNamespace(k=k.replace("__", ":"), v=v) for k, v in kw.items()]


def test_magasin_d_enseigne_devant_un_magasin_ordinaire():
    seul = tags(name="Épicerie", shop="convenience")
    enseigne = tags(name="Monoprix", shop="supermarket", brand="Monoprix", brand__wikidata="Q3321241")
    assert richness(enseigne, "shop") > richness(seul, "shop")


def test_restaurant_de_chaine_derriere_un_restaurant_ordinaire():
    seul = tags(name="Chez Paul", amenity="restaurant")
    chaine = tags(name="Big Mamma", amenity="restaurant", brand="Big Mamma")
    assert richness(chaine, "food") < richness(seul, "food")


def test_traductions_du_nom_d_une_enseigne_ignorees():
    a = tags(name="Kruidvat", shop="chemist", brand="Kruidvat")
    b = tags(name="Kruidvat", shop="chemist", brand="Kruidvat", name__en="Kruidvat", name__de="Kruidvat", name__fr="Kruidvat")
    assert richness(a, "shop") + 0.5 >= richness(b, "shop")   # seul le nombre de clés bouge un peu
