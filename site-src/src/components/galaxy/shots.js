// Scroll → "shot" timeline. Shot s is a continuous number: 0 hero, 1 features,
// 2 all-sky map, 3 bubble plotter, 4 reddening, 5 toolbox, 6 package, 7 cite, 8 page
// bottom. Each
// integer is the moment that section sits in the middle of the viewport.
import { R_SUN, galDir, sunFrame } from './model.js';

export const ANCHORS = ['features', 'sky-map', 'bcp', 'reddening', 'tools-box', 'package', 'cite'];

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/** The 04 target: a sightline through the Aquila Rift (Galactic l, b in degrees). */
export const RED_STAR = { l: 30.5, b: 0.6 };
// 04 on arrival: the reticle locks on for RED_LOCK_S, then the camera zooms in over RED_ZOOM_S
export const RED_LOCK_S = 0.9;
export const RED_ZOOM_S = 0.7;
/** 04 field of view for framing m (0 desktop … 1 phone) and zoom z (0 … 1, about ×3.3). */
export const redFov = (m, z) => lerp(lerp(44, 66, m), lerp(14, 22, m), z);
export const ramp = (s, a, b) => smooth(a, b, s);
/** 0 → 1 → 0 bump: rises over [a, b], holds, falls over [c, d]. */
export const bump = (s, a, b, c, d) => smooth(a, b, s) * (1 - smooth(c, d, s));

/** Scroll positions where each shot is centred; recomputed on resize. */
export function measureAnchors() {
  const vh = window.innerHeight;
  const max = Math.max(1, document.documentElement.scrollHeight - vh);
  const stops = [0];
  for (const id of ANCHORS) {
    const el = document.getElementById(id);
    let y = stops[stops.length - 1] + vh;
    if (el) {
      const r = el.getBoundingClientRect();
      y = r.top + window.scrollY + r.height / 2 - vh / 2;
    }
    stops.push(Math.min(max, Math.max(y, stops[stops.length - 1] + 1)));
  }
  stops.push(Math.max(max, stops[stops.length - 1] + 1));
  return stops;
}

/** Map a scroll offset to shot space, with a short hold around each section. */
export function shotAt(y, stops) {
  if (y <= stops[0]) return 0;
  for (let i = 0; i < stops.length - 1; i++) {
    if (y < stops[i + 1]) {
      const f = (y - stops[i]) / (stops[i + 1] - stops[i]);
      return i + smooth(0.1, 0.9, f);
    }
  }
  return stops.length - 1;
}

// ---------- camera keyframes ----------
// Each shot returns a world-space camera for time t; `m` blends desktop (0)
// and portrait phone (1) framing.

const add = (...vs) => vs.reduce((o, v) => [o[0] + v[0], o[1] + v[1], o[2] + v[2]], [0, 0, 0]);
const scale = (v, k) => [v[0] * k, v[1] * k, v[2] * k];

function orbitCam(dist, elevDeg, azDeg) {
  const e = (elevDeg * Math.PI) / 180;
  const a = (azDeg * Math.PI) / 180;
  return [dist * Math.cos(e) * Math.cos(a), dist * Math.sin(e), dist * Math.cos(e) * Math.sin(a)];
}

