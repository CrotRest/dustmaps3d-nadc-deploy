// 2-D overlay drawn on top of the WebGL galaxy: the Sun marker, the section-01
// sightline lock-on, the infrared wipe edge, the section-04 reddening star and the
// section-05 sky graticules.
// Everything is placed by projecting world-space points through the live camera.
import { Matrix4, Quaternion } from 'three';
import { createMockModel } from '../../data/mockModel.js';
import { eclToEq, eqToEcl, eqToGal } from '../../lib/coords.js';
import { BATCH_PERIOD, LOCK_PERIOD, demoBus } from './demoBus.js';
import { RED_STAR } from './shots.js';

const D = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const LAV = [255, 255, 255];
const GOLD = [255, 195, 90];
const INK = [244, 244, 247];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ---------- 01 · sightlines ----------

const model = createMockModel();
const TARGETS = [
  { l: 24.0, b: 1.6, d: 2.6 },
  { l: 331.5, b: -2.2, d: 2.3 },
  { l: 62.5, b: 3.4, d: 1.8 },
  { l: 352.0, b: 0.8, d: 3.0 },
].map((t) => {
  const m = model.sightline(t.l, t.b, t.d);
  const curve = [];
  for (let i = 0; i <= 28; i++) curve.push(model.ebvCumul(t.l, t.b, (t.d * i) / 28));
  return { ...t, ebv: m.ebv, sigma: m.sigma, curve };
});
// towards the outer Galaxy (l ≈ 190–225°), which the 01 shot lays out to the right of the
// Sun, in the open sky between the logo row and the feature rows
const BATCH = [
  [188, -3.1, 0.8],
  [192, 2.4, 1.2],
  [196, -5.6, 0.6],
  [200, 1.2, 1.5],
  [205, -1.8, 1.0],
  [209, 4.4, 1.3],
  [213, -0.6, 1.7],
  [217, -4.2, 0.9],
  [221, 2.8, 1.4],
  [225, -2.4, 1.1],
];
// scan line: 03 optical → infrared
const IR_SCAN = { glow: [255, 148, 68], line: [255, 214, 160], left: 'OPTICAL', right: 'INFRARED', rightInk: [255, 190, 120] };

// reduced motion: still frames of each demo (read-out showing / every dot lit)
const FROZEN_LOCK = 0.75 * LOCK_PERIOD;
const FROZEN_BATCH = 0.87 * BATCH_PERIOD;

const fmtSigned = (v, n) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(n);
const pad3 = (v) => v.toFixed(2).padStart(6, '0');

// ---------- 04 · reddening ----------
// A star behind the Aquila Rift: as the sightline reaches it through more dust, E(B−V)
// climbs and the star dims and reddens. (The band-by-band A_λ read-out is left out until
// the reddening coefficients to show are settled.)
const RED_LOOP = 9;
const RED_D_MAX = 2.5;
// cumulative E(B−V) along the sightline: a steep step at the rift (~0.2–0.65 kpc), then a slow climb
const ebvAt = (d) => {
  const k = seg(d, 0.2, 0.65);
  return k * k * (3 - 2 * k) + 0.08 * d;
};
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const STAR_BLUE = [205, 222, 255];
const STAR_RED = [255, 132, 66];

// ---------- 05 · sky graticules ----------
// Looking out from the Sun: real equatorial / Galactic / ecliptic grids laid on
// the sky, morphing from one frame to the next, with a real star read out in all
// three. Frame → Galactic rotations come from the site's own converters.

