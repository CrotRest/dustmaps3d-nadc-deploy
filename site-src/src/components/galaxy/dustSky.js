// Section 02: the real 3-D dust map. The differential extinction ΔE(B−V)/Δd [mmag/pc]
// comes from a data atlas (40 distance shells over 0.3 → 1.8 kpc on a 1280 × 640 grid,
// smoothed with a σ = 0.1° Gaussian, computed from the dustmaps3d model by
// scripts/build-dustmap-model.py and loaded as one texture array). The map is drawn per
// pixel as a Mollweide ellipse whose equator sits on the edge-on Milky Way: every screen
// pixel inside it is inverse-Mollweide'd to (l, b) and the atlas is read there (bilinear
// between grid points, linear between the two nearest shells). It has a canvas of its own
// at the screen's full pixel density, so phones and desktops both get the fine structure
// however far the galaxy behind it has had to lower its resolution. It blooms out of the
// Sun with the HUD graticule and sweeps the distance out and back.
import { ClampToEdgeWrapping, DataArrayTexture, DataTexture, LinearFilter, Mesh, NearestFilter, NormalBlending, OrthographicCamera, PlaneGeometry, RGBAFormat, RedFormat, Scene, ShaderMaterial, Vector2, WebGLRenderer } from 'three';

const DATA_DIR = `${import.meta.env.BASE_URL}dustmap/`;
const ONE_WAY_S = 15; // 0.3 → 1.8 kpc
const HOLD_S = 1; // pause at either end before turning back
const STATIC_KPC = 1; // reduced motion: the slice nearest this distance
const MAX_DPR = 2;

// The colour bar of the team's figures (ΔE(B−V) 1e-4 … 2 mmag/pc, log), sampled at 33
// even steps from dust.mp4, so the map shows the same fine colour steps. The low end (the
// original's blue → teal → green, up to ~3e-3 mmag/pc) is replaced by a ramp from black
// into the original's yellow, so thin dust sinks into the dark page; the high end runs on
// to bright magenta-pink so the densest dust stays the most striking. From the yellow on
// it is the original.
const COLORMAP = [
  [0, 0, 0], [3, 3, 1], [9, 8, 3], [16, 16, 5], [26, 25, 8], [37, 36, 12],
  [49, 48, 16], [63, 62, 21], [78, 77, 26], [95, 93, 31], [112, 110, 37], [130, 128, 43],
  [150, 147, 49], [170, 167, 56], [192, 188, 63], [214, 210, 70], [246, 219, 39], [246, 197, 23],
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

// one quad over the ellipse's bounding box; the fragment shader cuts out the ellipse
const vertex = /* glsl */ `
uniform vec4 uRect;
void main() {
  gl_Position = vec4(uRect.xy + position.xy * uRect.zw * 1.02, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
uniform sampler2DArray uAtlas;
uniform sampler2D uColormap;
uniform vec4 uAtlasInfo;
uniform float uSlice;
uniform float uOpacity;
uniform vec4 uRect;
uniform float uLeftFade;
uniform vec2 uRes;

const float PI = 3.14159265;

// one grid value (-1 = no data); column wraps in l, row clamps at the poles
float texel(int x, int y, int k) {
  int nl = int(uAtlasInfo.x);
  int nb = int(uAtlasInfo.y);
  x = x < 0 ? x + nl : (x >= nl ? x - nl : x);
  y = clamp(y, 0, nb - 1);
  float r = texelFetch(uAtlas, ivec3(x, y, k), 0).r * 255.0;
  return r < 0.5 ? -1.0 : (r - 1.0) / 254.0;
}

// bilinear over the grid points that have data: x = value, y = weight with data
vec2 sampleSlice(int k, vec2 lb) {
  vec2 p = vec2(lb.x / 360.0 * uAtlasInfo.x, (90.0 - lb.y) / 180.0 * uAtlasInfo.y) - 0.5;
  vec2 i0 = floor(p);
  vec2 f = p - i0;
  int x0 = int(i0.x);
  int y0 = int(i0.y);
  float v[4];
  v[0] = texel(x0, y0, k);
  v[1] = texel(x0 + 1, y0, k);
  v[2] = texel(x0, y0 + 1, k);
  v[3] = texel(x0 + 1, y0 + 1, k);
  float w[4];
  w[0] = (1.0 - f.x) * (1.0 - f.y);
  w[1] = f.x * (1.0 - f.y);
  w[2] = (1.0 - f.x) * f.y;
  w[3] = f.x * f.y;
  float sum = 0.0;
  float wsum = 0.0;
  for (int i = 0; i < 4; i++) {
    if (v[i] >= 0.0) { sum += v[i] * w[i]; wsum += w[i]; }
  }
  return wsum > 0.0 ? vec2(sum / wsum, wsum) : vec2(0.0);
}

void main() {
  vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  vec2 m = (ndc - uRect.xy) / uRect.zw;
  float r = length(m);
  float aa = fwidth(r) * 1.5;
  float inside = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (inside <= 0.0) discard;

  // inverse Mollweide (l grows to the left, like the particles)
  float th = asin(clamp(m.y, -1.0, 1.0));
  float b = asin(clamp((2.0 * th + sin(2.0 * th)) / PI, -1.0, 1.0));
  float lam = -PI * m.x / max(cos(th), 1e-4);
  if (abs(lam) > PI) discard;
  float l = lam < 0.0 ? lam + 2.0 * PI : lam;
  vec2 lb = vec2(degrees(l), degrees(b));

  float n = uAtlasInfo.w;
  float s = clamp(uSlice, 0.0, n - 1.0);
  int k0 = int(floor(s));
  int k1 = min(k0 + 1, int(n) - 1);
  float f = s - float(k0);
  vec2 a0 = sampleSlice(k0, lb);
  vec2 a1 = sampleSlice(k1, lb);
  float w0 = a0.y * (1.0 - f);
  float w1 = a1.y * f;
  float valid = w0 + w1;
  if (valid <= 0.0) discard;
  float t = (a0.x * w0 + a1.x * w1) / valid;

  vec3 col = texture2D(uColormap, vec2(0.5 / 256.0 + t * 255.0 / 256.0, 0.5)).rgb;
  float a = mix(0.82, 0.97, smoothstep(0.1, 0.9, t)) * clamp(valid * 2.0, 0.0, 1.0) * inside;
  float px = gl_FragCoord.x / uRes.x;
  a *= mix(1.0, 0.25 + 0.75 * smoothstep(0.42, 0.6, px), uLeftFade);
  a *= uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}
`;

async function loadAtlas() {
  const meta = await fetch(`${DATA_DIR}atlas.json`).then((r) => {
    if (!r.ok) throw new Error(`atlas.json ${r.status}`);
    return r.json();
  });
  const sliceSize = meta.nl * meta.nb;
  const data = new Uint8Array(sliceSize * meta.count);
  // each PNG holds meta.perFile slices stacked top to bottom: in memory they are already
  // the consecutive layers of the texture array
  await Promise.all(
    meta.files.map(async (name, i) => {
      const r = await fetch(`${DATA_DIR}${name}`);
      if (!r.ok) throw new Error(`${name} ${r.status}`);
      const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0);
      bmp.close?.();
      const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const off = i * meta.perFile * sliceSize;
      const n = Math.min(rgba.length / 4, data.length - off);
      for (let p = 0; p < n; p++) data[off + p] = rgba[p * 4];
      canvas.width = canvas.height = 0; // let Safari free the canvas memory now
    }),
  );
  const tex = new DataArrayTexture(data, meta.nl, meta.nb, meta.count);
  tex.format = RedFormat;
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { meta, tex };
}