const SHOTS = [
  // 0 · hero: the whole galaxy, oblique like a classic spiral portrait
  (t, m) => ({
    pos: orbitCam(lerp(25.5, 40, m), lerp(36, 44, m), 118 + 6 * Math.sin(t * 0.03)),
    target: [0, 0, 0],
    roll: lerp(-17, -8, m),
    fov: 38,
    shift: [lerp(0.36, 0, m), lerp(-0.02, -0.34, m)],
    bright: 1,
  }),
  // 1 · features: dive to the Sun's neighbourhood
  (t, m, f) => ({
    pos: add(f.sun, scale(f.rhat, lerp(3.4, 4.2, m)), scale(f.up, lerp(3.9, 5.6, m)), scale(f.that, lerp(5.8, 3.2, m))),
    target: f.sun,
    roll: 0,
    fov: lerp(46, 60, m),
    shift: [lerp(0.54, 0.25, m), lerp(0.23, 0.6, m)],
    bright: 1.2,
  }),
  // 2 · all-sky map: stand at the Sun, sightline along the disk towards the Galactic
  // Centre; as the map's distance grows the camera flies ~6 kpc in along the disk
  // (and back out as it shrinks)
  (t, m, f, x) => ({
    pos: add(f.sun, scale(f.rhat, 1.1 - 6.2 * (x.push || 0)), scale(f.up, 0.07)),
    target: add(scale(f.sun, 0), scale(f.up, 0.07)),
    roll: 0,
    fov: lerp(64, 80, m),
    shift: [0, lerp(-0.12, -0.28, m)], // keeps the Galactic plane on the map's equator (see mollRect)
    bright: 0.9,
  }),
  // 3 · bubble plotter: pull back out of the plane
  (t, m, f) => ({
    pos: add(f.sun, scale(f.rhat, lerp(13, 20, m)), scale(f.up, lerp(13.5, 19, m)), scale(f.that, 5)),
    target: add(f.sun, scale(f.rhat, -R_SUN * 0.75), scale(f.that, -1)),
    roll: lerp(-8, -4, m),
    fov: 44,
    shift: [lerp(0.06, 0, m), lerp(0.02, 0.05, m)],
    bright: 1,
  }),
  // 4 · reddening: back at the Sun facing the Aquila Rift; once the HUD has locked on to a
  // star behind it, the camera zooms in (x.zoom 0 → 1) and the star dims and reddens.
  // 05 then widens out along nearly the same sightline.
  (t, m, f, x) => {
    const dir = galDir(RED_STAR.l, RED_STAR.b, f);
    const z = x.zoom || 0;
    return {
      pos: add(f.sun, scale(dir, -0.25), scale(f.up, 0.03)),
      target: add(f.sun, scale(dir, 10), scale(f.up, 0.03)),
      roll: lerp(-16, -10, m) + 8 * z,
      fov: redFov(m, z),
      shift: [lerp(0.2, 0, m), lerp(0, -0.12, m)], // star right of the text column (phones: below it)
      bright: 0.95,
    };
  },
  // 5 · toolbox: back at the Sun, looking up at the sky towards Aquila (Altair) with the
  // Milky Way running diagonally; the HUD lays coordinate grids over it
  (t, m, f) => {
    const dir = galDir(lerp(58, 50, m), lerp(-2, -6, m), f);
    return {
      pos: add(f.sun, scale(dir, -0.25), scale(f.up, 0.03)),
      target: add(f.sun, scale(dir, 10), scale(f.up, 0.03)),
      roll: lerp(-28, -20, m),
      fov: lerp(68, 88, m),
      shift: [0, 0],
      bright: 0.95,
    };
  },
  // 6 · package: lift off from the Sun and look back in over the solar neighbourhood
  // towards the Galactic Centre, half way out to the far view of 07
  (t, m, f) => ({
    pos: add(f.sun, scale(f.rhat, lerp(7, 10, m)), scale(f.up, lerp(9, 14, m)), scale(f.that, -3)),
    target: scale(f.sun, 0.45),
    roll: lerp(-10, -6, m),
    fov: lerp(46, 58, m),
    shift: [lerp(0.42, 0, m), lerp(0.08, 0.36, m)],
    bright: 0.85,
  }),
  // 7 · cite: the galaxy recedes into a far spiral
  (t, m) => ({
    pos: orbitCam(lerp(95, 120, m), 52, 150),
    target: [0, 0, 0],
    roll: -12,
    fov: 38,
    shift: [lerp(0.52, 0.3, m), lerp(0.42, 0.5, m)],
    bright: 0.6,
  }),
  // 8 · bottom: gone, only the starfield remains
  (t, m) => ({
    pos: orbitCam(200, 58, 165),
    target: [0, 0, 0],
    roll: -14,
    fov: 38,
    shift: [lerp(0.6, 0.35, m), lerp(0.55, 0.6, m)],
    bright: 0,
  }),
];

