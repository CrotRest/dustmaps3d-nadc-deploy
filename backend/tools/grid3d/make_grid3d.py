#!/usr/bin/env python3
"""Build the DPR 3D grid (XYZ.parquet / grid3d.parquet) with bounded memory.

Same grid, query, masking and smoothing as Data_preparation_1.py (Tao Wang,
2026-01-09), but the dustmaps3d query runs in X-slabs so ~72 M points fit in
a few GB of RAM, and only the smoothed cube the backend needs is written.

    python make_grid3d.py OUT.parquet [--chunk-slabs 40]
    python make_grid3d.py OUT.parquet --check   # small grid vs Data_preparation_1
"""

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import Data_preparation_1 as dp  # noqa: E402


def axis(rng, step):
    return np.arange(rng[0] + step / 2, rng[1] + step / 2, step)


def smoothed_cube(xrng, yrng, zrng, step, sigma, chunk_slabs, log=print):
    xv, yv, zv = axis(xrng, step), axis(yrng, step), axis(zrng, step)
    nx, ny, nz = len(xv), len(yv), len(zv)
    raw = np.empty((nx, ny, nz), dtype=np.float32)
    Yg, Zg = np.meshgrid(yv, zv, indexing="ij")
    t0 = time.time()
    for i0 in range(0, nx, chunk_slabs):
        i1 = min(nx, i0 + chunk_slabs)
        x = np.repeat(xv[i0:i1], ny * nz).astype(np.float32)
        y = np.tile(Yg.ravel(), i1 - i0).astype(np.float32)
        z = np.tile(Zg.ravel(), i1 - i0).astype(np.float32)
        l, b, d = dp.to_galactic(x, y, z)
        dust_raw, dmax = dp.query_dust(l, b, d)
        masked = np.where(d <= dmax, dust_raw, np.nan).astype(np.float32)
        finite = ~np.isnan(masked)
        masked[finite & (masked < 1e-4)] = 0.0
        raw[i0:i1] = masked.reshape(i1 - i0, ny, nz)
        log(f"  slabs {i1}/{nx}  ({time.time() - t0:.0f} s)")
    nan_mask = np.isnan(raw)
    filled = dp.nearest_fill_3d(raw, nan_mask)
    smooth = dp.gaussian_filter(filled, sigma=sigma)
    smooth[nan_mask] = np.nan
    Xg, Yg3, Zg3 = np.meshgrid(xv, yv, zv, indexing="ij")
    return pd.DataFrame({
        "X": Xg.ravel().astype(np.float32),
        "Y": Yg3.ravel().astype(np.float32),
        "Z": Zg3.ravel().astype(np.float32),
        "dust": smooth.ravel().astype(np.float32),
    })


def check(out):
    """Compare against Data_preparation_1's own code path on a small grid."""
    xr, yr, zr = (0.5, 0.8), (-0.3, 0.0), (-0.1, 0.1)
    df = smoothed_cube(xr, yr, zr, dp.STEP, dp.SMOOTH_SIGMA, chunk_slabs=7, log=lambda *_: None)
    x, y, z = dp.build_grid(xr, yr, zr, dp.STEP)
    l, b, d = dp.to_galactic(x, y, z)
    dust_raw, dmax = dp.query_dust(l, b, d)
    m = np.where(d <= dmax, dust_raw, np.nan).astype(np.float32)
    m[(~np.isnan(m)) & (m < 1e-4)] = 0.0
    arr = m.reshape(len(axis(xr, dp.STEP)), len(axis(yr, dp.STEP)), len(axis(zr, dp.STEP)))
    nan = np.isnan(arr)
    ref = dp.gaussian_filter(dp.nearest_fill_3d(arr, nan), sigma=dp.SMOOTH_SIGMA)
    ref[nan] = np.nan
    same_xyz = np.array_equal(df[["X", "Y", "Z"]].to_numpy(), np.c_[x, y, z])
    same_dust = np.array_equal(df["dust"].to_numpy(), ref.ravel().astype(np.float32), equal_nan=True)
    print(f"check: {len(df)} cells, XYZ identical={same_xyz}, dust identical={same_dust}")
    return same_xyz and same_dust


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path)
    ap.add_argument("--chunk-slabs", type=int, default=40)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if a.check:
        sys.exit(0 if check(a.out) else 1)
    df = smoothed_cube(dp.GRID_X, dp.GRID_Y, dp.GRID_Z, dp.STEP, dp.SMOOTH_SIGMA, a.chunk_slabs)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(a.out, index=False)
    print(f"saved {a.out}  ({len(df)} rows, {a.out.stat().st_size / 2**20:.1f} MiB)")


if __name__ == "__main__":
    main()
