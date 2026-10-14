// Section 02: the real 3-D dust map as particles. Every particle owns one
// direction (l, b) on the sky. Its brightness is the differential extinction
// ΔE(B−V)/Δd [mmag/pc] at the current distance, read in the vertex shader from a
// data atlas (40 distance shells over 0.3 → 1.8 kpc on a 640 × 320 grid, computed
// from the dustmaps3d model by scripts/build-dustmap-model.py; the earlier atlas was
// decoded from the team's movie by scripts/extract-dustmap.py). The particles are laid out
// as a Mollweide map whose equator sits on the edge-on Milky Way; a scan line
// reveals them (and section 03's infrared line later wipes them away). While
// the distance grows they stream outward in layers (pushing forward through
// the dust); while it shrinks they stream back in.
import { BufferAttribute, BufferGeometry, ClampToEdgeWrapping, DataTexture, LinearFilter, NearestFilter, NormalBlending, Points, RGBAFormat, RedFormat, ShaderMaterial } from 'three';

const DATA_DIR = `${import.meta.env.BASE_URL}dustmap/`;
const ONE_WAY_S = 15; // 0.3 → 1.8 kpc
const HOLD_S = 1; // pause at either end before turning back
const STATIC_KPC = 1; // reduced motion: the slice nearest this distance

// The colour bar of the team's figures (ΔE(B−V) 1e-4 … 2 mmag/pc, log), sampled at 33
// even steps from dust.mp4, so the map shows the same fine colour steps. Both ends of the
// original run into near-black, which would vanish on the dark page: the low end is lifted
// to a visible deep blue, and the high end runs on to bright magenta-pink so the densest
// dust stays the most striking. Everything in between is the original.
const COLORMAP = [
  [70, 62, 170], [72, 74, 178], [66, 86, 180], [56, 98, 176], [44, 108, 170], [36, 116, 162],
  [36, 122, 152], [44, 128, 142], [59, 134, 134], [75, 137, 123], [93, 150, 124], [112, 162, 118],
  [133, 176, 111], [157, 188, 100], [183, 200, 90], [214, 210, 70], [246, 219, 39], [246, 197, 23],
  [246, 175, 12], [240, 151, 10], [235, 130, 18], [226, 110, 28], [216, 91, 35], [203, 74, 47],
  [190, 54, 56], [175, 37, 63], [166, 22, 80], [170, 12, 100], [186, 20, 124], [206, 38, 150],
  [226, 68, 176], [242, 110, 204], [252, 160, 228],
];

