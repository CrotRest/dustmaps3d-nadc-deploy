import { InputError, requiredNumber } from './parse.js';

/** Shared colour settings → the backend's PlotStyle fields. */
function styleParams(f) {
  const vmin = requiredNumber(f.vmin);
  const vmax = requiredNumber(f.vmax);
  if (vmin >= vmax) throw new InputError('errColorRange');
  if (f.scale === 'log' && vmin <= 0) throw new InputError('errLogMin');
  return { vmin, vmax, norm: f.scale, colormap: f.cmap, smoothing_sigma: requiredNumber(f.sigma) };
}

function distanceParams(f, strict = false) {
  const dMin = requiredNumber(f.dmin);
  const dMax = requiredNumber(f.dmax);
  if (dMin < 0 || dMax <= 0 || (strict && dMin <= 0)) throw new InputError(strict ? 'errDminPos' : 'errDist');
  if (dMin >= dMax) throw new InputError('errDistRange');
  return { d_min: dMin, d_max: dMax };
}

/** Form → body of POST /plots/car (a longitude/latitude box). */
export function carRequest(f) {
  return {
    coord_system: f.frame,
    lon_min: requiredNumber(f.lmin),
    lon_max: requiredNumber(f.lmax),
    lat_min: requiredNumber(f.bmin),
    lat_max: requiredNumber(f.bmax),
    ...distanceParams(f),
    ...styleParams(f),
  };
}

/** Form → body of POST /plots/sin (an orthographic view around a centre). */
export function sinRequest(f) {
  return {
    coord_system: f.frame,
    lon_center: requiredNumber(f.lc),
    lat_center: requiredNumber(f.bc),
    fov: requiredNumber(f.fov),
    ...distanceParams(f),
    ...styleParams(f),
    mark_region: false, // the site offers no marker circle on this view
  };
}

/** Slice planes of the orthogonal slice: the two plane axes and the axis the slab is thick along. */
export const ORT_PLANES = { xy: ['x', 'y', 'z'], xz: ['x', 'z', 'y'], yz: ['y', 'z', 'x'] };

/**
 * Form → body of POST /plots/ort (an axis-aligned slice or slab in heliocentric Galactic
 * X/Y/Z: X towards the Galactic centre, Y towards l = 90°, Z towards the north pole).
 * The backend samples on a resolution_pc grid and refuses more than 2,000,000 points.
 */
export function ortRequest(f) {
  const vmin = requiredNumber(f.vmin);
  const vmax = requiredNumber(f.vmax);
  if (vmin >= vmax) throw new InputError('errColorRange');
  if (f.scale === 'log' && vmin <= 0) throw new InputError('errLogMin');
  const [axis1, axis2, fixed] = ORT_PLANES[f.plane];
  const r1 = [requiredNumber(f.r1min), requiredNumber(f.r1max)];
  const r2 = [requiredNumber(f.r2min), requiredNumber(f.r2max)];
  const fr = [requiredNumber(f.fmin), requiredNumber(f.fmax)];
  if (r1[0] >= r1[1] || r2[0] >= r2[1] || fr[0] > fr[1]) throw new InputError('errOrtRange');
  const res = requiredNumber(f.res);
  const smooth = requiredNumber(f.smooth);
  if (res <= 0 || smooth < 0 || smooth > 100) throw new InputError('errOrtRes');
  const step = res / 1000;
  const cells = [r1[1] - r1[0], r2[1] - r2[0], fr[1] - fr[0]].map((w) => Math.max(1, Math.ceil(w / step)));
  if (cells[0] * cells[1] * cells[2] > 2_000_000 || smooth / res > 100) throw new InputError('errOrtSamples');
  return {
    axis1,
    axis2,
    fixed_axis: fixed,
    range1_min: r1[0],
    range1_max: r1[1],
    range2_min: r2[0],
    range2_max: r2[1],
    fixed_range_min: fr[0],
    fixed_range_max: fr[1],
    resolution_pc: res,
    smooth_sigma_pc: smooth,
    norm: f.scale,
    vmin,
    vmax,
    colormap: f.cmap,
    aggregate: f.agg,
  };
}

/**
 * Form → body of POST /plots/dpr (a vertical oblique slice through the 3D grid).
 * The slice plane's horizontal direction makes angle θ with +X (towards the Galactic
 * centre) and lies `offset` kpc from the Sun; the backend always uses a log colour scale.
 */
export function dprRequest(f) {
  const vmin = requiredNumber(f.vmin);
  const vmax = requiredNumber(f.vmax);
  if (vmin >= vmax) throw new InputError('errColorRange');
  if (vmin <= 0) throw new InputError('errLogMin');
  const halfWidth = requiredNumber(f.halfWidth);
  if (halfWidth <= 0) throw new InputError('errHalfWidth');
  const sMin = requiredNumber(f.smin);
  const sMax = requiredNumber(f.smax);
  const zMin = requiredNumber(f.zmin);
  const zMax = requiredNumber(f.zmax);
  if (sMin >= sMax || zMin >= zMax) throw new InputError('errSliceRange');
  const angle = requiredNumber(f.angle);
  if (Math.abs(angle) > 360) throw new InputError('errAngle');
  return {
    angle_degrees: angle,
    offset: requiredNumber(f.offset),
    half_width: halfWidth,
    s_range_min: sMin,
    s_range_max: sMax,
    z_range_min: zMin,
    z_range_max: zMax,
    norm: 'log',
    vmin,
    vmax,
    colormap: f.cmap,
    show_markers: Boolean(f.origin),
    show_superbubbles: Boolean(f.bubbles),
  };
}

/**
 * The bubble plotter's three orthographic panels, as the NADC page builds them:
 * the chosen shell [d_min, d_max] in the middle, flanked by equally thick shells
 * just in front of it and just behind it. FOV = 2.5 × bubble diameter (≤ 180°).
 * @returns {{near:object, mid:object, far:object, analysis:object, schematic:object}}
 */
export function bubbleRequests(f) {
  const l = requiredNumber(f.l);
  const b = requiredNumber(f.b);
  const dia = requiredNumber(f.dia);
  if (dia <= 0) throw new InputError('errDia');
  const { d_min: dMin, d_max: dMax } = distanceParams(f, true);
  const delta = dMax - dMin;
  const base = {
    coord_system: 'galactic',
    lon_center: l,
    lat_center: b,
    fov: Math.min(dia * 2.5, 180),
    bubble_diameter: dia,
    mark_region: Boolean(f.mark),
    mark_color: f.markColor,
    ...styleParams(f),
  };
  return {
    near: { ...base, d_min: Math.max(0, dMin - delta), d_max: dMin, show_color_bar: false },
    mid: { ...base, d_min: dMin, d_max: dMax, show_color_bar: false },
    far: { ...base, d_min: dMax, d_max: dMax + delta, show_color_bar: true },
    analysis: { l, b, d: (dMin + dMax) / 2, d_low: dMin, d_up: dMax, diameter: dia },
    schematic: { diameter: dia },
  };
}
