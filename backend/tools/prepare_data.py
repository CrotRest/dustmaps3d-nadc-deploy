"""Convert the dustmaps3d model FITS into the Parquet file dustmaps3d-backend reads.

The backend wants one row per NSIDE=1024 RING HEALPix pixel, in pixel order, with
the model columns (b_lim, bubble, h, diffuse_dust_rho, distance_1..4, span_1..4,
Cum_EBV_1..4, sigma, max_distance). data_v3.fits — the file `pip install dustmaps3d`
downloads — is already laid out that way, so every column is copied unchanged.

    python prepare_data.py <data_v3.fits> <data.parquet>
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from astropy.table import Table

NSIDE = 1024
REQUIRED = ["b_lim", "bubble", "diffuse_dust_rho", "h", "max_distance", "sigma"] + [
    f"{name}_{i}" for name in ("distance", "span", "Cum_EBV") for i in range(1, 5)
]


def main(src: str, dst: str) -> None:
    df = Table.read(src, format="fits").to_pandas()
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise SystemExit(f"{src} lacks columns: {missing}")
    if len(df) != 12 * NSIDE**2:
        raise SystemExit(f"{src} has {len(df)} rows, expected {12 * NSIDE**2} (NSIDE={NSIDE})")
    out = Path(dst)
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, index=False)

    back = pd.read_parquet(out)
    for c in df.columns:
        if not np.array_equal(df[c].to_numpy(), back[c].to_numpy(), equal_nan=True):
            raise SystemExit(f"column {c} changed in the round trip")
    print(f"wrote {out} ({out.stat().st_size / 1e6:.0f} MB, {len(back)} rows, {len(back.columns)} columns)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
