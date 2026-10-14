"""Build the site logo (striped barred-spiral mark) as clean, mask-free vector paths.

Clean redraw of design/logos/round3/10-scan-fog.svg, the mark the user picked:
the same geometry, but every curve is a true arc or Bézier instead of a 0.01-unit
polyline, the stripes are explicit filled shapes instead of strokes cut by a mask,
stripe fragments too short to read are dropped, and each arm ends in a round cap
instead of a hairline tail. Nothing but filled <path>/<circle> elements, so the
file also opens cleanly in Figma / Illustrator.

Construction (face-on frame, units of the 24-unit viewBox): disc R = 11.4, core
r = 2.3, bar = capsule from (-4.2, 0) to (4.2, 0) with r = 1.403, two point-
symmetric arms between log spirals r_out = 5.202 e^(0.2303 phi) and
r_in = 2.803 e^(0.4063 phi) starting at the bar end (theta = 180 deg + phi). The
whole galaxy is squashed by 0.6 (inclination) and turned 156 deg about (12, 12).
In screen space: 13 horizontal stripes every 1.5 units, a 1.2 gap around the
galaxy, a round dot at (10.96, 16.83) with a 1.35 gap.

Stripes sit where the original has them (3 + 1.5k) but 0.75 thick, and the viewBox
starts at y = 0.375: at 32 px (the nav size) every stripe then covers whole pixels,
one at 1x and two at 2x, so they stay sharp instead of smearing into grey.

    python3 scripts/build-logo.py            # writes src/assets/logo-mark.svg + public/favicon.svg
"""

import math
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parent.parent

# ---------- geometry ----------
ANG = math.radians(155.994)  # galaxy position angle on screen
Q = 0.6  # minor/major axis ratio (inclination squash)
C = np.array([12.0, 12.0])
DISC_R = 11.4
CORE_R = 2.3
BAR_HALF, BAR_R = 4.2, 1.403
K_OUT, A_OUT = 0.2303, 5.202
K_IN, A_IN = 0.4063, 2.803
ARM_MIN_W = 1.0  # face-on width where an arm is cut and capped
GAP = 1.2  # clear space between the galaxy and the stripes
DOT_C, DOT_R, DOT_GAP = np.array([10.96, 16.83]), 1.25, 1.35
STRIPE_Y0, STRIPE_STEP, STRIPE_H, STRIPE_N = 3.0, 1.5, 0.75, 13
VIEW_Y = 0.375  # viewBox top: puts the stripe edges on the 32 px pixel grid
MIN_SEG = 1.5  # shorter stripe pieces are dropped

cosA, sinA = math.cos(ANG), math.sin(ANG)


def T(p):
    """Face-on (u, v) -> screen (x, y)."""
    p = np.asarray(p, float)
    u, v = p[..., 0], p[..., 1] * Q
    return np.stack([C[0] + cosA * u - sinA * v, C[1] + sinA * u + cosA * v], -1)


def fmt(v):
    s = f'{v:.3f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def pt(p):
    return f'{fmt(p[0])} {fmt(p[1])}'


# An affine image of a face-on circle of radius r is an ellipse with rx = r,
# ry = Q r, rotated by ANG: exactly what the SVG arc command draws.
def arc_to(r, end, large=0, sweep=1):
    return f'A{fmt(r)} {fmt(r * Q)} {fmt(math.degrees(ANG))} {large} {sweep} {pt(end)}'


# ---------- arms: log-spiral edges as cubic Béziers ----------
def spiral(a, k, phi, sign):
    """Point and d/dphi of r = a e^(k phi) at theta = 180 deg + phi (sign=-1 mirrors the arm)."""
    r = a * math.exp(k * phi)
    th = math.pi + phi
    p = np.array([r * math.cos(th), r * math.sin(th)]) * sign
    d = np.array([k * r * math.cos(th) - r * math.sin(th), k * r * math.sin(th) + r * math.cos(th)]) * sign
    return p, d


