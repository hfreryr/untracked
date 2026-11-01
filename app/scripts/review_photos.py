"""Photos des avis Mangrove copiées chez nous (01/11/2026), pour que la fiche les montre sans que le téléphone contacte
Mangrove (comme le texte des avis, rangé dans les tuiles). Licence : CC BY 4.0 (conditions de Mangrove : « when you
submit content, you agree to license it under CC BY 4.0 », vérifiées le 01/11/2026) ; l'auteur (pseudo) est affiché.

Pour chaque photo : <dossier>/photos/<id>.jpg (1 400 px au plus, pour le plein écran) et <id>.t.jpg (480 px, la vignette).
Recompressées en JPEG : les métadonnées (position GPS, appareil) disparaissent. Une photo illisible est retirée de la fiche.
"""
import io
import os
import urllib.request

FILES = "https://files.mangrove.reviews/"
UA = "UntrackedMaps/0.2 (https://untrackedmaps.app; photos des avis)"
SIZES = (("", 1400), (".t", 480))


def save_sizes(raw, base):
    """Image → fichiers JPEG aux tailles voulues (sans métadonnées, orientation appliquée)."""
    from PIL import Image, ImageOps
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    for suffix, px in SIZES:
        c = im.copy()
        c.thumbnail((px, px))
        c.save(f"{base}{suffix}.jpg", "JPEG", quality=82, optimize=True)


def copy_photos(tiles, out_dir, get=None):
    """Copie les photos citées par les avis des tuiles (étiquette « _rev » → « ph ») ; renvoie le nombre copié."""
    get = get or (lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=30).read(15_000_000))
    d = os.path.join(out_dir, "photos")
    done, n = {}, 0
    for items in tiles.values():
        for it in items:
            rev = it[3].get("_rev")
            if not rev or not rev.get("ph"):
                continue
            kept = []
            for ph in rev["ph"]:
                pid = ph[0]
                if pid not in done:
                    try:
                        os.makedirs(d, exist_ok=True)
                        save_sizes(get(FILES + pid), os.path.join(d, pid))
                        done[pid] = True
                        n += 1
                    except Exception:
                        done[pid] = False
                if done[pid]:
                    kept.append(ph)
            if kept:
                rev["ph"] = kept
            else:
                rev.pop("ph")
    return n