const vecOf = (lon, lat) => [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
const galOfEq = (ra, dec) => {
  const g = eqToGal(ra, dec);
  return vecOf(g.l, g.b);
};
const galOfEcl = (lam, bet) => {
  const e = eclToEq(lam, bet);
  return galOfEq(e.ra, e.dec);
};
function frameQuat(toGal) {
  const [x, y, z] = [toGal(0, 0), toGal(90, 0), toGal(0, 90)];
  const m = new Matrix4().set(x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, 0, 0, 0, 1);
  return new Quaternion().setFromRotationMatrix(m);
}
const FRAMES = {
  EQ: { q: frameQuat(galOfEq), name: 'EQUATORIAL · J2000', lonLabel: (lon) => `${Math.round(lon / 15) % 24}h` },
  GAL: { q: new Quaternion(), name: 'GALACTIC', lonLabel: (lon) => `${Math.round(lon) % 360}°` },
  ECL: { q: frameQuat(galOfEcl), name: 'ECLIPTIC · J2000', lonLabel: (lon) => `${Math.round(lon) % 360}°` },
};
const GRID_LOOP = 13.5;
const GRID_SEQ = [
  { t: 0, f: 'EQ' },
  { t: 4.5, f: 'GAL' },
  { t: 9, f: 'ECL' },
];
const MORPH_S = 1.8;

const pad2 = (n) => String(n).padStart(2, '0');
function hms(raDeg) {
  const ts = (((raDeg % 360) + 360) % 360) * 240;
  const h = Math.floor(ts / 3600);
  const m = Math.floor((ts - h * 3600) / 60);
  return `${pad2(h)}h${pad2(m)}m${(ts - h * 3600 - m * 60).toFixed(1).padStart(4, '0')}s`;
}
function dms(dec) {
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const sec = Math.round((a - d - m / 60) * 3600);
  return `${dec < 0 ? '−' : '+'}${pad2(d)}°${pad2(m)}′${pad2(sec)}″`;
}
const deg = (v, signed) => (signed ? (v < 0 ? '−' : '+') : '') + Math.abs(v).toFixed(4).padStart(signed ? 7 : 8, '0') + '°';

function star(name, ra, dec) {
  const g = eqToGal(ra, dec);
  const e = eqToEcl(ra, dec);
  return {
    name,
    gal: vecOf(g.l, g.b),
    rows: {
      EQ: ['RA ', hms(ra), 'Dec', dms(dec)],
      GAL: ['l  ', deg(g.l), 'b  ', deg(g.b, true)],
      ECL: ['λ  ', deg(e.lambda), 'β  ', deg(e.beta, true)],
    },
  };
}
const ALTAIR = star('ALTAIR · α AQL', 297.69583, 8.86832);
const VEGA = star('VEGA · α LYR', 279.23473, 38.78369);
const SCRAMBLE = '0123456789';

const PARALLELS = [-60, -30, 30, 60];
const MERIDIANS = Array.from({ length: 12 }, (_, i) => i * 30);

// ---------- 02 · Mollweide frame for the dust-map particles ----------

function mollTheta(latDeg) {
  const p = latDeg * D;
  let t = p;
  for (let i = 0; i < 12; i++) t -= (2 * t + Math.sin(2 * t) - Math.PI * Math.sin(p)) / (2 + 2 * Math.cos(2 * t) + 1e-9);
  return t;
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dirty = true;

  function resize(w, h, dpr) {
    W = w;
    H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }

  function drawSun(S, a, t) {
    if (!S.visible || a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    const ph = (t * 0.6) % 1;
    ctx.strokeStyle = rgba(GOLD, 0.55 * (1 - ph));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(S.x, S.y, 8 + 22 * ph, 0, 7);
    ctx.stroke();
    ctx.strokeStyle = rgba(GOLD, 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(S.x, S.y, 7, 0, 7);
    ctx.stroke();
    ctx.fillStyle = '#fff6df';
    ctx.beginPath();
    ctx.arc(S.x, S.y, 2.6, 0, 7);
    ctx.fill();
    ctx.strokeStyle = rgba(INK, 0.75);
    ctx.beginPath();
    ctx.moveTo(S.x + 8, S.y - 8);
    ctx.lineTo(S.x + 20, S.y - 20);
    ctx.lineTo(S.x + 30, S.y - 20);
    ctx.stroke();
    ctx.font = `600 10px ${MONO}`;
    ctx.fillStyle = rgba(INK, 1);
    ctx.textBaseline = 'middle';
    ctx.fillText('SUN  ☉', S.x + 34, S.y - 20);
    ctx.restore();
  }

  // 01 · which demo is playing, since when, and how far each has faded in
  const demo = { mode: null, lastT: 0, query: { t0: 0, a: 0, n: -1 }, batch: { t0: 0, a: 0 } };

  function updateDemo(t, frozen) {
    const dt = clamp(t - demo.lastT, 0, 0.1);
    demo.lastT = t;
    const mode = demoBus.mode;
    if (mode !== demo.mode) {
      demo.mode = mode;
      // every hover starts its demo from the top; the single query moves on to the next target
      if (mode) demo[mode].t0 = t;
      if (mode === 'query') demo.query.n++;
    }
    for (const key of ['query', 'batch']) {
      const d = demo[key];
      const on = mode === key;
      d.a = frozen ? +on : on ? Math.min(1, d.a + dt / 0.25) : Math.max(0, d.a - dt / 0.4);
    }
  }

  function drawLocate(a, t, P, frozen) {
    const S = P.sun;
    if (!S.visible) return;
    const { query: q, batch: b } = demo;
    if (b.a > 0.01) drawBatch(a * b.a, frozen ? FROZEN_BATCH : t - b.t0, P);
    if (q.a > 0.01) drawSingle(a * q.a, frozen ? FROZEN_LOCK : t - q.t0, t, Math.max(0, q.n), P);
  }

  /** Batch: a string of sightlines lighting up one after another; `tl` is time since the demo started. */
  function drawBatch(a, tl, P) {
    const S = P.sun;
    ctx.save();
    ctx.globalAlpha = a;
    const ub = (tl % BATCH_PERIOD) / BATCH_PERIOD;
    const lit = Math.min(BATCH.length, Math.floor(ub * (BATCH.length + 3)));
    let maxX = -Infinity;
    let cy = 0;
    let nVis = 0;
    BATCH.forEach(([l, b, d], i) => {
      const q = P.galPoint(l, b, d);
      if (!q.visible) return;
      maxX = Math.max(maxX, q.x);
      cy += q.y;
      nVis++;
      const on = i < lit;
      if (on) {
        ctx.strokeStyle = rgba(LAV, 0.12);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(S.x, S.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
        const age = ub * (BATCH.length + 3) - i;
        if (age < 1) {
          ctx.strokeStyle = rgba(GOLD, 0.7 * (1 - age));
          ctx.beginPath();
          ctx.arc(q.x, q.y, 3 + 12 * age, 0, 7);
          ctx.stroke();
        }
      }
      ctx.fillStyle = on ? rgba(GOLD, 0.95) : rgba(LAV, 0.4);
      ctx.beginPath();
      ctx.arc(q.x, q.y, on ? 2.4 : 1.8, 0, 7);
      ctx.fill();
    });
    if (nVis && W >= 600) {
      // label beside the cluster, away from the SUN tag
      const bx = Math.min(maxX + 16, W - 96);
      const by = cy / nVis - 6;
      ctx.font = `500 10px ${MONO}`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = rgba(INK, 0.95);
      ctx.fillText(`BATCH  ${String(lit).padStart(2, '0')}/${BATCH.length}`, bx, by);
      ctx.fillStyle = rgba(LAV, 0.18);
      ctx.fillRect(bx, by + 6, 78, 2);
      ctx.fillStyle = rgba(GOLD, 0.9);
      ctx.fillRect(bx, by + 6, (78 * lit) / BATCH.length, 2);
    }
    ctx.restore();
  }

  /** Single query: sightline → reticle lock → read-out, starting at target `n`; `tl` is time since the demo started. */
  function drawSingle(a, tl, t, n, P) {
    const S = P.sun;
    const idx = (n + Math.floor(tl / LOCK_PERIOD)) % TARGETS.length;
    const u = (tl % LOCK_PERIOD) / LOCK_PERIOD;
    const tg = TARGETS[idx];
    const T = P.galPoint(tg.l, tg.b, tg.d);
    const fade = 1 - seg(u, 0.9, 1);
    ctx.save();
    ctx.globalAlpha = a;
    if (T.visible) {
      ctx.globalAlpha = a * fade;
      const g = easeInOut(seg(u, 0, 0.3));
      const hx = S.x + (T.x - S.x) * g;
      const hy = S.y + (T.y - S.y) * g;
      ctx.strokeStyle = rgba(LAV, 0.85);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -t * 18;
      ctx.beginPath();
      ctx.moveTo(S.x, S.y);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      // 1-kpc ticks along the sightline
      const nx = -(T.y - S.y);
      const ny = T.x - S.x;
      const nl = Math.hypot(nx, ny) || 1;
      for (let k = 1; k < tg.d; k++) {
        const f = k / tg.d;
        if (f > g) break;
        const px = S.x + (T.x - S.x) * f;
        const py = S.y + (T.y - S.y) * f;
        ctx.beginPath();
        ctx.moveTo(px - (nx / nl) * 4, py - (ny / nl) * 4);
        ctx.lineTo(px + (nx / nl) * 4, py + (ny / nl) * 4);
        ctx.stroke();
      }
      if (g < 1) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(hx, hy, 2.2, 0, 7);
        ctx.fill();
      }

      const rp = seg(u, 0.2, 0.45);
      if (rp > 0) {
        const locked = rp >= 1;
        const size = 54 + (15 - 54) * easeOutCubic(rp);
        const rot = (1 - easeOutCubic(rp)) * 45 * D;
        ctx.save();
        ctx.translate(T.x, T.y);
        ctx.rotate(rot);
        ctx.strokeStyle = locked ? rgba(GOLD, 1) : rgba(LAV, 0.9);
        ctx.lineWidth = 1.6;
        const arm = Math.max(5, size * 0.38);
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          ctx.beginPath();
          ctx.moveTo(sx * size, sy * (size - arm));
          ctx.lineTo(sx * size, sy * size);
          ctx.lineTo(sx * (size - arm), sy * size);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = locked ? rgba(GOLD, 1) : rgba(LAV, 0.9);
        ctx.beginPath();
        ctx.arc(T.x, T.y, 2.4, 0, 7);
        ctx.fill();
      }
      const lf = seg(u, 0.45, 0.66);
      if (lf > 0 && lf < 1) {
        ctx.strokeStyle = rgba(GOLD, 0.8 * (1 - lf));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(T.x, T.y, 15 + 44 * easeOutCubic(lf), 0, 7);
        ctx.stroke();
      }

      const ro = seg(u, 0.47, 0.62);
      // phones: the read-out would sit on the section text, so the reticle alone tells the story
      if (ro > 0 && W >= 600) {
        const bw = 196;
        const bh = 96;
        // prefer below the target, clear of the logo row above
        const right = T.x + 30 + bw < W - 12;
        const bx = right ? T.x + 30 : T.x - 30 - bw;
        const below = T.y + 22 + bh < H - 12;
        const by = below ? T.y + 22 : clamp(T.y - bh - 22, 70, H - bh - 12);
        ctx.strokeStyle = rgba(GOLD, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(T.x + (right ? 15 : -15), T.y + (below ? 8 : -8));
        ctx.lineTo(right ? bx : bx + bw, below ? by : by + bh);
        ctx.stroke();
        ctx.fillStyle = 'rgba(5,6,14,0.82)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = rgba(GOLD, 0.42);
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        ctx.fillStyle = rgba(GOLD, 0.95);
        ctx.fillRect(bx, by, 3, 3);
        ctx.fillRect(bx + bw - 3, by + bh - 3, 3, 3);
        const lines = [
          { s: `SIGHTLINE ${String(idx + 1).padStart(2, '0')} · LOCKED`, c: rgba(INK, 0.85), f: `500 9.5px ${MONO}` },
          { s: `l ${pad3(tg.l)}°  b ${fmtSigned(tg.b, 2)}°`, c: rgba(INK, 0.92), f: `500 11px ${MONO}` },
          { s: `d ${tg.d.toFixed(2)} kpc`, c: rgba(INK, 0.92), f: `500 11px ${MONO}` },
          { s: `E(B−V) ${tg.ebv.toFixed(3)} ± ${tg.sigma.toFixed(3)}`, c: rgba(GOLD, 1), f: `600 11px ${MONO}` },
        ];
        const total = lines.reduce((n, ln) => n + ln.s.length, 0);
        let budget = Math.floor(total * clamp(ro * 1.15, 0, 1));
        ctx.textBaseline = 'alphabetic';
        lines.forEach((ln, i) => {
          if (budget <= 0) return;
          const s = ln.s.slice(0, budget);
          budget -= ln.s.length;
          ctx.font = ln.f;
          ctx.fillStyle = ln.c;
          ctx.fillText(s, bx + 11, by + 17 + i * 16);
        });
        // cumulative E(B−V) along the sightline
        const sx0 = bx + 11;
        const sy0 = by + bh - 10;
        const sw = bw - 22;
        const top = tg.curve[tg.curve.length - 1] || 1;
        const n = Math.max(2, Math.round(tg.curve.length * ro));
        ctx.strokeStyle = rgba(GOLD, 0.85);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = sx0 + (sw * i) / (tg.curve.length - 1);
          const y = sy0 - (tg.curve[i] / top) * 16;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = rgba(INK, 0.18);
        ctx.beginPath();
        ctx.moveTo(sx0, sy0 + 0.5);
        ctx.lineTo(sx0 + sw, sy0 + 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawWipe(a, wipe, look = IR_SCAN) {
    const x = wipe * W;
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
    g.addColorStop(0, rgba(look.glow, 0));
    g.addColorStop(0.5, rgba(look.glow, 0.28));
    g.addColorStop(1, rgba(look.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 70, 0, 140, H);
    ctx.fillStyle = rgba(look.line, 0.95);
    ctx.fillRect(x - 0.75, 0, 1.5, H);
    ctx.font = `600 10px ${MONO}`;
    ctx.textBaseline = 'middle';
    const y = H - 30;
    ctx.fillStyle = rgba(INK, 0.9);
    ctx.textAlign = 'right';
    ctx.fillText(look.left, x - 14, y);
    ctx.fillStyle = rgba(look.rightInk, 0.95);
    ctx.textAlign = 'left';
    ctx.fillText(look.right, x + 14, y);
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 26);
    ctx.lineTo(x, y - 20);
    ctx.lineTo(x + 5, y - 26);
    ctx.fillStyle = rgba(look.line, 0.95);
    ctx.fill();
    ctx.restore();
  }

  function gridState(t) {
    let i = 0;
    for (let k = 0; k < GRID_SEQ.length; k++) if (t >= GRID_SEQ[k].t) i = k;
    const cur = GRID_SEQ[i];
    const prev = GRID_SEQ[(i - 1 + GRID_SEQ.length) % GRID_SEQ.length];
    const p = clamp((t - cur.t) / MORPH_S, 0, 1);
    const q = new Quaternion().slerpQuaternions(FRAMES[prev.f].q, FRAMES[cur.f].q, easeInOut(p));
    return { q, key: cur.f, since: t - cur.t, morph: p };
  }

  function drawSkyGrid(a, t, P) {
    const g = gridState(t);
    const e = new Matrix4().makeRotationFromQuaternion(g.q).elements;
    const toScreen = (v) =>
      P.skyPoint([e[0] * v[0] + e[4] * v[1] + e[8] * v[2], e[1] * v[0] + e[5] * v[1] + e[9] * v[2], e[2] * v[0] + e[6] * v[1] + e[10] * v[2]]);
    const narrow = W < 600;
    const path = (pts) => {
      ctx.beginPath();
      let pen = false;
      let lx = 0;
      let ly = 0;
      for (const q of pts) {
        const ok = q.visible && (!pen || Math.hypot(q.x - lx, q.y - ly) < W * 0.5);
        if (ok) {
          if (pen) ctx.lineTo(q.x, q.y);
          else ctx.moveTo(q.x, q.y);
        }
        pen = ok;
        lx = q.x;
        ly = q.y;
      }
      ctx.stroke();
    };
    const line = (fn, from, to, step) => {
      const pts = [];
      for (let v = from; v <= to + 1e-6; v += step) pts.push(toScreen(fn(v)));
      return pts;
    };

    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.8;
    PARALLELS.forEach((lat) => path(line((lon) => vecOf(lon, lat), 0, 360, 2)));
    MERIDIANS.forEach((lon) => path(line((lat) => vecOf(lon, lat), -84, 84, 2)));
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.1;
    path(line((lon) => vecOf(lon, 0), 0, 360, 1));

    // labels along the frame's equator and on the parallels
    const fr = FRAMES[g.key];
    const labelA = clamp((g.morph - 0.6) / 0.4, 0, 1);
    ctx.font = `400 10px ${MONO}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255,255,255,${0.9 * labelA})`;
    MERIDIANS.forEach((lon) => {
      const q = toScreen(vecOf(lon, 0));
      if (!q.visible || q.x < W * (narrow ? 0.04 : 0.5) || q.x > W - 30 || q.y < 80 || q.y > H - 30) return;
      ctx.fillRect(q.x - 0.5, q.y - 5, 1, 10);
      ctx.fillText(fr.lonLabel(lon), q.x + 5, q.y + 11);
    });
    PARALLELS.forEach((lat) => {
      let best = null;
      for (let lon = 0; lon < 360; lon += 3) {
        const q = toScreen(vecOf(lon, lat));
        if (!q.visible || q.y < 80 || q.y > H - 40 || q.x > W - 40) continue;
        if (!best || Math.abs(q.x - W * 0.86) < Math.abs(best.x - W * 0.86)) best = q;
      }
      if (best && Math.abs(best.x - W * 0.86) < W * 0.12) ctx.fillText(`${lat > 0 ? '+' : '−'}${Math.abs(lat)}°`, best.x + 5, best.y - 8);
    });
    ctx.restore();

    // fade the grid out under the text column on wide screens
    if (!narrow) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const m = ctx.createLinearGradient(0, 0, W * 0.5, 0);
      m.addColorStop(0, 'rgba(0,0,0,0.92)');
      m.addColorStop(0.75, 'rgba(0,0,0,0.6)');
      m.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = m;
      ctx.fillRect(0, 0, W * 0.5, H);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = a;
    // a second, unlabelled star for context
    const v = P.skyPoint(VEGA.gal);
    if (v.visible && v.x > W * (narrow ? 0 : 0.45)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 6, 0, 7);
      ctx.stroke();
      ctx.font = `400 9.5px ${MONO}`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.textBaseline = 'middle';
      ctx.fillText(VEGA.name, v.x + 11, v.y);
    }

    // target star: fine crosshair + its coordinates in all three frames
    const s0 = P.skyPoint(ALTAIR.gal);
    if (s0.visible) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(s0.x + dx * 9, s0.y + dy * 9);
        ctx.lineTo(s0.x + dx * 26, s0.y + dy * 26);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.35 * pulse})`;
      ctx.beginPath();
      ctx.arc(s0.x, s0.y, 15 + pulse * 2, 0, 7);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s0.x, s0.y, 1.8, 0, 7);
      ctx.fill();

      const fs = narrow ? 10 : 11;
      const lh = narrow ? 15 : 18;
      const bw = narrow ? 214 : 268;
      // beside the star on wide screens, underneath it on phones
      const right = !narrow && s0.x + 40 + bw < W - 10;
      const bx = narrow ? clamp(s0.x - bw / 2, 12, W - bw - 12) : right ? s0.x + 40 : s0.x - 40 - bw;
      const by = narrow ? clamp(s0.y + 44, 76, H - lh * 5 - 20) : clamp(s0.y - 36, 76, H - lh * 5 - 20);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      if (narrow) {
        ctx.moveTo(s0.x, s0.y + 28);
        ctx.lineTo(s0.x, by - 4);
      } else {
        ctx.moveTo(s0.x + (right ? 28 : -28), s0.y);
        ctx.lineTo(right ? bx - 6 : bx + bw + 6, by + 4);
      }
      ctx.stroke();
      ctx.textBaseline = 'alphabetic';
      ctx.font = `500 ${fs - 1}px ${MONO}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(ALTAIR.name, bx, by + 8);
      ctx.font = `400 ${fs - 1.5}px ${MONO}`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(FRAMES[g.key].name, bx, by + 8 + lh);
      ['EQ', 'GAL', 'ECL'].forEach((key, i) => {
        const on = key === g.key;
        const [k1, v1, k2, v2] = ALTAIR.rows[key];
        let text = `${k1} ${v1}  ${k2} ${v2}`;
        // freshly selected frame: digits resolve left to right
        if (on && g.since < 0.9) {
          const done = Math.floor((g.since / 0.9) * text.length);
          text = [...text].map((c, j) => (j >= done && SCRAMBLE.includes(c) ? SCRAMBLE[(j * 7 + Math.floor(t * 30)) % 10] : c)).join('');
        }
        ctx.font = `${on ? 500 : 400} ${fs}px ${MONO}`;
        ctx.fillStyle = on ? rgba(GOLD, 1) : 'rgba(255,255,255,0.7)';
        const y = by + 8 + lh * (i + 2) + 4;
        ctx.fillText(text, bx, y);
        if (on) ctx.fillRect(bx - 10, y - fs * 0.45, 4, 1);
      });
    }

    // angular scale: 10° on the sky, and what that spans at 10 kpc
    const ppd = P.pxPerDeg();
    const L = 10 * ppd;
    if (L > 30 && L < W * 0.45) {
      const rx = W - (narrow ? 20 : 64) - L;
      const ry = H - (narrow ? 34 : 64);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + L, ry);
      for (let k = 0; k <= 10; k++) {
        const h = k % 5 === 0 ? 6 : 3;
        ctx.moveTo(rx + k * ppd, ry - h);
        ctx.lineTo(rx + k * ppd, ry);
      }
      ctx.stroke();
      ctx.font = `400 10px ${MONO}`;
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'right';
      ctx.fillText('θ = 10°', rx + L, ry - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.textBaseline = 'top';
      ctx.fillText('≈ 1.75 kpc @ d = 10 kpc', rx + L, ry + 8);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  /** 04: reticle locks on to the star, the camera zooms in (R.zoom), then the star dims and reddens. */
  function drawReddening(a, R, P) {
    const narrow = W < 600;
    const p = P.skyPoint(vecOf(RED_STAR.l, RED_STAR.b));
    if (!p.visible) return;
    // after the zoom, the distance to the star sweeps out, holds, and comes back
    const u = R.since > 0 ? (R.since % RED_LOOP) / RED_LOOP : 0;
    const d = 0.1 + (RED_D_MAX - 0.1) * (easeInOut(seg(u, 0.06, 0.6)) - easeInOut(seg(u, 0.78, 0.96)));
    const ebv = ebvAt(d);
    const k = clamp(ebv / ebvAt(RED_D_MAX), 0, 1);
    const ag = 2.74 * ebv;
    const col = mix(STAR_BLUE, STAR_RED, k);
    const lum = Math.max(0.28, Math.pow(10, -0.2 * ag));
    const zoom = R.zoom;

    ctx.save();
    ctx.globalAlpha = a;
    // the star itself: a soft glow, larger once zoomed in, that fades and warms
    const r = (16 + 22 * zoom) * (0.55 + 0.45 * lum);
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    glow.addColorStop(0, rgba(col, 0.95 * lum + 0.05));
    glow.addColorStop(0.25, rgba(col, 0.45 * lum));
    glow.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 7);
    ctx.fill();
    ctx.fillStyle = rgba(mix([255, 255, 255], col, 0.6), 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, (1.6 + 1.4 * lum) * (1 + zoom), 0, 7);
    ctx.fill();

    // reticle: closes in and turns gold as it locks, then opens up a little with the zoom
    const lp = easeOutCubic(seg(R.lock, 0.1, 1));
    const locked = R.lock >= 1;
    const size = 64 + (22 - 64) * lp + 12 * zoom;
    const arm = Math.max(6, size * 0.36);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((1 - lp) * 45 * D);
    ctx.strokeStyle = locked ? rgba(GOLD, 1) : rgba(LAV, 0.85);
    ctx.lineWidth = 1.4;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(sx * size, sy * (size - arm));
      ctx.lineTo(sx * size, sy * size);
      ctx.lineTo(sx * (size - arm), sy * size);
      ctx.stroke();
    }
    ctx.restore();
    // lock flash: one ring expanding out of the reticle while the zoom runs
    if (locked && zoom < 1) {
      const e = easeOutCubic(zoom);
      ctx.strokeStyle = rgba(GOLD, 0.7 * (1 - e));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22 + 70 * e, 0, 7);
      ctx.stroke();
    }
    // tag above the reticle: what is locked, and the zoom
    ctx.shadowColor = 'rgba(3,4,11,0.9)';
    ctx.shadowBlur = 6;
    ctx.font = `500 ${narrow ? 9 : 10}px ${MONO}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = locked ? rgba(GOLD, 1) : rgba(INK, 0.85);
    const tag = locked ? (zoom > 0.02 ? `LOCKED · ZOOM ×${Math.max(1, R.mag).toFixed(1)}` : 'LOCKED') : 'ACQUIRING…';
    ctx.fillText(tag, p.x - size, p.y - size - 8);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawMollweide(a, M) {
    const { cx, cy } = M;
    const A = M.a;
    const B = M.b;
    const narrow = W < 600;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, A, B, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    [-60, -30, 0, 30, 60].forEach((lat) => {
      const th = mollTheta(lat);
      const y = cy - B * Math.sin(th);
      ctx.moveTo(cx - A * Math.cos(th), y);
      ctx.lineTo(cx + A * Math.cos(th), y);
    });
    [-120, -60, 0, 60, 120].forEach((lon) => {
      for (let k = 0; k <= 48; k++) {
        const th = -Math.PI / 2 + (k / 48) * Math.PI;
        const x = cx - A * ((lon * D) / Math.PI) * Math.cos(th);
        const y = cy - B * Math.sin(th);
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    });
    ctx.stroke();

    // the distance of the slice on show, in the empty top-right corner of the map's box
    if (M.kpc > 0 && M.grow > 0.85) {
      ctx.globalAlpha = a * Math.min(1, (M.grow - 0.85) / 0.15);
      ctx.font = `400 ${narrow ? 10 : 11}px ${MONO}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowColor = 'rgba(3,4,11,0.9)';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`d = ${M.kpc.toFixed(3)} kpc`, cx + A, cy - B - 6);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  /**
   * @param {object} st  { t, fx, P, map, red, frozen } — P holds projection helpers prepared by the engine;
   *                     red = 04 state { lock 0–1, zoom 0–1, since (s after the zoom), mag (zoom factor) };
   *                     frozen = reduced motion (t stands still)
   */
  function draw(st) {
    const { fx, t, P, map, red, frozen = false } = st;
    updateDemo(t, frozen);
    // 02: the map's graticule grows with the bloom out of the Sun
    const mapA = map && map.ready ? fx.sky * Math.min(1, map.grow * 3) : 0;
    const wipeA = fx.ir * Math.min(1, fx.wipe / 0.03, (1 - fx.wipe) / 0.03);
    const locA = fx.locate * Math.max(demo.query.a, demo.batch.a);
    const any = locA > 0.01 || fx.sun > 0.01 || fx.red > 0.01 || fx.grid > 0.01 || wipeA > 0.01 || mapA > 0.01;
    if (!any && !dirty) return;
    ctx.clearRect(0, 0, W, H);
    dirty = any;
    if (!any) return;
    if (fx.red > 0.01 && red) drawReddening(fx.red, red, P);
    if (fx.grid > 0.01) drawSkyGrid(fx.grid, t % GRID_LOOP, P);
    // phones: the lock-on runs behind the section text, so keep it quieter
    if (locA > 0.01) drawLocate(fx.locate * (W < 600 ? 0.55 : 1), t, P, frozen);
    drawSun(P.sun, fx.sun, t);
    if (mapA > 0.01) drawMollweide(mapA, map);
    if (wipeA > 0.01) drawWipe(wipeA, fx.wipe);
  }

  return { resize, draw };
}