def spiral_path(a, k, phi0, phi1, sign, n):
    """Cubic Béziers along a spiral from phi0 to phi1, as SVG 'C' commands (start point not included)."""
    out = []
    phis = np.linspace(phi0, phi1, n + 1)
    for p0, p1 in zip(phis[:-1], phis[1:]):
        h = (p1 - p0) / 3
        P0, D0 = spiral(a, k, p0, sign)
        P3, D3 = spiral(a, k, p1, sign)
        c1, c2 = T(P0 + D0 * h), T(P3 - D3 * h)
        out.append(f'C{pt(c1)} {pt(c2)} {pt(T(P3))}')
    return out


def arm_end():
    """phi where the face-on arm width r_out - r_in drops to ARM_MIN_W."""
    lo, hi = 0.0, 4.0
    for _ in range(60):
        mid = (lo + hi) / 2
        w = A_OUT * math.exp(K_OUT * mid) - A_IN * math.exp(K_IN * mid)
        lo, hi = (mid, hi) if w > ARM_MIN_W else (lo, mid)
    return lo


PHI_END = arm_end()


DOT_HALO = DOT_R + DOT_GAP


def dot_crossings(a, k, sign):
    """phi values (ascending) where a spiral edge crosses the dot's clear zone."""
    phis = np.linspace(0, PHI_END, 2000)
    d = np.array([np.linalg.norm(T(spiral(a, k, f, sign)[0]) - DOT_C) - DOT_HALO for f in phis])
    out = []
    for i in np.nonzero(np.sign(d[:-1]) != np.sign(d[1:]))[0]:
        lo, hi = phis[i], phis[i + 1]
        for _ in range(50):
            mid = (lo + hi) / 2
            dm = np.linalg.norm(T(spiral(a, k, mid, sign)[0]) - DOT_C) - DOT_HALO
            lo, hi = (mid, hi) if np.sign(dm) == np.sign(d[i]) else (lo, mid)
        out.append((lo + hi) / 2)
    return out


def circle_arc(end, sweep):
    return f'A{fmt(DOT_HALO)} {fmt(DOT_HALO)} 0 0 {sweep} {pt(end)}'


def arm_paths(sign):
    """Arm outline(s): outer spiral out to the cut, round cap, inner spiral back, closed inside
    the bar; where the dot's clear zone crosses the arm it is split in two along that circle."""
    o_end, _ = spiral(A_OUT, K_OUT, PHI_END, sign)
    i_end, _ = spiral(A_IN, K_IN, PHI_END, sign)
    cap_r = float(np.linalg.norm(o_end - i_end)) / 2
    start, _ = spiral(A_OUT, K_OUT, 0.0, sign)
    root, _ = spiral(A_IN, K_IN, 0.0, sign)
    oc, ic = dot_crossings(A_OUT, K_OUT, sign), dot_crossings(A_IN, K_IN, sign)
    seg = lambda a, k, f0, f1: spiral_path(a, k, f0, f1, sign, max(1, math.ceil(abs(f1 - f0) / 0.35)))
    P = lambda a, k, f: T(spiral(a, k, f, sign)[0])
    if not oc and not ic:
        d = [f'M{pt(T(start))}', *seg(A_OUT, K_OUT, 0.0, PHI_END), arc_to(cap_r, T(i_end), 0, 1),
             *seg(A_IN, K_IN, PHI_END, 0.0), f'L{pt(T(root))}Z']
        return [''.join(d)]
    assert len(oc) == 2 and len(ic) == 2, (oc, ic)
    # root side: concave cut (the circle's centre lies outside the piece) -> sweep 0
    near = [f'M{pt(T(start))}', *seg(A_OUT, K_OUT, 0.0, oc[0]), circle_arc(P(A_IN, K_IN, ic[0]), 0),
            *seg(A_IN, K_IN, ic[0], 0.0), f'L{pt(T(root))}Z']
    far = [f'M{pt(P(A_OUT, K_OUT, oc[1]))}', *seg(A_OUT, K_OUT, oc[1], PHI_END), arc_to(cap_r, T(i_end), 0, 1),
           *seg(A_IN, K_IN, PHI_END, ic[1]), circle_arc(P(A_OUT, K_OUT, oc[1]), 0), 'Z']
    return [''.join(near), ''.join(far)]


