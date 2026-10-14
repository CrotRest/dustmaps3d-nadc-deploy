// Procedural Milky Way used by the page background. Units are kpc and seconds.
// The disk lies in the XZ plane with +Y towards the North Galactic Pole, so the
// galaxy turns clockwise seen from above, like the real one. Every star sits on
// a circular orbit whose angular speed falls with radius (differential
// rotation); the bar and the spiral arms turn rigidly together at the bar's
// pattern speed, so stars, gas and dust light up as they drift through the arms
// instead of the arms winding up.
//
// The bar follows the measured Milky Way: long-bar half-length 5.0 kpc at ~29°
// from the Sun–GC line, near end at positive l, thin (scale height ~180 pc), with
// a boxy/peanut bulge of ~2 kpc half-length inside it (axis ratios ~1:0.5:0.4).
// It turns as a solid body at Ωp ≈ 40 km/s/kpc, faster than the Sun's ~29, which
// puts corotation at ~6 kpc (Wegg+2015, Portail+2017, Sanders+2019). Dust has been
// cleared out of the bar region in the optical.
//
// The infrared view (section 03) adds structure the optical one doesn't show, after the
// JWST/PHANGS spirals (e.g. NGC 628): thick, knotty spiral-arm ridges, bubbles with
// bright thick rims, a thinning web of filaments in the bar region, and a dust disk that
// reaches far past the optical one.

export const R_SUN = 8.2;
export const R_DISK = 15;
export const ARM_K = 3.3; // 1 / tan(pitch ≈ 17°), a little more open than the real arms so they read as spirals
export const BAR_ANGLE = (29 * Math.PI) / 180;
export const BAR_HALF = 5.0;
// the two main arms leave from the bar ends
export const ARM_R_REF = BAR_HALF * Math.exp(BAR_ANGLE / ARM_K);

/** Angular speed of a circular orbit: rising-then-flat rotation curve, 0.010 rad/s at the Sun. */
export const omegaAt = (r) => (0.082 * (1 - Math.exp(-Math.max(r, 0.05) / 1.2))) / Math.max(r, 0.05);
export const SUN_OMEGA = omegaAt(R_SUN);
/** Bar (and arm) pattern speed: corotation at 6 kpc, i.e. ~1.35× the Sun's angular speed. */
export const PATTERN_SPEED = omegaAt(6.0);
export const SUN_THETA0 = 0;

// Infrared disk dust: the shear it picks up from differential rotation is capped, or a
// long-open page winds the filaments into rings. Until SHEAR_KNEE it moves exactly like
// every other orbit; then the shear eases to a stop at SHEAR_MAX and the web turns on
// as a solid body with the Sun, so the Local Bubble stays round it.
export const SHEAR_KNEE = 50;
export const SHEAR_MAX = 60;
/** Elapsed shear time of the infrared dust at time t: t, eased to SHEAR_MAX past the knee. */
export const dustShearTime = (t) =>
  t <= SHEAR_KNEE ? t : SHEAR_KNEE + (SHEAR_MAX - SHEAR_KNEE) * Math.tanh((t - SHEAR_KNEE) / (SHEAR_MAX - SHEAR_KNEE));

/** Sun position at time t, plus the Galactic basis at the Sun (x → GC, y → rotation, z → NGP). */
export function sunFrame(t, out = {}) {
  const th = SUN_THETA0 + SUN_OMEGA * t;
  const c = Math.cos(th);
  const s = Math.sin(th);
  out.sun = [R_SUN * c, 0, R_SUN * s];
  out.rhat = [c, 0, s]; // GC → Sun
  out.that = [-s, 0, c]; // direction of rotation (l = 90°)
  out.up = [0, 1, 0]; // NGP
  return out;
}

/** World-space unit vector of Galactic (l, b) seen from the Sun at time t. */
export function galDir(l, b, frame) {
  const L = (l * Math.PI) / 180;
  const B = (b * Math.PI) / 180;
  const cx = Math.cos(B) * Math.cos(L);
  const cy = Math.cos(B) * Math.sin(L);
  const cz = Math.sin(B);
  return [
    -frame.rhat[0] * cx + frame.that[0] * cy,
    cz,
    -frame.rhat[2] * cx + frame.that[2] * cy,
  ];
}

