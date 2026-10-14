"""Invert the Mollweide frames of dust.mp4 back into log10 ΔE(B−V) grids.

Output: an atlas PNG (8-bit, 0 = no data, 1..255 = log10 value in [-4, log10 2])
and a JSON with the distance of every slice.
"""
import json, subprocess, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT_PNG, OUT_JSON = sys.argv[2], sys.argv[3]
W, H = 2528, 1408
CX, CY, A, B = 1292.5, 629.0, 1196.0, 597.0          # ellipse interior (px)
CB_X0, CB_X1, CB_Y0, CB_Y1 = 97, 2489, 1265, 1311      # colour-bar interior
VMIN, VMAX = -4.0, np.log10(2.0)
NL, NB = 320, 160                                      # output grid
STEP = 4                                               # every 4th frame -> 100 slices
SUB = 3                                                # 3x3 samples per cell

def read_frames():
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', SRC, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    n = 0
    while True:
        buf = p.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        yield n, np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        n += 1

frames = read_frames()
n0, first = next(frames)

# ---- colour bar -> LUT, then a 32^3 RGB cube of nearest values ----
bar = np.median(first[CB_Y0:CB_Y1, CB_X0:CB_X1].astype(float), axis=0)          # (N, 3)
vals = VMIN + (VMAX - VMIN) * (np.arange(bar.shape[0]) + 0.5) / bar.shape[0]
bar, vals = bar[::4], vals[::4]
q = (np.arange(32) * 8 + 4).astype(float)
cube = np.stack(np.meshgrid(q, q, q, indexing='ij'), -1).reshape(-1, 3)
d2 = ((cube[:, None, :] - bar[None, :, :]) ** 2).sum(-1)
best = d2.argmin(1)
cube_val = vals[best].reshape(32, 32, 32)
cube_dist = np.sqrt(d2.min(1)).reshape(32, 32, 32)

# ---- sample positions: (l, b) cell sub-samples -> Mollweide pixels ----
ls = (np.arange(NL * SUB) + 0.5) / (NL * SUB) * 360.0       # l from 0..360 (column 0 = l 0)
bs = 90.0 - (np.arange(NB * SUB) + 0.5) / (NB * SUB) * 180.0  # row 0 = b +90
L, Bg = np.meshgrid(ls, bs)
lam = np.radians(np.where(L > 180, L - 360, L))
phi = np.radians(Bg)
th = phi.copy()
for _ in range(30):
    f = 2 * th + np.sin(2 * th) - np.pi * np.sin(phi)
    th -= f / (2 + 2 * np.cos(2 * th) + 1e-9)
pxf = CX - A * (lam / np.pi) * np.cos(th)   # l grows to the left
pyf = CY - B * np.sin(th)
px = np.clip(np.round(pxf), 0, W - 1).astype(int)
py = np.clip(np.round(pyf), 0, H - 1).astype(int)

# the figure's own graticule (b = 0, ±30, ±60; l = 0, 60, 120, 240, 300) and the
# longitude labels on the equator sit on top of the data: never sample them
def theta_of(b_deg):
    p = np.radians(b_deg); t = p
    for _ in range(30):
        t -= (2 * t + np.sin(2 * t) - np.pi * np.sin(p)) / (2 + 2 * np.cos(2 * t) + 1e-9)
    return t
overlay = np.zeros_like(pxf, bool)
for bg in (0, 30, -30, 60, -60):
    overlay |= np.abs(pyf - (CY - B * np.sin(theta_of(bg)))) <= 5.5
cos_y = np.sqrt(np.clip(1 - ((CY - pyf) / B) ** 2, 0, 1))
for lg in (0, 60, 120, -60, -120):
    xg = CX - A * (np.radians(lg) / np.pi) * cos_y
    overlay |= np.abs(pxf - xg) <= 5.5
    overlay |= (np.abs(pxf - (CX - A * np.radians(lg) / np.pi)) <= 70) & (pyf >= 566) & (pyf <= 626)

def frame_grid(img):
    rgb = img[py, px].astype(int)                                 # (NB*SUB, NL*SUB, 3)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    v = cube_val[r >> 3, g >> 3, b >> 3]
    dist = cube_dist[r >> 3, g >> 3, b >> 3]
    grey = (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b) < 14) & (r > 70) & (r < 200)
    valid = ~overlay & ~grey & (dist <= 40)
    nodata = ~overlay & grey
    def cells(x):
        return x.reshape(NB, SUB, NL, SUB).transpose(0, 2, 1, 3).reshape(NB, NL, SUB * SUB)
    vv = cells(np.where(valid, v, np.nan))
    n_ok = np.isfinite(vv).sum(-1)
    n_nd = cells(nodata).sum(-1)
    med = np.full((NB, NL), np.nan)
    has = n_ok >= 2
    med[has] = np.nanmedian(vv[has], axis=-1)
    # cells hidden under the overlay: copy a random valid cell from the neighbourhood,
    # which keeps the grainy texture instead of smearing a flat patch
    fill = ~has & (n_nd < 2)
    rng = np.random.default_rng(7)
    src = med.copy()
    for rr, cc in zip(*np.where(fill)):
        for rad in (3, 5, 8, 12):
            r0, r1 = max(0, rr - rad), min(NB, rr + rad + 1)
            cand = src[r0:r1, [(cc + k) % NL for k in range(-rad * 2, rad * 2 + 1)]]
            ok = cand[np.isfinite(cand)]
            if ok.size >= 3:
                med[rr, cc] = rng.choice(ok)
                break
    return med

slices, dists = [], []
def take(n, img):
    g = frame_grid(img)
    enc = np.where(np.isfinite(g), 1 + np.round(254 * np.clip((g - VMIN) / (VMAX - VMIN), 0, 1)), 0).astype(np.uint8)
    slices.append(enc)
    dists.append(round(0.1 * 200 ** (n / 399), 5))

take(n0, first)
for n, img in frames:
    if n % STEP == 0:
        take(n, img)
        if len(slices) % 10 == 0:
            print('slices', len(slices), flush=True)

cols = 10
rows = (len(slices) + cols - 1) // cols
atlas = np.zeros((rows * NB, cols * NL), np.uint8)
for i, s in enumerate(slices):
    atlas[(i // cols) * NB:(i // cols + 1) * NB, (i % cols) * NL:(i % cols + 1) * NL] = s
Image.fromarray(atlas, 'L').save(OUT_PNG, optimize=True)
json.dump({'nl': NL, 'nb': NB, 'cols': cols, 'rows': rows, 'count': len(slices), 'vmin': VMIN, 'vmax': round(VMAX, 5),
           'encoding': '0 = no data; 1..255 -> log10 dE(B-V) [mmag/pc] linear in [vmin, vmax]; tile row 0 = b +90, column 0 = l 0 increasing',
           'kpc': dists, 'source': 'dust.mp4 (Galactic Mollweide maps of dE(B-V), frames 0,4,...,396), inverted through the figure colour bar'},
          open(OUT_JSON, 'w'), separators=(',', ':'))
print('done', len(slices), atlas.shape)