def bar_path():
    a, b = np.array([-BAR_HALF, -BAR_R]), np.array([BAR_HALF, -BAR_R])
    c, e = np.array([BAR_HALF, BAR_R]), np.array([-BAR_HALF, BAR_R])
    return (f'M{pt(T(a))}L{pt(T(b))}{arc_to(BAR_R, T(c), 0, 1)}'
            f'L{pt(T(e))}{arc_to(BAR_R, T(a), 0, 1)}Z')


def ellipse_path(r):
    p0, p1 = T(np.array([r, 0.0])), T(np.array([-r, 0.0]))
    return f'M{pt(p0)}{arc_to(r, p1, 0, 1)}{arc_to(r, p0, 0, 1)}Z'


# ---------- stripes: explicit pieces, clear of the galaxy ----------
def galaxy_outline_samples():
    """Dense screen-space samples of the galaxy's filled region (for distance tests)."""
    pts = []
    for sign in (1, -1):
        for phi in np.linspace(0, PHI_END, 400):
            for a, k in ((A_OUT, K_OUT), (A_IN, K_IN)):
                pts.append(T(spiral(a, k, phi, sign)[0]))
            # interior fill of the arm, so "inside" points read as distance 0
            o, _ = spiral(A_OUT, K_OUT, phi, sign)
            i, _ = spiral(A_IN, K_IN, phi, sign)
            for f in np.linspace(0, 1, 6):
                pts.append(T(i + (o - i) * f))
        o_end, _ = spiral(A_OUT, K_OUT, PHI_END, sign)
        i_end, _ = spiral(A_IN, K_IN, PHI_END, sign)
        mid, cr = (o_end + i_end) / 2, np.linalg.norm(o_end - i_end) / 2
        for t in np.linspace(0, 2 * math.pi, 60):
            pts.append(T(mid + cr * np.array([math.cos(t), math.sin(t)])))
    for t in np.linspace(0, 2 * math.pi, 240):
        for rr in np.linspace(0, CORE_R, 4):
            pts.append(T([rr * math.cos(t), rr * math.sin(t)]))
    for u in np.linspace(-BAR_HALF - BAR_R, BAR_HALF + BAR_R, 300):
        for v in np.linspace(-BAR_R, BAR_R, 9):
            if abs(u) <= BAR_HALF or (abs(u) - BAR_HALF) ** 2 + v * v <= BAR_R ** 2:
                pts.append(T([u, v]))
    pts = np.array(pts)
    return pts[np.linalg.norm(pts - DOT_C, axis=1) > DOT_HALO]


GAL = cKDTree(galaxy_outline_samples())


def free(x, y):
    """True where a stripe may be: inside the disc, clear of the galaxy and the dot."""
    p = np.stack([x, np.full_like(x, y)], -1)
    # inside the disc (inverse transform)
    q = p - C
    u = cosA * q[:, 0] + sinA * q[:, 1]
    v = (-sinA * q[:, 0] + cosA * q[:, 1]) / Q
    inside = u * u + v * v <= DISC_R ** 2
    dg, _ = GAL.query(p)
    dd = np.linalg.norm(p - DOT_C, axis=1) - DOT_R
    return inside & (dg >= GAP) & (dd >= DOT_GAP)


def in_disc(x, y):
    q = np.array([x, y]) - C
    u = cosA * q[0] + sinA * q[1]
    v = (-sinA * q[0] + cosA * q[1]) / Q
    return u * u + v * v <= DISC_R ** 2


def intervals(y, step=0.002):
    xs = np.arange(0, 24 + step, step)
    ok = free(xs, y)
    out, start = [], None
    for x, f in zip(xs, ok):
        if f and start is None:
            start = x
        elif not f and start is not None:
            out.append((start, x - step))
            start = None
    if start is not None:
        out.append((start, xs[-1]))
    return out


