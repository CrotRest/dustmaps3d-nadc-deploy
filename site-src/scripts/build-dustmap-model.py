"""Build the section-02 dust atlas straight from the dustmaps3d model (Wang et al. 2025).

Each slice is the mean dust density ΔE(B−V)/Δd [mag/kpc = mmag/pc] of a thin distance
shell, on a Galactic l, b grid. The model is sampled on a fine grid (FINE × the output
resolution), smoothed there with a Gaussian of σ = SMOOTH_DEG, then averaged down to the
output grid. The shells are log-spaced over D_MIN … D_MAX, the only range the page loops
through.

Run with the backend's environment (it has dustmaps3d and data_v3.fits):
  ../dustmaps3d-backend/.venv/bin/python scripts/build-dustmap-model.py public/dustmap

Output (what dustSky.js reads): PER_FILE slices per 8-bit PNG, stacked top to bottom
(atlas-0.png, atlas-1.png, …; each under the 16.7 Mpx canvas limit of iOS), 0 = no data,
1..255 = log10 density linear in [VMIN, VMAX]; within a slice row 0 = b +90, column 0 = l 0
increasing; and atlas.json with the grid and the distance of every slice.
"""
import json, os, sys, time
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from dustmaps3d import dustmaps3d

OUT_DIR = sys.argv[1]
NL, NB = 1280, 640                      # 0.28125° output cells
FINE = 4                                # model sampled on 5120 × 2560 (0.0703° cells)
COUNT = 40                              # shells over D_MIN … D_MAX
D_MIN, D_MAX = 0.3, 1.8                 # kpc
PER_FILE = 10                           # slices per PNG: 1280 × 6400 px
VMIN, VMAX = -4.0, float(np.log10(2.0)) # same colour scale as the earlier movie-based atlas
SMOOTH_DEG = 0.2                        # Gaussian σ on the fine l, b grid, in degrees

FL, FB = NL * FINE, NB * FINE
l = (np.arange(FL) + 0.5) * 360 / FL
b = 90 - (np.arange(FB) + 0.5) * 180 / FB
L, B = np.meshgrid(l, b)
lf, bf = L.ravel(), B.ravel()

# slice k is the shell between edges[k] and edges[k + 1]; its distance is their geometric mean
ratio = (D_MAX / D_MIN) ** (1 / (COUNT - 1))
centres = D_MIN * ratio ** np.arange(COUNT)
edges = np.concatenate([centres / np.sqrt(ratio), [centres[-1] * np.sqrt(ratio)]])

def ebv_at(d):
    return np.asarray(dustmaps3d(lf, bf, np.full(lf.size, d))[0], float).reshape(FB, FL)

sigma = SMOOTH_DEG / (180 / FB)         # in fine cells
files = (COUNT + PER_FILE - 1) // PER_FILE
atlas = np.zeros((COUNT, NB, NL), np.uint8)
t0 = time.time()
prev = ebv_at(edges[0])
for k in range(COUNT):
    nxt = ebv_at(edges[k + 1])
    rho = (nxt - prev) / (edges[k + 1] - edges[k])
    prev = nxt
    rho = gaussian_filter(np.where(np.isfinite(rho), np.maximum(rho, 0), 0), sigma, mode=('nearest', 'wrap'))
    rho = rho.reshape(NB, FINE, NL, FINE).mean(axis=(1, 3))
    code = 1 + np.round(254 * np.clip((np.log10(np.maximum(rho, 1e-12)) - VMIN) / (VMAX - VMIN), 0, 1))
    atlas[k] = code.astype(np.uint8)
    print(f'slice {k + 1}/{COUNT}  d = {centres[k]:.3f} kpc  ({time.time() - t0:.0f} s)', flush=True)

names = []
for i in range(files):
    names.append(f'atlas-{i}.png')
    Image.fromarray(atlas[i * PER_FILE:(i + 1) * PER_FILE].reshape(-1, NL), 'L').save(os.path.join(OUT_DIR, names[-1]), optimize=True)
json.dump({
    'nl': NL, 'nb': NB, 'count': COUNT, 'perFile': PER_FILE, 'files': names, 'vmin': VMIN, 'vmax': VMAX,
    'encoding': '0 = no data; 1..255 -> log10 dE(B-V)/dd [mmag/pc] linear in [vmin, vmax]; slices stacked top to bottom, perFile per PNG; row 0 = b +90, column 0 = l 0 increasing',
    'source': f'dustmaps3d model (Wang et al. 2025), shell-mean density, sampled at {180 / FB:.4f} deg, Gaussian sigma {SMOOTH_DEG} deg, averaged to {180 / NB:.4f} deg',
    'kpc': [round(float(x), 5) for x in centres],
}, open(os.path.join(OUT_DIR, 'atlas.json'), 'w'))
print('done', atlas.shape)
