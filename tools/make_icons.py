"""Génère les icônes de l'application (écran d'accueil iPhone, Android, favicon).

Usage : python tools/make_icons.py   (depuis la racine du dépôt, nécessite Pillow)
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

NAVY, DEEP, CREAM = (31, 42, 68), (16, 22, 43), (245, 233, 207)
ORANGE, YELLOW, GREEN, PINK = (242, 106, 61), (245, 196, 69), (168, 230, 161), (232, 69, 107)
S = 2048  # dessin en grand, puis réduction pour un bord lisse
OUT = Path(__file__).resolve().parent.parent / "public"
# Sources des icônes et écrans de démarrage des apps Android et iOS (lues par @capacitor/assets).
APP = Path(__file__).resolve().parent.parent / "assets"


def draw_icon():
    img = Image.new("RGB", (S, S), DEEP)
    d = ImageDraw.Draw(img)
    cx, cy = S / 2, S / 2

    # Halo central
    glow = Image.new("RGB", (S, S), DEEP)
    ImageDraw.Draw(glow).ellipse([cx - 760, cy - 760, cx + 760, cy + 760], fill=(44, 60, 104))
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(220)), 0.9)
    d = ImageDraw.Draw(img)

    # Rayons façon affiche rétro
    for i in range(16):
        a0, a1 = math.radians(i * 22.5 - 4), math.radians(i * 22.5 + 4)
        d.polygon([(cx, cy), (cx + math.cos(a0) * 1700, cy + math.sin(a0) * 1700), (cx + math.cos(a1) * 1700, cy + math.sin(a1) * 1700)], fill=(38, 52, 92))

    # Étoiles
    rnd = random.Random(7)
    for _ in range(46):
        x, y, r = rnd.uniform(60, S - 60), rnd.uniform(60, S - 60), rnd.choice([7, 9, 12, 16])
        if math.hypot(x - cx, y - cy) > 640:
            d.ellipse([x - r, y - r, x + r, y + r], fill=rnd.choice([CREAM, CREAM, YELLOW, (143, 216, 204)]))

    w = 44  # épaisseur du contour

    # Anneau de planète derrière la tête
    ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse([cx - 900, cy + 40, cx + 900, cy + 480], outline=NAVY, width=150)
    rd.ellipse([cx - 880, cy + 60, cx + 880, cy + 460], outline=ORANGE, width=96)
    ring = ring.rotate(14, center=(cx, cy), resample=Image.BICUBIC)
    img.paste(ring, (0, 0), ring)
    d = ImageDraw.Draw(img)

    # Robe
    d.pieslice([cx - 600, cy + 420, cx + 600, cy + 1500], 180, 360, fill=YELLOW, outline=NAVY, width=w)

    # Tête de martien
    head = [cx - 620, cy - 600, cx + 620, cy + 520]
    d.ellipse(head, fill=GREEN, outline=NAVY, width=w)
    # Plis du cerveau
    for k in range(4):
        x0 = cx - 380 + k * 190
        d.arc([x0, cy - 470, x0 + 190, cy - 330], 180, 360, fill=NAVY, width=26)

    # Trois yeux
    for ex, ey, er in [(-330, 20, 150), (0, -90, 185), (330, 20, 150)]:
        d.ellipse([cx + ex - er, cy + ey - er, cx + ex + er, cy + ey + er], fill=CREAM, outline=NAVY, width=w)
        pr = er * 0.42
        d.ellipse([cx + ex - pr + 14, cy + ey - pr + 16, cx + ex + pr + 14, cy + ey + pr + 16], fill=NAVY)
        d.ellipse([cx + ex - pr * 0.1, cy + ey - pr * 0.75, cx + ex + pr * 0.45, cy + ey - pr * 0.2], fill=CREAM)

    # Sourire en coin
    d.arc([cx - 170, cy + 200, cx + 170, cy + 400], 20, 160, fill=NAVY, width=40)

    # Couronne
    base, top = cy - 560, cy - 900
    pts = [(cx - 330, base), (cx - 350, top + 70), (cx - 165, top + 210), (cx, top), (cx + 165, top + 210), (cx + 350, top + 70), (cx + 330, base)]
    d.polygon(pts, fill=YELLOW, outline=NAVY)
    d.line(pts + [pts[0]], fill=NAVY, width=w, joint="curve")
    for px, py in [(cx - 350, top + 70), (cx, top), (cx + 350, top + 70)]:
        d.ellipse([px - 52, py - 52, px + 52, py + 52], fill=CREAM, outline=NAVY, width=30)
    d.ellipse([cx - 44, base - 150, cx + 44, base - 62], fill=PINK, outline=NAVY, width=22)
    return img


def main():
    icon = draw_icon()
    for size in (512, 192, 180, 32):
        name = "favicon.png" if size == 32 else f"icon-{size}.png"
        icon.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print("écrit", name)
    APP.mkdir(exist_ok=True)
    icon.resize((1024, 1024), Image.LANCZOS).save(APP / "icon-only.png", optimize=True)
    # Écran de démarrage : fond de l'espace, icône arrondie au centre.
    splash = Image.new("RGB", (2732, 2732), DEEP)
    logo = icon.resize((820, 820), Image.LANCZOS)
    mask = Image.new("L", logo.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *logo.size], radius=180, fill=255)
    splash.paste(logo, ((2732 - 820) // 2, (2732 - 820) // 2), mask)
    splash.save(APP / "splash.png", optimize=True)
    splash.save(APP / "splash-dark.png", optimize=True)
    print("écrit assets/icon-only.png, assets/splash.png, assets/splash-dark.png")


if __name__ == "__main__":
    main()