def solid_intervals(rows):
    cur = rows[0]
    for iv in rows[1:]:
        nxt = []
        for a0, a1 in cur:
            for b0, b1 in iv:
                lo, hi = max(a0, b0), min(a1, b1)
                if hi > lo:
                    nxt.append((lo, hi))
        cur = nxt
    return cur


SLACK = 0.8  # how far a row may run past the centre line where the galaxy's clear zone grazes the band
MIN_SOLID = 0.5  # full-thickness length below which a piece is a sliver (e.g. the band clipping the disc's top)


def stripe_pieces():
    """One piece per free stretch of a stripe's centre line. Each of 9 rows across the band
    ends where it meets the disc edge or the galaxy's clear zone, so piece ends follow those
    curves; a clear zone that only grazes the band is not allowed to leave a spike or a bite."""
    pieces = []
    for k in range(STRIPE_N):
        yc = STRIPE_Y0 + k * STRIPE_STEP
        ys = np.linspace(yc - STRIPE_H / 2, yc + STRIPE_H / 2, 9)
        rows = [intervals(y) for y in ys]
        for c0, c1 in rows[4]:
            if c1 - c0 < MIN_SEG:
                continue
            solid = [iv for iv in solid_intervals(rows) if iv[1] > c0 and iv[0] < c1]
            if sum(min(b, c1) - max(a, c0) for a, b in solid) < MIN_SOLID:
                continue
            # an end of the centre line that sits on the disc edge lets every row follow that edge
            l_disc, r_disc = not in_disc(c0 - 0.01, yc), not in_disc(c1 + 0.01, yc)
            left, right = [], []
            for iv, y in zip(rows, ys):
                near = [(a, b) for a, b in iv if b > c0 - SLACK and a < c1 + SLACK]
                l, r = min(a for a, _ in near), max(b for _, b in near)
                # otherwise a row may be pulled back by the galaxy's clear zone but never runs
                # out more than SLACK past the centre line
                if not (l_disc and not in_disc(l - 0.01, y)):
                    l = max(l, c0 - SLACK)
                if not (r_disc and not in_disc(r + 0.01, y)):
                    r = min(r, c1 + SLACK)
                left.append((l, y))
                right.append((r, y))
            poly = right + left[::-1]
            pieces.append('M' + 'L'.join(pt(p) for p in poly) + 'Z')
    return pieces


def build():
    arms = [d for sgn in (1, -1) for d in arm_paths(sgn)]
    galaxy = [*arms, bar_path(), ellipse_path(CORE_R)]
    stripes = stripe_pieces()
    body = (
        f'<path d="{"".join(stripes)}"/>'
        + ''.join(f'<path d="{d}"/>' for d in galaxy)
        + f'<circle cx="{fmt(DOT_C[0])}" cy="{fmt(DOT_C[1])}" r="{fmt(DOT_R)}"/>'
    )
    mark = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {fmt(VIEW_Y)} 24 24" fill="#fff">{body}</svg>\n'
    favicon = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<rect width="64" height="64" rx="14" fill="#000"/>'
        f'<g transform="translate(4 {fmt(4 - VIEW_Y * 56 / 24)}) scale(2.3333)" fill="#fff">{body}</g></svg>\n'
    )
    return mark, favicon, len(stripes)


if __name__ == '__main__':
    import sys

    out = Path(sys.argv[1]) if len(sys.argv) > 1 else None  # optional: write both files to another folder
    mark, favicon, n = build()
    (out / 'logo-mark.svg' if out else ROOT / 'src/assets/logo-mark.svg').write_text(mark)
    (out / 'favicon.svg' if out else ROOT / 'public/favicon.svg').write_text(favicon)
    print(f'logo-mark.svg {len(mark)} B, favicon.svg {len(favicon)} B, {n} stripe pieces, arm cut at phi = {math.degrees(PHI_END):.1f} deg')
