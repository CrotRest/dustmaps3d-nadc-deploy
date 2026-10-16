#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Data Preparation 1 — Generate dust data products (raw 3D, smoothed 3D, 2D mean, RW along-path slice)

This script builds a Sun-centered Galactic Cartesian grid (X, Y, Z) in kpc,
queries the Wang et al. (2025) all-sky 3D dust map via `dustmaps3d`, and
produces four downstream-ready files:

1) data/xyz_dust.parquet       Raw 3D cube (X,Y,Z,dust_raw)
2) data/XYZ.parquet            Smoothed 3D cube (X,Y,Z,dust)
3) data/dust_map_2d.parquet    Mean over |Z|<=0.3 kpc on (X,Y)
4) data/dust_map_s.csv         Radcliffe Wave (RW) along-path dust slice

Notes
- Units: X,Y,Z in kpc; dust in mag/kpc; angles in degrees.
- Out-of-range samples (beyond the model max distance) are masked.
- Smoothing uses a Gaussian kernel after nearest-neighbor fill of NaNs.
 - RW parameters (default): angle=60°, offset=0.6 kpc, half_width=0.1 kpc.

References
- Wang, T., Yuan, H., et al. 2025, ApJS, 280, 15
- DOI: https://doi.org/10.3847/1538-4365/adea39
- dustmaps3d: https://github.com/Grapeknight/dustmaps3d
- Website: https://nadc.china-vo.org/data/dustmaps/

Author: Tao Wang (Beijing Normal University)
Date: 2026-01-09
"""

from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
import astropy.units as u
from astropy.coordinates import SkyCoord, CartesianRepresentation
from dustmaps3d import dustmaps3d
from scipy.ndimage import gaussian_filter, distance_transform_edt


# ------------------------------
# Default parameters
# ------------------------------
GRID_X = (-3.0, 3.0)
GRID_Y = (-3.0, 3.0)
GRID_Z = (-1.0, 1.0)
STEP = 0.01  # kpc

SMOOTH_SIGMA = 2  # Gaussian sigma (grid cells)

# Band parameters (Radcliffe Wave, RW)
BAND_ANGLE_DEG = 60.0
BAND_OFFSET_KPC = 0.6
BAND_HALF_WIDTH_KPC = 0.1

OUT_DIR = Path("data")
OUT_RAW = OUT_DIR / "xyz_dust.parquet"
OUT_SMOOTH = OUT_DIR / "XYZ.parquet"
OUT_2D = OUT_DIR / "dust_map_2d.parquet"
OUT_S = OUT_DIR / "dust_map_s.csv"


def build_grid(xrng: Tuple[float, float], yrng: Tuple[float, float], zrng: Tuple[float, float], step: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return flattened X, Y, Z grid arrays (float32) and grid shape.

    Grid is centered in each cell by half-step offset to reduce boundary artifacts.
    """
    xv = np.arange(xrng[0] + step / 2, xrng[1] + step / 2, step)
    yv = np.arange(yrng[0] + step / 2, yrng[1] + step / 2, step)
    zv = np.arange(zrng[0] + step / 2, zrng[1] + step / 2, step)
    Xg, Yg, Zg = np.meshgrid(xv, yv, zv, indexing="ij")
    return (Xg.ravel().astype(np.float32),
            Yg.ravel().astype(np.float32),
            Zg.ravel().astype(np.float32))


def to_galactic(x: np.ndarray, y: np.ndarray, z: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Convert Sun-centered Cartesian (kpc) to Galactic (l,b,d)."""
    rep = CartesianRepresentation(x * u.kpc, y * u.kpc, z * u.kpc)
    sky = SkyCoord(rep, frame="galactic")
    return sky.l.deg.astype(np.float32), sky.b.deg.astype(np.float32), sky.distance.kpc.astype(np.float32)


def query_dust(l: np.ndarray, b: np.ndarray, d: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Query dustmaps3d: returns (dust_raw, d_max) arrays."""
    _, dust_raw, _, dmax = dustmaps3d(l, b, d)
    return np.asarray(dust_raw, dtype=np.float32), np.asarray(dmax, dtype=np.float32)


def nearest_fill_3d(arr3d: np.ndarray, nan_mask: np.ndarray) -> np.ndarray:
    """Fill NaNs in a 3D array by nearest-neighbor values using EDT indices."""
    if not np.any(nan_mask):
        return arr3d
    idx = distance_transform_edt(nan_mask, return_distances=False, return_indices=True)
    return arr3d[tuple(idx)]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1) Build grid and convert to Galactic
    x, y, z = build_grid(GRID_X, GRID_Y, GRID_Z, STEP)
    l, b, d = to_galactic(x, y, z)

    # 2) Query dust and mask beyond max distance
    dust_raw, dmax = query_dust(l, b, d)
    dust_masked = np.where(d <= dmax, dust_raw, np.nan).astype(np.float32)
    finite_mask = ~np.isnan(dust_masked)
    dust_masked[(finite_mask) & (dust_masked < 1e-4)] = 0.0

    # 3) Save raw 3D cube
    df_raw = pd.DataFrame({"X": x, "Y": y, "Z": z, "dust_raw": dust_masked})
    df_raw.to_parquet(OUT_RAW, index=False)
    print(f"✅ Saved raw 3D cube: {OUT_RAW}")

    # 4) Smooth 3D cube (nearest fill before Gaussian)
    nx = int(round((GRID_X[1] - GRID_X[0]) / STEP))
    ny = int(round((GRID_Y[1] - GRID_Y[0]) / STEP))
    nz = int(round((GRID_Z[1] - GRID_Z[0]) / STEP))
    arr3d = dust_masked.reshape(nx, ny, nz)
    nan_mask = np.isnan(arr3d)
    arr_filled = nearest_fill_3d(arr3d, nan_mask)
    arr_smooth = gaussian_filter(arr_filled, sigma=SMOOTH_SIGMA)
    arr_smooth[nan_mask] = np.nan

    df_smooth = pd.DataFrame({
        "X": x,
        "Y": y,
        "Z": z,
        "dust": arr_smooth.ravel().astype(np.float32),
    })
    df_smooth.to_parquet(OUT_SMOOTH, index=False)
    print(f"✅ Saved smoothed 3D cube: {OUT_SMOOTH}")

    # 5) 2D mean over |Z| <= 0.3 kpc
    df_2d = df_smooth[np.abs(df_smooth["Z"]) <= 0.3]
    df_2d = df_2d.groupby(["X", "Y"], as_index=False)["dust"].mean()
    df_2d.to_parquet(OUT_2D, index=False)
    print(f"✅ Saved 2D mean map: {OUT_2D}")

    # 6) RW band-limited slice and arc-length s coordinate
    theta = np.deg2rad(BAND_ANGLE_DEG)
    x0 = -BAND_OFFSET_KPC * np.sin(theta) * np.cos(theta)
    y0 = BAND_OFFSET_KPC * (np.cos(theta) ** 2)
    distances = -np.sin(theta) * df_smooth["X"].to_numpy() + np.cos(theta) * df_smooth["Y"].to_numpy() - BAND_OFFSET_KPC * np.cos(theta)
    mask_band = np.abs(distances) <= BAND_HALF_WIDTH_KPC
    df_band = df_smooth[mask_band].copy()
    df_band["s"] = (df_band["X"] - x0) * np.cos(theta) + (df_band["Y"] - y0) * np.sin(theta)
    df_band.to_csv(OUT_S, index=False, float_format="%.8g")
    print(f"✅ Saved s-band slice: {OUT_S}")


if __name__ == "__main__":
    main()