/** The map layer on its own canvas + its distance clock. */
export function createDustSky(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geom = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    uniforms: {
      uAtlas: { value: null },
      uColormap: { value: colormapTexture() },
      uAtlasInfo: { value: [1, 1, 1, 1] },
      uSlice: { value: 0 },
      uOpacity: { value: 0 },
      uRect: { value: [0.3, 0, 0.6, 0.5] },
      uLeftFade: { value: 1 },
      uRes: { value: [1, 1] },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: NormalBlending,
  });
  const mesh = new Mesh(geom, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  let meta = null;
  let loading = null;
  let shown = false;
  // dev only: ?dclock=<seconds> starts the distance sweep elsewhere (screenshots)
  let clock = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get('dclock')) || 0 : 0;
  let slice = 0;
  const forced = clock > 0;
  let started = forced;
  const u = material.uniforms;

  const smooth = (x) => x * x * (3 - 2 * x);

  return {
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
          .then(({ meta: m, tex }) => {
            meta = m;
            u.uAtlas.value = tex;
            u.uAtlasInfo.value = [m.nl, m.nb, 0, m.count];
          })
          .catch(() => {
            loading = null;
          });
      }
      return loading;
    },
    resize(W, H) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
      renderer.setSize(W, H, false);
      const s = renderer.getDrawingBufferSize(new Vector2());
      u.uRes.value = [s.x, s.y];
    },
    /** Advance the ping-pong sweep (out, pause, back, pause); reduced motion holds one slice. */
    tick(dt, still, bloom = 1) {
      if (!meta) return;
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
      u.uSlice.value = slice;
    },
    /** Draw the map into `rect` (ndc centre + semi-axes); opacity 0 clears the canvas once. */
    render({ rect, opacity, leftFade }) {
      const on = Boolean(meta) && opacity > 0.001 && rect[2] > 1e-4;
      if (!on) {
        if (shown) renderer.clear();
        shown = false;
        return;
      }
      u.uRect.value = rect;
      u.uOpacity.value = opacity;
      u.uLeftFade.value = leftFade;
      renderer.render(scene, camera);
      shown = true;
    },
    dispose() {
      geom.dispose();
      material.dispose();
      u.uAtlas.value?.dispose();
      u.uColormap.value.dispose();
      renderer.dispose();
    },
  };
}