function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.gauss = () => {
    const u = Math.max(next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return next;
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Exponential-disk radius sample, truncated to [rmin, rmax]. */
function expRadius(rand, scale, rmin, rmax) {
  for (;;) {
    // area-weighted exponential disk: p(r) ∝ r e^{-r/h} = Gamma(2, h)
    const r = -scale * Math.log(Math.max(rand() * rand(), 1e-12));
    if (r >= rmin && r <= rmax) return r;
  }
}

class Layer {
  constructor(n) {
    this.n = n;
    this.i = 0;
    this.position = new Float32Array(n * 3); // orbit: (r, y, theta0) · rigid/static: (x, y, z)
    this.omega = new Float32Array(n);
    this.color = new Float32Array(n * 4);
    this.size = new Float32Array(n);
    this.seed = new Float32Array(n);
  }

  push(p0, p1, p2, omega, rgb, alpha, size, seed) {
    if (this.i >= this.n) return false;
    const i = this.i++;
    this.position[i * 3] = p0;
    this.position[i * 3 + 1] = p1;
    this.position[i * 3 + 2] = p2;
    this.omega[i] = omega;
    this.color[i * 4] = rgb[0];
    this.color[i * 4 + 1] = rgb[1];
    this.color[i * 4 + 2] = rgb[2];
    this.color[i * 4 + 3] = alpha;
    this.size[i] = size;
    this.seed[i] = seed;
    return true;
  }

  get full() {
    return this.i >= this.n;
  }
}

/** Push an orbit particle given its t = 0 Cartesian position. */
function pushOrbit(layer, x, y, z, rgb, alpha, size, seed) {
  const r = Math.hypot(x, z);
  return layer.push(r, y, Math.atan2(z, x), omegaAt(r), rgb, alpha, size, seed);
}

/** Superbubbles carved into the dust (t = 0 positions, kpc). The first one is the Local Bubble. */
function makeBubbles(rand, count) {
  const list = [{ x: R_SUN * Math.cos(SUN_THETA0) + 0.05, z: R_SUN * Math.sin(SUN_THETA0) - 0.08, r: 0.32 }];
  while (list.length < count) {
    const r = expRadius(rand, 3.4, 5.2, 14); // no bubbles in the dust-free bar region
    const th = rand() * Math.PI * 2;
    const rad = 0.18 + Math.pow(rand(), 1.6) * 1.05;
    const b = { x: r * Math.cos(th), z: r * Math.sin(th), r: rad };
    if (list.some((o) => Math.hypot(o.x - b.x, o.z - b.z) < (o.r + b.r) * 0.85)) continue;
    list.push(b);
  }
  return list;
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** Infrared dust inside the bar region, relative to the disk just outside it: ~1/3 at 2.5 kpc, gone by ~1 kpc. */
const barDustTaper = (r) => smoothstep(0.9, 5.4, r);

/** Small bubbles in the bar region (infrared only): fewer and smaller towards the centre. */
function makeBarBubbles(rand, count, others) {
  const list = [];
  for (let tries = 0; list.length < count && tries < count * 400; tries++) {
    const r = Math.sqrt(1.5 * 1.5 + rand() * (4.4 * 4.4 - 1.5 * 1.5)); // uniform in area
    if (rand() > barDustTaper(r)) continue;
    const th = rand() * Math.PI * 2;
    const rad = lerp(0.1, 0.16 + 0.26 * smoothstep(1.5, 4.6, r), Math.pow(rand(), 1.4));
    if (r + rad > 4.6) continue; // stay clear of the optical dust's inner edge
    const b = { x: r * Math.cos(th), z: r * Math.sin(th), r: rad };
    if ([...others, ...list].some((o) => Math.hypot(o.x - b.x, o.z - b.z) < (o.r + b.r) * 0.85)) continue;
    list.push(b);
  }
  return list;
}

/** Push a dust particle inside a bubble out onto its shell. Returns NaN x when it is dropped. */
function carve(p, bubbles, rand) {
  for (const b of bubbles) {
    const dx = p[0] - b.x;
    const dz = p[2] - b.z;
    const d = Math.hypot(dx, dz, p[1] * 1.8);
    const R = b.shape ? b.r * b.shape(Math.atan2(dz, dx)) : b.r;
    if (d < R) {
      if (rand() < 0.35) {
        p[0] = NaN;
        return 0;
      }
      const k = (R * (1 + Math.abs(rand.gauss()) * 0.06)) / Math.max(d, 1e-4);
      p[0] = b.x + dx * k;
      p[2] = b.z + dz * k;
      p[1] *= k * 0.6;
      return 1;
    }
  }
  return 0;
}

/** carve() over many bubbles: only the bubbles near the point, in their original order. */
function bubbleGrid(list, cell = 2) {
  const map = new Map();
  for (const b of list) {
    const r = b.rMax || b.r;
    for (let i = Math.floor((b.x - r) / cell); i <= Math.floor((b.x + r) / cell); i++) {
      for (let j = Math.floor((b.z - r) / cell); j <= Math.floor((b.z + r) / cell); j++) {
        const k = i * 4096 + j;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(b);
      }
    }
  }
  const none = [];
  return (p) => map.get(Math.floor(p[0] / cell) * 4096 + Math.floor(p[2] / cell)) || none;
}

/**
 * Give an infrared-only bubble an irregular outline (a few low harmonics, up to ~±20%),
 * derived from its position so no random numbers are drawn. The optical bubbles stay round.
 */
function withShape(b) {
  const h = (k) => {
    const v = Math.sin(b.x * (12.9898 + k) + b.z * (78.233 - k)) * 43758.5453;
    return v - Math.floor(v);
  };
  const ph = [h(1), h(2), h(3)].map((v) => v * Math.PI * 2);
  const m = [0.06 + 0.07 * h(4), 0.04 + 0.05 * h(5), 0.02 + 0.03 * h(6)];
  b.shape = (a) => 1 + m[0] * Math.cos(a - ph[0]) + m[1] * Math.cos(2 * a - ph[1]) + m[2] * Math.cos(3 * a - ph[2]);
  b.rMax = b.r * (1 + m[0] + m[1] + m[2]);
  return b;
}

/** Infrared disk surface density beyond 6 kpc relative to its peak: falls off twice as slowly as the optical dust, out to ~42 kpc. */
const irDiskDensity = (r) => Math.exp(-(r - 6) / 11) * (1 - smoothstep(30, 43, r));
/** The optical dust's own profile in the same units (measured: ~e^{-r/5.2}, cut at ~16 kpc). */
const opticalDustDensity = (r) => Math.exp(-(r - 6) / 5.2) * (1 - smoothstep(14.8, 16.8, r));

/** Spiral-arm strength at a t = 0 position (same pattern as armWeight in the shaders, dust-lane shift). */
function armStrength(x, z) {
  const r = Math.max(Math.hypot(x, z), 0.3);
  const psi = Math.atan2(z, x) + ARM_K * Math.log(r / ARM_R_REF) - 0.22;
  // ~2.4 kpc wide whatever the radius, so the arms stay thick ridges instead of fanning out
  const sharp = 0.25 * r * r;
  const main = Math.exp((Math.cos(2 * psi) - 1) * sharp);
  const spur = Math.exp((Math.cos(4 * psi + 1.1) - 1) * sharp * 1.6) * 0.22;
  return Math.max(main, spur) * smoothstep(4.4, 6.5, r) * (1 - smoothstep(16, 26, r));
}

/** Bubbles that don't overlap each other or `others`; `place(rand)` proposes one or returns null. */
function scatterBubbles(rand, count, others, place) {
  const list = [];
  for (let tries = 0; list.length < count && tries < count * 600; tries++) {
    const b = place(rand);
    if (!b) continue;
    if (others.some((o) => Math.hypot(o.x - b.x, o.z - b.z) < (o.r + b.r) * 0.85)) continue;
    if (list.some((o) => Math.hypot(o.x - b.x, o.z - b.z) < (o.r + b.r) * 0.85)) continue;
    list.push(b);
  }
  return list;
}

/** Particles in a bubble's crust ("pizza rim") for a linear density of `perKpc`. */
const crustCount = (b, perKpc) => Math.max(8, Math.round(perKpc * 2 * Math.PI * b.r));

/**
 * Thick, lumpy crust round a bubble: the swept-up shell is denser, brighter and puffier
 * on some sides than others, like the bubble rims in the JWST images.
 */
function pushCrust(rand, b, n, push) {
  const h = [0, 1, 2].map(() => rand() * Math.PI * 2);
  const amp = [0.5 + rand() * 0.4, 0.25 + rand() * 0.3, 0.15 + rand() * 0.2];
  const lump = (a) => 1 + amp[0] * Math.cos(a - h[0]) + amp[1] * Math.cos(2 * a - h[1]) + amp[2] * Math.cos(3 * a - h[2]);
  const top = 1 + amp[0] + amp[1] + amp[2];
  // most shells are broken somewhere
  const gap = rand() * Math.PI * 2;
  const gapW = rand() < 0.55 ? 0.4 + rand() * 1.1 : 0;
  for (let j = 0, tries = 0; j < n && tries < n * 8; tries++) {
    const a = rand() * Math.PI * 2;
    let w = lump(a) / top;
    if (gapW && Math.abs(((a - gap + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < gapW / 2) w *= 0.15;
    if (rand() > 0.1 + 0.9 * w) continue;
    const R = b.shape ? b.r * b.shape(a) : b.r;
    // thicker (puffier) where the crust is denser; it sits just outside the cavity
    const rr = R * 1.01 + Math.abs(rand.gauss()) * (R * (0.05 + 0.13 * w) + 0.02) - Math.abs(rand.gauss()) * R * 0.02;
    const seed = 0.15 + rand() * 0.55 + 0.3 * w * rand(); // mostly orange, yellow where it's thickest
    push(b.x + Math.cos(a) * rr, rand.gauss() * 0.025, b.z + Math.sin(a) * rr, (0.3 + rand() * 0.4) * (0.7 + 0.5 * w), 0.045 + rand() * 0.07, seed);
    j++;
  }
}

/**
 * Infrared-only layers. Own random streams, so the optical layers stay exactly as they were.
 * - web (moves like the disk dust, shear capped): the bar-region web, the far-reaching outer
 *   disk, and the crusts of every disk bubble.
 * - arms (turns with the spiral pattern, so it never winds up): thick arm ridges with
 *   bright star-forming knots and bubbles of their own.
 */
function buildInfrared(q, N, bubbles, dustRgb) {
  // --- bar region: a web thinning out towards the centre so it fades into the bulge glow.
  // Inside 3.8 kpc it turns as a solid body, so the faster inner orbits don't wind it up.
  const rb = rng(20251008);
  const barBubbles = makeBarBubbles(rb, Math.max(6, Math.round(30 * Math.sqrt(q))), bubbles).map(withShape);
  // --- outer disk bubbles, bigger further out, beyond the optical dust's edge
  const re = rng(20251009);
  const outerBubbles = scatterBubbles(re, Math.max(10, Math.round(44 * Math.sqrt(q))), [...bubbles, ...barBubbles], (rand) => {
    const r = Math.sqrt(16.5 * 16.5 + rand() * (40 * 40 - 16.5 * 16.5));
    if (rand() > irDiskDensity(r) / irDiskDensity(16.5)) return null;
    const th = rand() * Math.PI * 2;
    const rad = 0.4 + Math.pow(rand(), 1.5) * (0.6 + 1.4 * smoothstep(16, 34, r));
    return r - rad < 15.8 ? null : withShape({ x: r * Math.cos(th), z: r * Math.sin(th), r: rad });
  });
  const diskBubbles = [...bubbles, ...barBubbles, ...outerBubbles];
  const nearDisk = bubbleGrid(diskBubbles);

  const rimScale = 170 * Math.sqrt(q);
  const crusts = [
    ...bubbles.map((b) => [b, crustCount(b, rimScale * Math.min(1, irDiskDensity(Math.hypot(b.x, b.z))))]),
    ...barBubbles.map((b) => [b, crustCount(b, rimScale * 0.4 * barDustTaper(Math.hypot(b.x, b.z)))]),
    ...outerBubbles.map((b) => [b, crustCount(b, rimScale * 0.8 * Math.sqrt(irDiskDensity(Math.hypot(b.x, b.z))))]),
  ];
  const shells = barBubbles.map((b) => Math.round(70 * Math.sqrt(q * barDustTaper(Math.hypot(b.x, b.z))) * 2 * Math.PI * b.r));
  const barQuota = N(17000) + shells.reduce((sum, n) => sum + n, 0);
  const crustTotal = crusts.reduce((sum, c) => sum + c[1], 0);
  const web = new Layer(barQuota + crustTotal + N(180000));
  const pushWeb = (rand) => (x, y, z, a, size = 0.035 + rand() * 0.06, seed = rand()) => {
    const r = Math.hypot(x, z);
    web.push(r, y, Math.atan2(z, x), omegaAt(Math.max(r, 3.8)), dustRgb, a, size, seed);
  };

  // broken shells round the bar bubbles, so they still read as bubbles where the web is thin
  const pushBar = pushWeb(rb);
  barBubbles.forEach((b, i) => {
    const gap = rb() * Math.PI * 2;
    const open = 0.5 + rb() * 1.6;
    for (let j = 0; j < shells[i]; j++) {
      const ang = gap + open / 2 + rb() * (Math.PI * 2 - open);
      const rr = b.r * (1 + Math.abs(rb.gauss()) * 0.06);
      pushBar(b.x + Math.cos(ang) * rr, rb.gauss() * 0.02, b.z + Math.sin(ang) * rr, (0.35 + rb() * 0.5) * 1.25);
    }
  });
  const allBar = [...bubbles, ...barBubbles];
  while (web.i < barQuota) {
    const r0 = Math.sqrt(0.9 * 0.9 + rb() * (5.4 * 5.4 - 0.9 * 0.9)); // uniform in area
    // fill in under the optical dust's soft inner edge (~4–5.5 kpc)
    if (rb() > barDustTaper(r0) * (1 - smoothstep(3.9, 5.5, r0))) continue;
    const th0 = rb() * Math.PI * 2;
    let x = r0 * Math.cos(th0);
    let z = r0 * Math.sin(th0);
    let dir = th0 + Math.PI / 2 + (rb() - 0.5) * 1.6;
    const len = 8 + Math.floor(rb() * 34);
    const step = 0.02 + rb() * 0.03;
    const y0 = rb.gauss() * 0.04;
    const width = (0.008 + rb() * 0.022) * lerp(0.6, 1, smoothstep(1, 5, r0));
    for (let j = 0; j < len && web.i < barQuota; j++) {
      dir += (rb() - 0.5) * 0.5;
      x += Math.cos(dir) * step;
      z += Math.sin(dir) * step;
      const p = [x + rb.gauss() * width, y0 + rb.gauss() * 0.02, z + rb.gauss() * width];
      const rim = carve(p, allBar, rb);
      if (Number.isNaN(p[0])) continue;
      pushBar(p[0], p[1], p[2], (0.35 + rb() * 0.5) * (rim ? 1.25 : 1));
    }
  }

  // --- crusts of every disk bubble
  const pushOuter = pushWeb(re);
  for (const [b, n] of crusts) pushCrust(re, b, n, pushOuter);

  // --- the infrared disk carries on well past the optical dust: the same wandering
  // strands, topping the optical dust up to a profile that falls off twice as slowly
  const topUp = (r) => Math.max(0, irDiskDensity(r) - opticalDustDensity(r)) * smoothstep(6, 9, r) * (1 + 0.8 * smoothstep(9, 15, r));
  const topMax = 0.7;
  while (!web.full) {
    const r0 = Math.sqrt(6 * 6 + re() * (43 * 43 - 6 * 6));
    if (re() * topMax > topUp(r0)) continue;
    const th0 = re() * Math.PI * 2;
    let x = r0 * Math.cos(th0);
    let z = r0 * Math.sin(th0);
    let dir = th0 + Math.PI / 2 + (re() - 0.5) * 1.6;
    const big = 1 + Math.max(0, r0 - 12) / 18; // longer, wider strands further out
    const len = 18 + Math.floor(re() * 60);
    const step = (0.025 + re() * 0.045) * big;
    const y0 = re.gauss() * 0.06;
    const width = (0.012 + re() * 0.03) * big;
    for (let j = 0; j < len && !web.full; j++) {
      dir += (re() - 0.5) * 0.5;
      x += Math.cos(dir) * step;
      z += Math.sin(dir) * step;
      const p = [x + re.gauss() * width, y0 + re.gauss() * 0.025, z + re.gauss() * width];
      const rim = carve(p, nearDisk(p), re);
      if (Number.isNaN(p[0])) continue;
      pushOuter(p[0], p[1], p[2], (0.4 + re() * 0.5) * (rim ? 1.25 : 1), (0.045 + re() * 0.07) * Math.sqrt(big));
    }
  }

  // --- spiral-arm ridges (rigid with the pattern; Cartesian t = 0 positions)
  const ra = rng(20251010);
  const armBubbles = scatterBubbles(ra, Math.max(10, Math.round(46 * Math.sqrt(q))), [], (rand) => {
    const r = expRadius(rand, 6, 5, 22);
    const th = rand() * Math.PI * 2;
    const x = r * Math.cos(th);
    const z = r * Math.sin(th);
    if (rand() > armStrength(x, z)) return null;
    return withShape({ x, z, r: 0.15 + Math.pow(rand(), 1.5) * (0.35 + 0.35 * smoothstep(6, 16, r)) });
  });
  const nearArm = bubbleGrid(armBubbles);
  const armCrusts = armBubbles.map((b) => [b, crustCount(b, rimScale * 1.1)]);
  const arms = new Layer(N(80000) + armCrusts.reduce((sum, c) => sum + c[1], 0));
  const pushArm = (x, y, z, a, size = 0.04 + ra() * 0.07, seed = ra()) => arms.push(x, y, z, 0, dustRgb, a, size, seed);
  for (const [b, n] of armCrusts) pushCrust(ra, b, n, pushArm);
  // along the arm: tangent tilted inwards by the pitch angle
  const pitch = Math.atan(1 / ARM_K);
  while (!arms.full) {
    // about as strong from 6 to 14 kpc, so they read as spirals rather than a ring at the bar ends
    const r0 = Math.sqrt(4.6 * 4.6 + ra() * (26 * 26 - 4.6 * 4.6));
    const th0 = ra() * Math.PI * 2;
    let x = r0 * Math.cos(th0);
    let z = r0 * Math.sin(th0);
    const w = armStrength(x, z);
    if (ra() > w * Math.exp(-(r0 - 6) / 18)) continue;
    if (ra() < 0.1) {
      // a star-forming knot: a compact, bright, yellow-white clump
      const k = 12 + Math.floor(ra() * 36);
      const spread = 0.04 + ra() * 0.1;
      for (let j = 0; j < k && !arms.full; j++) {
        pushArm(x + ra.gauss() * spread, ra.gauss() * 0.03, z + ra.gauss() * spread, 0.6 + ra() * 0.4, 0.05 + ra() * 0.08, 0.85 + ra() * 0.15);
      }
      continue;
    }
    let dir = th0 + Math.PI / 2 + pitch + (ra() - 0.5) * 1.1;
    const len = 14 + Math.floor(ra() * 46);
    const step = 0.03 + ra() * 0.04;
    const y0 = ra.gauss() * 0.05;
    const width = 0.025 + ra() * 0.06;
    for (let j = 0; j < len && !arms.full; j++) {
      dir += (ra() - 0.5) * 0.45;
      x += Math.cos(dir) * step;
      z += Math.sin(dir) * step;
      const p = [x + ra.gauss() * width, y0 + ra.gauss() * 0.03, z + ra.gauss() * width];
      const rim = carve(p, nearArm(p), ra);
      if (Number.isNaN(p[0])) continue;
      pushArm(p[0], p[1], p[2], (0.35 + ra() * 0.5) * (rim ? 1.25 : 1) * (0.55 + 0.45 * w));
    }
  }

  return { web, arms, bubbles: [...diskBubbles, ...armBubbles] };
}

/**
 * Build all particle layers. `q` scales particle counts (1 = desktop).
 * Returned layers carry typed arrays ready for BufferGeometry attributes.
 */
export function buildGalaxy(q = 1) {
  const rand = rng(20250701);
  const N = (n) => Math.max(200, Math.round(n * q));

  // ---------- background stars (static, far away) ----------
  const sky = new Layer(N(7000));
  while (!sky.full) {
    const u = rand() * 2 - 1;
    const ph = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const tint = rand();
    const rgb = tint < 0.2 ? [1, 0.82, 0.62] : tint < 0.45 ? [0.72, 0.8, 1] : [0.95, 0.94, 1];
    const big = rand() < 0.04;
    sky.push(600 * s * Math.cos(ph), 600 * u, 600 * s * Math.sin(ph), 0, rgb, big ? 0.95 : 0.25 + rand() * 0.5, big ? 2.6 + rand() * 1.4 : 1 + rand() * 1.2, rand());
  }

  // ---------- the Milky Way as seen from inside: a broad band of faint stars and haze
  // at "infinity", only shown while the camera stands at the Sun (sections 02 and 04)
  const band = new Layer(N(48000));
  while (!band.full) {
    const lon = rand() * Math.PI * 2;
    const wide = rand() < 0.28;
    const lat = (rand.gauss() * (wide ? 24 : 9) * Math.PI) / 180;
    const haze = rand() < 0.16;
    const r = 600;
    const tint = rand();
    const rgb = haze ? mix3([1, 0.86, 0.7], [0.78, 0.82, 1], tint) : tint < 0.25 ? [1, 0.84, 0.66] : tint < 0.55 ? [0.78, 0.85, 1] : [0.96, 0.95, 1];
    const a = haze ? 0.06 + rand() * 0.08 : (0.3 + rand() * 0.6) * (wide ? 0.7 : 1);
    const size = haze ? 6 + rand() * 12 : 0.9 + Math.pow(rand(), 3) * 2;
    band.push(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon), 0, rgb, a, size, rand());
  }

  // ---------- old disk stars ----------
  const disk = new Layer(N(115000));
  const coreGold = [1, 0.84, 0.6];
  const midWhite = [1, 0.93, 0.84];
  const outerBlue = [0.78, 0.84, 1];
  while (!disk.full) {
    const r = expRadius(rand, 2.6, 0.9, 16.5);
    const th = rand() * Math.PI * 2;
    const hz = 0.07 + 0.012 * r;
    const y = rand.gauss() * hz;
    const t = Math.min(1, r / 12);
    const rgb = t < 0.4 ? mix3(coreGold, midWhite, t / 0.4) : mix3(midWhite, outerBlue, (t - 0.4) / 0.6);
    const a = 0.35 + rand() * 0.5;
    disk.push(r, y, th, omegaAt(r), rgb, a, 0.028 + rand() * 0.05, rand());
  }

  // ---------- young arm stars, in loose clusters ----------
  const young = new Layer(N(60000));
  while (!young.full) {
    const r0 = expRadius(rand, 4.2, 4.6, 15.5);
    const th0 = rand() * Math.PI * 2;
    const x0 = r0 * Math.cos(th0);
    const z0 = r0 * Math.sin(th0);
    const k = 4 + Math.floor(rand() * 22);
    const spread = 0.06 + rand() * 0.22;
    for (let j = 0; j < k && !young.full; j++) {
      const rgb = rand() < 0.8 ? mix3([0.55, 0.7, 1], [0.9, 0.94, 1], rand()) : [1, 0.88, 0.95];
      pushOrbit(young, x0 + rand.gauss() * spread, rand.gauss() * 0.05, z0 + rand.gauss() * spread * 1.6, rgb, 0.55 + rand() * 0.45, 0.04 + rand() * 0.07, rand());
    }
  }

  // ---------- HII regions: compact pink knots ----------
  const hii = new Layer(N(7000));
  while (!hii.full) {
    const r0 = expRadius(rand, 4.5, 4.8, 14.5);
    const th0 = rand() * Math.PI * 2;
    const x0 = r0 * Math.cos(th0);
    const z0 = r0 * Math.sin(th0);
    const k = 10 + Math.floor(rand() * 45);
    const spread = 0.03 + rand() * 0.11;
    for (let j = 0; j < k && !hii.full; j++) {
      const core = j < 3;
      const rgb = core ? [1, 0.88, 0.95] : mix3([1, 0.32, 0.6], [1, 0.55, 0.78], rand());
      pushOrbit(hii, x0 + rand.gauss() * spread, rand.gauss() * 0.03, z0 + rand.gauss() * spread, rgb, core ? 0.9 : 0.5 + rand() * 0.4, core ? 0.09 : 0.05 + rand() * 0.1, rand());
    }
  }

  // ---------- dust filaments (dark lanes in the optical, glowing in the infrared) ----------
  const bubbles = makeBubbles(rand, Math.max(14, Math.round(46 * Math.sqrt(q))));
  const dust = new Layer(N(150000));
  const dustRgb = [0.11, 0.06, 0.035];
  while (!dust.full) {
    const r0 = expRadius(rand, 4.6, 4.9, 15.8);
    const th0 = rand() * Math.PI * 2;
    let x = r0 * Math.cos(th0);
    let z = r0 * Math.sin(th0);
    // strands run mostly along the orbit, with a random wander
    let dir = th0 + Math.PI / 2 + (rand() - 0.5) * 1.6;
    const len = 18 + Math.floor(rand() * 60);
    const step = 0.025 + rand() * 0.045;
    const y0 = rand.gauss() * 0.06;
    const width = 0.012 + rand() * 0.03;
    for (let j = 0; j < len && !dust.full; j++) {
      dir += (rand() - 0.5) * 0.5;
      x += Math.cos(dir) * step;
      z += Math.sin(dir) * step;
      const px = x + rand.gauss() * width;
      const pz = z + rand.gauss() * width;
      const p = [px, y0 + rand.gauss() * 0.025, pz];
      const rim = carve(p, bubbles, rand); // push the material out onto the shell
      if (Number.isNaN(p[0])) continue;
      pushOrbit(dust, p[0], p[1], p[2], dustRgb, (0.4 + rand() * 0.5) * (rim ? 1.25 : 1), 0.045 + rand() * 0.075, rand());
    }
  }

  // ---------- diffuse gas glow (large soft sprites) ----------
  const glow = new Layer(N(5200));
  while (!glow.full) {
    const r = expRadius(rand, 3.3, 0.6, 15.5);
    const th = rand() * Math.PI * 2;
    const t = Math.min(1, r / 13);
    const rgb =
      t < 0.3 ? mix3([1, 0.74, 0.42], [1, 0.8, 0.7], t / 0.3) : t < 0.6 ? mix3([1, 0.8, 0.7], [0.72, 0.76, 1], (t - 0.3) / 0.3) : mix3([0.72, 0.76, 1], [0.45, 0.58, 1], (t - 0.6) / 0.4);
    glow.push(r, rand.gauss() * (0.08 + 0.01 * r), th, omegaAt(r), rgb, 0.05 + rand() * 0.05, 0.35 + rand() * 0.85, rand());
  }

  // ---------- long bar + boxy/peanut bulge (rigid, turns with the pattern) ----------
  const bulge = new Layer(N(62000));
  const cb = Math.cos(BAR_ANGLE);
  const sb = Math.sin(BAR_ANGLE);
  const endFall = 1 - Math.exp(-BAR_HALF / 1.7);
  while (!bulge.full) {
    const pick = rand();
    let x;
    let y; // vertical
    let z; // in-plane, across the bar
    let rgb;
    let a;
    if (pick < 0.55) {
      // thin long bar: exponential along its length, cut at 5 kpc; 30% in the superthin layer
      x = (rand() < 0.5 ? -1 : 1) * -1.7 * Math.log(1 - rand() * endFall);
      const f = Math.abs(x) / BAR_HALF;
      z = rand.gauss() * 0.55 * (1 - 0.35 * f);
      y = rand.gauss() * (rand() < 0.3 ? 0.045 : 0.16) * (1 - 0.3 * f);
      rgb = mix3([1, 0.92, 0.76], [1, 0.76, 0.48], Math.min(1, f * 1.1));
      a = 0.5 + rand() * 0.45;
    } else if (pick < 0.9) {
      // boxy/peanut bulge, ~2 kpc half-length, 1 : 0.5 : 0.4; thicker towards its ends (the X shape)
      x = rand.gauss() * 0.9;
      const f = Math.min(1, Math.abs(x) / 1.2);
      z = rand.gauss() * 0.45;
      y = rand.gauss() * (0.24 + 0.14 * f);
      rgb = mix3([1, 0.95, 0.84], [1, 0.8, 0.55], Math.min(1, Math.hypot(x, z) / 1.6));
      a = 0.35 + rand() * 0.45;
    } else {
      // compact nuclear concentration
      x = rand.gauss() * 0.25;
      z = rand.gauss() * 0.2;
      y = rand.gauss() * 0.12;
      rgb = [1, 0.96, 0.88];
      a = 0.4 + rand() * 0.4;
    }
    bulge.push(x * cb - z * sb, y, x * sb + z * cb, 0, rgb, a, 0.03 + rand() * 0.05, rand());
  }

  // ---------- infrared-only structure, drawn only behind the 03 wipe ----------
  const ir = buildInfrared(q, N, bubbles, dustRgb);

  return { sky, band, disk, young, hii, dust, glow, bulge, irWeb: ir.web, irArms: ir.arms, bubbles: ir.bubbles };
}
