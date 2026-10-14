"""Compare the running backend's 01 endpoints with the pip package `dustmaps3d()`.

Random sightlines (uniform on the sphere, log-uniform distance 0.05–20 kpc) plus edge
cases — blank distance (backend and package both fall back to the maximum reliable
distance), distances beyond it, and equatorial input — go through /api/v2/dust/batch and
/api/v2/dust/query; every output column is checked against dustmaps3d(l, b, d).

    ../dustmaps3d-backend/.venv/bin/python backend/parity_test.py [--base-url URL] [-n 1200]

Exit status 0 means every compared column agrees within --rtol (relative) / --atol.
The default rtol is 1e-5 because the model parameters are stored as float32: the package
itself moves by up to ~5e-6 between float32 and float64 evaluation of the same formula.

Known, accepted difference: a coordinate lying exactly on a HEALPix pixel boundary (e.g.
l=90, b=0) can land in the neighbouring pixel, because the backend uses healpy and the
package uses astropy_healpix. Random sightlines never hit a boundary, so they are not tested.
"""
import argparse
import io
import json
import sys
import urllib.request
import uuid

import numpy as np
import pandas as pd
from astropy import units as u
from astropy.coordinates import SkyCoord
from dustmaps3d import dustmaps3d

COLUMNS = {"E(B-V)_mag": "EBV", "dust_density_mmag_pc": "dust", "sigma_mag": "sigma", "max_distance_kpc": "max_d"}


def post_batch(base, df):
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"output_format\"\r\n\r\ncsv\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"input.csv\"\r\n"
            "Content-Type: text/csv\r\n\r\n").encode() + df.to_csv(index=False).encode() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(base + "/api/v2/dust/batch", data=body,
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return pd.read_csv(io.BytesIO(r.read()))


def post_query(base, payload):
    req = urllib.request.Request(base + "/api/v2/dust/query", data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def package(l, b, d):
    out = dustmaps3d(np.asarray(l, float), np.asarray(b, float), np.asarray(d, float))
    return {k: np.asarray(v, float) for k, v in zip(("EBV", "dust", "sigma", "max_d"), out)}


def compare(label, got, want, rtol, atol):
    """Return the failure lines for one column."""
    got, want = np.asarray(got, float), np.asarray(want, float)
    both_nan = np.isnan(got) & np.isnan(want)
    bad = ~both_nan & ~np.isclose(got, want, rtol=rtol, atol=atol)
    rel = np.abs(got - want) / np.maximum(np.abs(want), atol)
    worst = np.nanmax(np.where(both_nan, 0, rel)) if len(rel) else 0.0
    status = "ok  " if not bad.any() else "FAIL"
    print(f"  {status} {label:<34} n={len(got):<5} mismatches={int(bad.sum()):<5} worst rel. diff={worst:.3g}")
    return [f"{label}: {int(bad.sum())} mismatches"] if bad.any() else []


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base-url", default="http://127.0.0.1:58123")
    ap.add_argument("-n", type=int, default=1200)
    ap.add_argument("--singles", type=int, default=60, help="how many points also go through /dust/query")
    ap.add_argument("--rtol", type=float, default=1e-5)
    ap.add_argument("--atol", type=float, default=1e-9)
    ap.add_argument("--seed", type=int, default=20261008)
    args = ap.parse_args()
    base = args.base_url.rstrip("/")
    rng = np.random.default_rng(args.seed)

    n = args.n
    l = rng.uniform(0, 360, n)
    b = np.degrees(np.arcsin(rng.uniform(-1, 1, n)))
    d = 10 ** rng.uniform(np.log10(0.05), np.log10(20), n)
    d[: n // 10] = np.nan                                   # blank distance
    l[-3:], b[-3:] = [359.9999, 120.0, 45.0], [0.5, 90.0, -90.0]  # wrap-around and poles
    ref = package(l, b, d)
    beyond = slice(n // 10, n // 5)                          # push some past the reliable limit
    d[beyond] = ref["max_d"][beyond] * rng.uniform(1.05, 2.0, beyond.stop - beyond.start)
    ref = package(l, b, d)
    print(f"{n} galactic sightlines: {np.isnan(d).sum()} blank d, "
          f"{int(np.sum(d > ref['max_d']))} beyond max_d")

    failures = []
    out = post_batch(base, pd.DataFrame({"l": l, "b": b, "d": d}))
    print("/dust/batch (galactic CSV)")
    for col, key in COLUMNS.items():
        failures += compare(f"batch {key}", out[col], ref[key], args.rtol, args.atol)

    # Equatorial input: the package only takes (l, b), so convert with astropy (ICRS -> Galactic).
    m = n // 4
    ra, dec = rng.uniform(0, 360, m), np.degrees(np.arcsin(rng.uniform(-1, 1, m)))
    deq = 10 ** rng.uniform(np.log10(0.05), np.log10(10), m)
    g = SkyCoord(ra=ra * u.deg, dec=dec * u.deg, frame="icrs").galactic
    ref_eq = package(g.l.deg, g.b.deg, deq)
    out_eq = post_batch(base, pd.DataFrame({"ra": ra, "dec": dec, "d": deq}))
    print(f"/dust/batch (equatorial CSV, {m} rows)")
    failures += compare("batch eq. l", out_eq["l"], g.l.deg, 1e-9, 1e-7)
    failures += compare("batch eq. b", out_eq["b"], g.b.deg, 1e-9, 1e-7)
    for col, key in COLUMNS.items():
        failures += compare(f"batch eq. {key}", out_eq[col], ref_eq[key], args.rtol, args.atol)

    k = min(args.singles, n)
    idx = np.r_[0:k // 3, n // 10:n // 10 + k // 3, n - (k - 2 * (k // 3)):n]
    got = {key: [] for key in ("EBV", "dust_density", "sigma", "max_distance")}
    for i in idx:
        r = post_query(base, {"coord_system": "galactic", "coord1": float(l[i]), "coord2": float(b[i]),
                              "d": None if np.isnan(d[i]) else float(d[i])})
        for key in got:
            got[key].append(np.nan if r[key] is None else r[key])
    print(f"/dust/query (galactic, {len(idx)} single requests)")
    for key, ref_key in zip(got, ("EBV", "dust", "sigma", "max_d")):
        failures += compare(f"query {ref_key}", got[key], ref[ref_key][idx], args.rtol, args.atol)

    q_eq = [post_query(base, {"coord_system": "equatorial", "coord1": float(ra[i]), "coord2": float(dec[i]),
                              "d": float(deq[i])}) for i in range(min(20, m))]
    print(f"/dust/query (equatorial, {len(q_eq)} single requests)")
    for key, ref_key in zip(got, ("EBV", "dust", "sigma", "max_d")):
        failures += compare(f"query eq. {ref_key}", [r[key] for r in q_eq], ref_eq[ref_key][:len(q_eq)], args.rtol, args.atol)

    print("PASS" if not failures else "FAIL: " + "; ".join(failures))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