const frameScratch = {};

/** Interpolated camera rig for fractional shot s at time t; `x` carries live inputs (e.g. the map's distance). */
export function cameraAt(s, t, m, x = {}) {
  const f = sunFrame(t, frameScratch);
  const i = Math.max(0, Math.min(SHOTS.length - 2, Math.floor(s)));
  let k = Math.min(1, Math.max(0, s - i));
  // 02 needs the galaxy exactly edge-on while its map is up: arrive early, leave late
  if (i === 1) k = smooth(0, 1, k / 0.62);
  else if (i === 2) k = smooth(0, 1, (k - 0.38) / 0.62);
  const A = SHOTS[i](t, m, f, x);
  const B = SHOTS[i + 1](t, m, f, x);
  const mixV = (a, b) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  return {
    pos: mixV(A.pos, B.pos),
    target: mixV(A.target, B.target),
    roll: lerp(A.roll, B.roll, k),
    fov: lerp(A.fov, B.fov, k),
    shift: [lerp(A.shift[0], B.shift[0], k), lerp(A.shift[1], B.shift[1], k)],
    bright: lerp(A.bright, B.bright, k),
    frame: f,
  };
}

// width of the section text column (.showcase__content in ShowcaseSections.css)
const MAP_TEXT_W = 440;

/** Where the Mollweide all-sky map sits on screen (px). */
export function mollRect(W, H, m) {
  // landscape: start right of the 02 text column (1180 px container, 24 px gutter) and
  // stop short of the right edge; cy stays put so the equator holds the Galactic plane
  const left = Math.max(24, (W - 1180) / 2 + 24) + MAP_TEXT_W + 40;
  const aWide = Math.min(W * 0.28, H * 0.56, (W - 64 - left) / 2);
  const a = lerp(aWide, W * 0.44, m);
  return { cx: lerp(Math.max(W * 0.65, left + aWide), W * 0.5, m), cy: lerp(H * 0.56, H * 0.64, m), a, b: a / 2 };
}

/** Everything that is not the camera, as a function of shot s. */
export function effectsAt(s) {
  return {
    locate: bump(s, 0.5, 0.88, 1.22, 1.55), // 01 · sightline lock-on HUD
    // the Sun marker stays on from 01 until 02's map has bloomed out of it, and comes back
    // while the map folds back into it
    sun: bump(s, 0.45, 0.85, 1.72, 1.88) + bump(s, 2.15, 2.27, 2.36, 2.46),
    // 02 · dust map, only while the camera holds edge-on: the map's origin is the Sun, so
    // the Mollweide ellipse blooms out of the Sun's place on screen (0 → 1), and folds
    // back into it before the camera pulls away
    sky: s > 1.6 && s < 2.4 ? 1 : 0,
    // (the fold starts past s = 2.11, where the 02 nav link lands, so the map rests full size)
    bloom: s < 2 ? ramp(s, 1.63, 1.95) : 1 - ramp(s, 2.15, 2.37),
    // 03 · infrared mask edge (1 = none, 0 = full screen): sweeps in right → left, and like
    // the 02 map sweeps back left → right on the way to 04 (so scrolling up from 04 it
    // comes back in right → left)
    wipe: s < 3 ? 1 - ramp(s, 2.58, 3.02) : ramp(s, 3.3, 3.72),
    ir: 1 - ramp(s, 3.7, 3.74),
    red: bump(s, 3.62, 3.92, 4.3, 4.55), // 04 · a star reddening behind the Aquila Rift
    grid: bump(s, 4.62, 4.95, 5.3, 5.6), // 05 · sky graticules
    band: bump(s, 1.5, 1.9, 2.3, 2.6) + bump(s, 3.5, 3.9, 5.35, 5.7), // naked-eye Milky Way while standing at the Sun
  };
}
