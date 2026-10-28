"""Turn the lossless section-02 atlas (build-dustmap-model.py's output) into what the page loads.

One lossy WebP per distance shell, at the full 1280 × 640 (≈120 KB each, ≈5 MB in all), so
the page can stream them nearest first: the map shows, sharp, as soon as the first shell is
in, and the distance sweep plays through the shells that have arrived.

At high latitude the map is mostly noise of the model (few stars, large errors), and noise
is what makes the files big, so there each slice is smoothed by a Gaussian whose σ grows
gradually with |b|: nothing at all within |b| ≤ HILAT_B, then rising smoothly (smoothstep in
|b|) to HILAT_SIGMA_DEG at the poles. Each row takes the blend of the two precomputed blur
levels around its own σ, so no edge shows where smoothing begins. The plane is untouched apart
from the WebP rounding: mean |error| ≈ 1.5 codes (0.03 dex)  at QUALITY, against 0.017 dex
per code. Lossy coding can turn the faintest codes (1–2, the
black end of the colour bar) into 0; dustSky.js reads codes below 3 as no data.

  ../dustmaps3d-backend/.venv/bin/python scripts/build-dustmap-web.py data/dustmap public/dustmap
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SRC, OUT = sys.argv[1], sys.argv[2]
HILAT_B = 25.0                          # degrees: no smoothing at all within |b| ≤ this
HILAT_SIGMA_DEG = 1.7                   # σ reached at the poles
SIGMA_LEVELS = 8                        # precomputed blur levels between 0 and HILAT_SIGMA_DEG
QUALITY = 90

meta = json.load(open(os.path.join(SRC, 'atlas.json')))
nl, nb, count, per = meta['nl'], meta['nb'], meta['count'], meta['perFile']
full = np.concatenate([np.array(Image.open(os.path.join(SRC, f))) for f in meta['files']])
full = full[:count * nb].reshape(count, nb, nl)


def hilat_smooth(a):
    rows, cols = a.shape[1:]
    b = 90 - (np.arange(rows) + 0.5) * 180 / rows
    x = np.clip((np.abs(b) - HILAT_B) / (90 - HILAT_B), 0, 1)
    want = x * x * (3 - 2 * x) * (SIGMA_LEVELS - 1)    # per row, in units of blur levels
    lo = np.floor(want).astype(int)
    hi = np.minimum(lo + 1, SIGMA_LEVELS - 1)
    f = (want - lo)[:, None]
    sigmas = np.linspace(0, HILAT_SIGMA_DEG, SIGMA_LEVELS) / (180 / rows)   # in cells
    mode = ('nearest', 'wrap')
    out = np.empty_like(a)
    for k in range(a.shape[0]):
        s = a[k].astype(np.float64)
        has = (s > 0).astype(np.float64)
        levels = [s] + [gaussian_filter(s * has, sg, mode=mode) / np.maximum(gaussian_filter(has, sg, mode=mode), 1e-6) for sg in sigmas[1:]]
        levels = np.stack(levels)
        rows_idx = np.arange(rows)
        mixed = levels[lo, rows_idx] * (1 - f) + levels[hi, rows_idx] * f
        out[k] = np.where(s > 0, np.clip(np.round(mixed), 1, 255), 0)
    return out


def save(a, name, quality):
    Image.fromarray(a.reshape(-1, a.shape[-1]), 'L').save(os.path.join(OUT, name), 'WEBP', quality=quality, method=6)
    return name


os.makedirs(OUT, exist_ok=True)
for old in os.listdir(OUT):
    if old.startswith('atlas') and old.endswith(('.webp', '.png')):
        os.remove(os.path.join(OUT, old))
smoothed = hilat_smooth(full)
files = [save(smoothed[k:k + 1], f'atlas-s{k:02d}.webp', QUALITY) for k in range(count)]

web = dict(meta, files=files, perFile=1)
web['encoding'] = meta['encoding'] + f'; one lossy WebP per slice (codes < 3 = no data); above |b| = {HILAT_B:g} deg smoothed with sigma rising smoothly to {HILAT_SIGMA_DEG} deg at the poles'
json.dump(web, open(os.path.join(OUT, 'atlas.json'), 'w'))
print(len(files), 'files', sum(os.path.getsize(os.path.join(OUT, f)) for f in files) // 1024, 'KB, first', os.path.getsize(os.path.join(OUT, files[0])) // 1024, 'KB')
