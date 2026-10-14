"""Build the section-02 dust atlas straight from the dustmaps3d model (Wang et al. 2025).

Each slice is the mean dust density ΔE(B−V)/Δd [mag/kpc = mmag/pc] of a thin distance
shell, on a Galactic l, b grid, lightly smoothed on the sky. The shells are log-spaced
over D_MIN … D_MAX, the only range the page loops through.

Run with the backend's environment (it has dustmaps3d and data_v3.fits):
  ../dustmaps3d-backend/.venv/bin/python scripts/build-dustmap-model.py public/dustmap/atlas.png public/dustmap/atlas.json

Output (same format dustSky.js reads): an 8-bit atlas PNG, 0 = no data, 1..255 = log10
density linear in [VMIN, VMAX]; tile row 0 = b +90, column 0 = l 0 increasing; and a JSON
with the grid and the distance of every slice.
"""
import json, sys, time
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from dustmaps3d import dustmaps3d

OUT_PNG, OUT_JSON = sys.argv[1], sys.argv[2]
NL, NB = 640, 320                       # 0.5625° cells
COUNT = 40                              # shells over D_MIN … D_MAX
D_MIN, D_MAX = 0.3, 1.8                 # kpc
COLS = 6                                # 6 × 7 tiles = 3840 × 2240 px, under the 4096 texture limit of phones
VMIN, VMAX = -4.0, float(np.log10(2.0)) # same colour scale as the earlier movie-based atlas
SMOOTH_CELLS = 0.6                      # Gaussian σ on the sky, in cells (≈ 0.34°)

l = (np.arange(NL) + 0.5) * 360 / NL
b = 90 - (np.arange(NB) + 0.5) * 180 / NB
L, B = np.meshgrid(l, b)
lf, bf = L.ravel(), B.ravel()

# slice k is the shell between edges[k] and edges[k + 1]; its distance is their geometric mean
ratio = (D_MAX / D_MIN) ** (1 / (COUNT - 1))
centres = D_MIN * ratio ** np.arange(COUNT)
edges = np.concatenate([centres / np.sqrt(ratio), [centres[-1] * np.sqrt(ratio)]])

def ebv_at(d):
    return np.asarray(dustmaps3d(lf, bf, np.full(lf.size, d))[0], float).reshape(NB, NL)

rows = (COUNT + COLS - 1) // COLS
atlas = np.zeros((rows * NB, COLS * NL), np.uint8)
t0 = time.time()
prev = ebv_at(edges[0])
for k in range(COUNT):
    nxt = ebv_at(edges[k + 1])
    rho = (nxt - prev) / (edges[k + 1] - edges[k])
    prev = nxt
    rho = gaussian_filter(np.where(np.isfinite(rho), np.maximum(rho, 0), 0), SMOOTH_CELLS, mode=('nearest', 'wrap'))
    code = 1 + np.round(254 * np.clip((np.log10(np.maximum(rho, 1e-12)) - VMIN) / (VMAX - VMIN), 0, 1))
    r, c = divmod(k, COLS)
    atlas[r * NB:(r + 1) * NB, c * NL:(c + 1) * NL] = code.astype(np.uint8)
    print(f'slice {k + 1}/{COUNT}  d = {centres[k]:.3f} kpc  ({time.time() - t0:.0f} s)', flush=True)

Image.fromarray(atlas, 'L').save(OUT_PNG, optimize=True)
json.dump({
    'nl': NL, 'nb': NB, 'cols': COLS, 'rows': rows, 'count': COUNT, 'vmin': VMIN, 'vmax': VMAX,
    'encoding': '0 = no data; 1..255 -> log10 dE(B-V)/dd [mmag/pc] linear in [vmin, vmax]; tile row 0 = b +90, column 0 = l 0 increasing',
    'source': f'dustmaps3d model (Wang et al. 2025), shell-mean density, Gaussian sigma {SMOOTH_CELLS} cells',
    'kpc': [round(float(x), 5) for x in centres],
}, open(OUT_JSON, 'w'))
print('done', atlas.shape)