function colormapTexture() {
  const N = 256;
  const px = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * (COLORMAP.length - 1);
    const k = Math.min(COLORMAP.length - 2, Math.floor(x));
    const f = x - k;
    for (let c = 0; c < 3; c++) px[i * 4 + c] = Math.round(COLORMAP[k][c] + (COLORMAP[k + 1][c] - COLORMAP[k][c]) * f);
    px[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(px, N, 1, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const vertex = /* glsl */ `
uniform sampler2D uAtlas;
uniform sampler2D uColormap;
uniform vec2 uSun;         // the Sun on screen (ndc): the map's origin, where it blooms from
uniform float uBloom;      // 0 = folded into the Sun, 1 = laid out on uRect
uniform vec4 uAtlasInfo;   // nl, nb, cols, slice count
uniform vec2 uAtlasSize;   // atlas width, height in texels
uniform float uSlice;      // fractional slice index
uniform float uSpread;     // slices between the farthest and nearest layer
uniform float uFlow;       // accumulated layer phase (grows while pushing outward)
uniform float uSpeed;      // 0..1, how fast the distance is changing
uniform float uOpacity;
uniform vec4 uRect;        // Mollweide centre (ndc) and semi-axes (ndc)
uniform float uDpr;
uniform float uLeftFade;
uniform vec2 uPxPerNdc;    // half the viewport, in px

attribute vec2 aLB;        // degrees
attribute vec4 aRnd;       // layer phase, size, bloom lag, sparkle

varying vec3 vColor;
varying float vAlpha;
varying vec2 vDir;
varying float vStretch;

const float PI = 3.14159265;

float sampleSlice(float k, vec2 lb) {
  float col = mod(k, uAtlasInfo.z);
  float row = floor(k / uAtlasInfo.z);
  float u = clamp(lb.x / 360.0, 0.5 / uAtlasInfo.x, 1.0 - 0.5 / uAtlasInfo.x);
  float v = clamp((90.0 - lb.y) / 180.0, 0.5 / uAtlasInfo.y, 1.0 - 0.5 / uAtlasInfo.y);
  vec2 uv = vec2((col + u) * uAtlasInfo.x, (row + v) * uAtlasInfo.y) / uAtlasSize;
  float r = texture2D(uAtlas, uv).r * 255.0;
  return r < 0.5 ? -1.0 : (r - 1.0) / 254.0;
}

// log ΔE(B−V) 1e-4 … 2 → the figures' colour bar
vec3 palette(float t) {
  return texture2D(uColormap, vec2(0.5 / 256.0 + t * 255.0 / 256.0, 0.5)).rgb;
}

void main() {
  float n = uAtlasInfo.w;
  // layer phase: 0 = just ahead (smaller, farther), 1 = passed (larger, nearer)
  float u = fract(aRnd.x + uFlow);
  float s = clamp(uSlice + (0.5 - u) * uSpread, 0.0, n - 1.0);
  float k0 = floor(s);
  float k1 = min(k0 + 1.0, n - 1.0);
  float f = s - k0;
  float a0 = sampleSlice(k0, aLB);
  float a1 = sampleSlice(k1, aLB);
  float t;
  float valid = 1.0;
  if (a0 < 0.0 && a1 < 0.0) { t = 0.0; valid = 0.0; }
  else if (a0 < 0.0) { t = a1; valid = f; }
  else if (a1 < 0.0) { t = a0; valid = 1.0 - f; }
  else t = mix(a0, a1, f);

  // Mollweide position (l grows to the left, like the figure)
  float l = radians(aLB.x);
  float b = radians(aLB.y);
  float lam = l > PI ? l - 2.0 * PI : l;
  float th = b;
  for (int i = 0; i < 6; i++) {
    th -= (2.0 * th + sin(2.0 * th) - PI * sin(b)) / (2.0 + 2.0 * cos(2.0 * th) + 1e-5);
  }
  vec2 m = vec2(-(lam / PI) * cos(th), sin(th));
  float layerScale = mix(0.93, 1.09, u);
  vec2 ndc = uRect.xy + m * layerScale * uRect.zw;
  // bloom: every particle flies out of the Sun to its place, a little staggered
  float g = clamp(uBloom * 1.3 - aRnd.z * 0.3, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  ndc = mix(uSun, ndc, g);
  gl_Position = vec4(ndc, 0.0, 1.0);

  // look: denser dust is brighter, warmer and a touch larger
  float layerW = 0.2 + 0.8 * exp(-pow((u - 0.5) / 0.28, 2.0));
  float edge = 1.0 - smoothstep(0.92, 1.0, length(m * layerScale)); // layers that grow past the rim fade
  // hue carries the density now, so faint dust is not hidden: a flatter opacity ramp
  float a = mix(0.6, 0.95, smoothstep(0.1, 0.9, t)) * valid * layerW * edge * smoothstep(0.0, 0.2, g);
  float px = (ndc.x * 0.5 + 0.5);
  a *= mix(1.0, 0.25 + 0.75 * smoothstep(0.42, 0.6, px), uLeftFade);
  a *= 0.75 + 0.5 * aRnd.w;
  // twice the particles of the first version: each one a bit smaller and fainter, so the
  // map keeps its overall brightness and gets finer grain (0.8² × 0.78 ≈ ½)
  vAlpha = a * uOpacity * 0.78;
  vColor = palette(t);

  float base = (1.7 + aRnd.y * 1.4 + 1.2 * smoothstep(0.55, 1.0, t)) * 0.8 * uDpr;
  vStretch = 1.0 + 0.35 * uSpeed;
  gl_PointSize = base * vStretch;
  vec2 radial = m * uRect.zw * uPxPerNdc;
  vDir = length(radial) > 1e-3 ? normalize(radial) : vec2(1.0, 0.0);
  if (vAlpha < 0.003) gl_PointSize = 0.0;
}
`;

const fragment = /* glsl */ `
uniform vec2 uMapX;        // revealed band of the screen: between the 02 and 03 scan lines
uniform vec2 uRes;
varying vec3 vColor;
varying float vAlpha;
varying vec2 vDir;
varying float vStretch;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.y = -c.y;
  // a short streak along the radial direction while the distance is moving
  float along = dot(c, vDir);
  float across = dot(c, vec2(-vDir.y, vDir.x)) * vStretch;
  float d2 = along * along + across * across;
  if (d2 > 1.0) discard;
  float g = exp(-d2 * 3.5) * (1.0 - d2);
  float x = gl_FragCoord.x / uRes.x;
  float shown = smoothstep(uMapX.x - 0.002, uMapX.x + 0.002, x) * (1.0 - smoothstep(uMapX.y - 0.002, uMapX.y + 0.002, x));
  if (shown <= 0.0) discard;
  gl_FragColor = vec4(vColor, vAlpha * g * shown);
}
`;

async function loadAtlas() {
  const [meta, blob] = await Promise.all([
    fetch(`${DATA_DIR}atlas.json`).then((r) => {
      if (!r.ok) throw new Error(`atlas.json ${r.status}`);
      return r.json();
    }),
    fetch(`${DATA_DIR}atlas.png`).then((r) => {
      if (!r.ok) throw new Error(`atlas.png ${r.status}`);
      return r.blob();
    }),
  ]);
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const red = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < red.length; i++) red[i] = rgba[i * 4];
  const tex = new DataTexture(red, canvas.width, canvas.height, RedFormat);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { meta, tex, width: canvas.width, height: canvas.height };
}

/** Particle layer + its distance clock. `q` scales the particle count. */
export function createDustSky(q = 1, shared = {}) {
  const n = Math.max(40000, Math.round(260000 * q));
  const lb = new Float32Array(n * 2);
  const rnd = new Float32Array(n * 4);
  const pos = new Float32Array(n * 3);
  let seed = 12345;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    // uniform on the sphere = uniform on the (equal-area) Mollweide ellipse
    lb[i * 2] = rand() * 360;
    lb[i * 2 + 1] = (Math.asin(2 * rand() - 1) * 180) / Math.PI;
    rnd[i * 4] = rand();
    rnd[i * 4 + 1] = rand();
    rnd[i * 4 + 2] = rand();
    rnd[i * 4 + 3] = rand();
  }
  const geom = new BufferGeometry();
  geom.setAttribute('position', new BufferAttribute(pos, 3));
  geom.setAttribute('aLB', new BufferAttribute(lb, 2));
  geom.setAttribute('aRnd', new BufferAttribute(rnd, 4));

  const material = new ShaderMaterial({
    uniforms: {
      uAtlas: { value: null },
      uColormap: { value: colormapTexture() },
      uSun: { value: [0, 0] },
      uBloom: { value: 1 },
      uAtlasInfo: { value: [1, 1, 1, 1] },
      uAtlasSize: { value: [1, 1] },
      uSlice: { value: 0 },
      uSpread: { value: 1 }, // narrow: layers far apart in distance would mix hues into speckle
      uFlow: { value: 0 },
      uSpeed: { value: 0 },
      uOpacity: { value: 0 },
      uRect: { value: [0.3, 0, 0.6, 0.5] },
      uDpr: { value: 1 },
      uMapX: shared.uMapX || { value: [1, 1] },
      uRes: shared.uRes || { value: [1, 1] },
      uLeftFade: { value: 1 },
      uPxPerNdc: { value: [720, 450] },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: NormalBlending, // keeps the colour-bar hues true where particles overlap
  });
  const points = new Points(geom, material);
  points.frustumCulled = false;
  points.renderOrder = 20;
  points.visible = false;

  let meta = null;
  let loading = null;
  // dev only: ?dclock=<seconds> starts the distance sweep elsewhere (screenshots)
  let clock = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get('dclock')) || 0 : 0;
  let slice = 0;
  let flow = 0;
  const forced = clock > 0;
  let started = forced;
  let speed = 0;
  const u = material.uniforms;

  const smooth = (x) => x * x * (3 - 2 * x);

  return {
    points,
    get ready() {
      return Boolean(meta);
    },
    get slice() {
      return slice;
    },
    /** Distance [kpc] of the current fractional slice (log-interpolated). */
    get kpc() {
      if (!meta) return 0.1;
      const k0 = Math.floor(slice);
      const k1 = Math.min(k0 + 1, meta.count - 1);
      return meta.kpc[k0] * Math.pow(meta.kpc[k1] / meta.kpc[k0], slice - k0);
    },
    /** 0 … 1 along the log-distance sweep. */
    get progress() {
      return meta ? slice / (meta.count - 1) : 0;
    },
    load() {
      if (!loading) {
        loading = loadAtlas()
          .then(({ meta: m, tex, width, height }) => {
            meta = m;
            u.uAtlas.value = tex;
            u.uAtlasInfo.value = [m.nl, m.nb, m.cols, m.count];
            u.uAtlasSize.value = [width, height];
          })
          .catch(() => {
            loading = null;
          });
      }
      return loading;
    },
    /** Advance the ping-pong sweep (out, pause, back, pause); reduced motion holds one slice. */
    tick(dt, still, bloom = 1) {
      if (!meta) return;
      const last = slice;
      // until the map has fully bloomed out of the Sun, hold at the nearest shell; once it
      // has gone (folded away), start over from there next time
      if (bloom < 0.001 && !forced) started = false;
      if (bloom > 0.999) started = true;
      if (still) {
        slice = meta.kpc.reduce((best, d, i) => (Math.abs(d - STATIC_KPC) < Math.abs(meta.kpc[best] - STATIC_KPC) ? i : best), 0);
      } else if (!started) {
        clock = 0;
        slice = 0;
      } else {
        clock += dt;
        const half = ONE_WAY_S + HOLD_S;
        const tt = clock % (2 * half);
        const q = smooth(Math.min(1, (tt < half ? tt : tt - half) / ONE_WAY_S));
        slice = (tt < half ? q : 1 - q) * (meta.count - 1);
      }
      const rate = dt > 0 ? (slice - last) / dt : 0; // slices per second, signed
      flow += still ? 0 : rate * 0.11 * dt;
      speed += (Math.min(1, Math.abs(rate) / 3) - speed) * Math.min(1, dt * 4);
      u.uSlice.value = slice;
      u.uFlow.value = flow - Math.floor(flow);
      u.uSpeed.value = still ? 0 : speed;
    },
    dispose() {
      geom.dispose();
      material.dispose();
      u.uAtlas.value?.dispose();
      u.uColormap.value.dispose();
    },
  };
}
