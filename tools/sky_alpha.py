"""Make the dark sky of the painted backgrounds see-through, so the game's animated starfield shows behind them.

Only the dark area connected to the top or the sides of the picture is cut (outlines inside the ground stay opaque); bright
painted stars, planets and ground keep full opacity. `base` keeps a tint of the original sky (Mars red, Saturn violet).
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC, OUT, CHECK = sys.argv[1], sys.argv[2], sys.argv[3]
# scene: (source picture number, sky opacity kept, horizon: nothing below this height is cut, as a share of the height)
SCENES = {"espace": (4, 0.0, 1), "lune": (5, 0.0, 1), "mars": (6, 0.45, 1), "saturne": (10, 0.0, 1), "neptune": (11, 0.25, 1),
          "jupiter": (12, 0.4, 0.78), "bonbon": (13, 0.45, 1), "neon": (14, 0.35, 0.78), "nebuleuse": (15, 0.4, 1)}
T = 0.17

for name, (n, base, horizon) in SCENES.items():
    rgb = np.asarray(Image.open(f"{SRC}/{n}.webp").convert("RGB")).astype(np.float32) / 255
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    dark = lum < T
    dark[int(horizon * dark.shape[0]):] = False
    # Grain specks inside the sky are not objects: close them, but never over bright pixels (stars).
    dark = ndimage.binary_closing(dark, iterations=2) & (lum < 0.32)
    labels, _ = ndimage.label(dark)
    # The sky touches the top edge, or the sides when a planet fills the top (Jupiter).
    top = set(np.unique(np.concatenate([labels[:6].ravel(), labels[:, :4].ravel(), labels[:, -4:].ravel()]))) - {0}
    sky = np.isin(labels, list(top))
    # Soft edge: fully see-through deep in the sky, back to opaque on the border and on lighter pixels.
    ramp = np.clip((lum - (T - 0.06)) / 0.08, 0, 1)
    alpha = np.where(sky, np.maximum(base, ramp), 1.0)
    if horizon < 1:
        # Fade back to opaque just above the horizon, so no straight seam shows where the cut stops.
        rows = np.linspace(0, 1, alpha.shape[0])[:, None]
        alpha = np.maximum(alpha, np.clip((rows - (horizon - 0.07)) / 0.07, 0, 1))
    alpha = ndimage.gaussian_filter(alpha, 0.8)
    rgba = np.dstack([rgb, alpha]).clip(0, 1)
    img = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")
    img.save(f"{OUT}/{name}.webp", "WEBP", quality=80, method=6)
    # Check sheet: the picture over a bright test colour shows exactly what became transparent.
    bg = Image.new("RGBA", img.size, (255, 0, 200, 255))
    Image.alpha_composite(bg, img).convert("RGB").resize((img.width // 3, img.height // 3)).save(f"{CHECK}/{name}.png")
    print(name, f"sky {sky.mean():.0%}")
