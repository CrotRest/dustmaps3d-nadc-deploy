// Three.js scene behind the whole page. One fixed canvas, one camera; the
// camera is driven by the scroll position (see shots.js) while the galaxy keeps
// turning. A 2-D canvas on top carries the HUD graphics (hud.js).
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { ARM_K, ARM_R_REF, BAR_ANGLE, PATTERN_SPEED, SUN_OMEGA, buildGalaxy, dustShearTime, galDir } from './model.js';
import { RED_LOCK_S, RED_ZOOM_S, cameraAt, effectsAt, measureAnchors, mollRect, shotAt } from './shots.js';
import { coreFragment, coreVertex, diskFragment, diskVertex, irHazeFragment, pointFragment, pointVertex } from './shaders.js';
import { createDustSky } from './dustSky.js';
import { demoBus } from './demoBus.js';
import { createHud } from './hud.js';

const DEG = Math.PI / 180;
// dev only: ?nodust hides the section-02 map (storyboard screenshots)
const DEV_NODUST = import.meta.env.DEV && new URLSearchParams(window.location.search).has('nodust');
const STATIC_T = 2.85; // reduced motion: a frame where the lock-on read-out is showing

// Per-layer look. irColor/irGain/irFloor describe the layer behind the infrared wipe.
const LAYERS = [
  { key: 'sky', mode: 2, minPx: 0.6, maxPx: 8, alpha: 1, armMix: 0, sharp: 0.7, ir: [[0.9, 0.55, 0.4], [1, 0.75, 0.55]], irGain: 0.35, irFloor: 1, nearFade: 0, twinkle: 1 },
  { key: 'band', mode: 2, minPx: 0.6, maxPx: 16, alpha: 1, armMix: 0, sharp: 0.45, ir: [[0.9, 0.55, 0.4], [1, 0.75, 0.55]], irGain: 0.3, irFloor: 1, nearFade: 0, twinkle: 0.5 },
  { key: 'glow', mode: 0, minPx: 2, maxPx: 160, alpha: 0.75, armMix: 0.7, armSharp: 1.6, sharp: 0, ir: [[1, 0.32, 0.08], [0.85, 0.22, 0.06]], irGain: 0.22, irFloor: 0.35, nearFade: 2.4 },
  { key: 'disk', mode: 0, minPx: 1, maxPx: 3.2, alpha: 0.42, armMix: 0.3, armSharp: 1.4, sharp: 0.55, ir: [[1, 0.52, 0.28], [1, 0.68, 0.42]], irGain: 0.2, irFloor: 1, nearFade: 0.4 },
  { key: 'bulge', mode: 1, minPx: 1, maxPx: 3.5, alpha: 0.42, armMix: 0, sharp: 0.5, ir: [[1, 0.5, 0.2], [1, 0.62, 0.3]], irGain: 0.42, irFloor: 1, nearFade: 0.4 },
  { key: 'young', mode: 0, minPx: 1.1, maxPx: 4.5, alpha: 1, armMix: 1, armSharp: 3.4, sharp: 0.6, ir: [[0.85, 0.5, 0.35], [1, 0.7, 0.5]], irGain: 0.1, irFloor: 0.2, nearFade: 0.4 },
  { key: 'dust', geom: 'dust', pass: 1, mode: 0, minPx: 2, maxPx: 40, alpha: 1, armMix: 1, armSharp: 2.4, armShift: -0.22, sharp: 0.1, ir: [[1, 0.4, 0.1], [1, 0.75, 0.32]], irGain: 0, irFloor: 0.3, nearFade: 0.6, blending: 'normal' },
  // mode 3: capped shear, so a long-open page doesn't wind the infrared web into rings
  { key: 'dustIR', geom: 'dust', pass: 2, mode: 3, minPx: 1.5, maxPx: 30, alpha: 0.6, armMix: 1, armSharp: 2.2, armShift: -0.22, sharp: 0.25, ir: [[1, 0.36, 0.07], [1, 0.8, 0.4]], irGain: 1.5, irFloor: 0.55, nearFade: 0.5 },
  // infrared-only structure (see buildInfrared), so the optical view stays as it was:
  // the bar-region web, the far outer disk and the bubble crusts move like the disk dust;
  // the arm ridges turn with the spiral pattern
  { key: 'irWebIR', geom: 'irWeb', pass: 2, mode: 3, minPx: 1.5, maxPx: 30, alpha: 0.6, armMix: 1, armSharp: 2.2, armShift: -0.22, sharp: 0.25, ir: [[1, 0.36, 0.07], [1, 0.8, 0.4]], irGain: 1.5, irFloor: 0.55, nearFade: 0.5 },
  { key: 'irArmsIR', geom: 'irArms', pass: 2, mode: 1, minPx: 1.5, maxPx: 30, alpha: 0.6, armMix: 0, sharp: 0.2, ir: [[1, 0.36, 0.07], [1, 0.8, 0.4]], irGain: 1.5, irFloor: 1, nearFade: 0.5 },
  { key: 'hii', mode: 0, minPx: 1.2, maxPx: 8, alpha: 0.8, armMix: 1, armSharp: 4.6, sharp: 0.45, ir: [[1, 0.85, 0.55], [1, 0.96, 0.82]], irGain: 0.85, irFloor: 0.15, nearFade: 0.4 },
];

function detectTier() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && Math.min(w, h) < 700) return { q: 0.25, dpr: 1 };
  if (coarse || Math.min(w, h) < 700) return { q: 0.5, dpr: Math.min(window.devicePixelRatio || 1, 1.25) };
  return { q: 1, dpr: Math.min(window.devicePixelRatio || 1, 1.6) };
}

export function createGalaxyEngine({ canvas, mapCanvas, hudCanvas, reduced: reducedInit = false }) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x03040b, 1);
  renderer.autoClear = false;

  const tier = detectTier();
  let dpr = tier.dpr;
  let frac = 1;
  const galaxy = buildGalaxy(tier.q);
  const comp = Math.min(2.4, Math.pow(1 / tier.q, 0.55));

  const shared = {
    uTime: { value: 0 },
    uShearT: { value: 0 },
    uRefOmega: { value: SUN_OMEGA },
    uPattern: { value: PATTERN_SPEED },
    uArmK: { value: ARM_K },
    uArmRef: { value: ARM_R_REF },
    uBarAngle: { value: BAR_ANGLE },
    uWipe: { value: 1 },
    uIRAmt: { value: 0 },
    uRes: { value: [1, 1] },
    uPxPerUnit: { value: 500 },
    uDpr: { value: dpr },
    uBright: { value: 1 },
    uMapX: { value: [1, 1] },
    uMapEll: { value: [0, 0, 1, 1] },
    uMapAmt: { value: 0 },
  };

  const scene = new Scene();
  const geoms = {};
  const geomFor = (key) => {
    if (geoms[key]) return geoms[key];
    const L = galaxy[key];
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(L.position, 3));
    g.setAttribute('aOmega', new BufferAttribute(L.omega, 1));
    g.setAttribute('aColor', new BufferAttribute(L.color, 4));
    g.setAttribute('aSize', new BufferAttribute(L.size, 1));
    g.setAttribute('aSeed', new BufferAttribute(L.seed, 1));
    g.userData.n = L.i;
    geoms[key] = g;
    return g;
  };

  // smooth disk light + bulge glow sit under the particles
  const diskMat = new ShaderMaterial({
    uniforms: { ...shared },
    vertexShader: diskVertex,
    fragmentShader: diskFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const diskPlane = new Mesh(new PlaneGeometry(36, 36), diskMat);
  diskPlane.rotation.x = -Math.PI / 2;
  diskPlane.renderOrder = 1;
  diskPlane.frustumCulled = false;
  scene.add(diskPlane);

  const hazeMat = new ShaderMaterial({
    uniforms: { ...shared },
    vertexShader: diskVertex,
    fragmentShader: irHazeFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const irHaze = new Mesh(new PlaneGeometry(120, 120), hazeMat);
  irHaze.rotation.x = -Math.PI / 2;
  irHaze.renderOrder = 1;
  irHaze.frustumCulled = false;
  scene.add(irHaze);

  const coreMat = new ShaderMaterial({
    uniforms: { ...shared },
    vertexShader: coreVertex,
    fragmentShader: coreFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const core = new Mesh(new PlaneGeometry(7.5, 7.5), coreMat);
  core.renderOrder = 2;
  core.frustumCulled = false;
  scene.add(core);

  const points = LAYERS.map((cfg, i) => {
    const mat = new ShaderMaterial({
      uniforms: {
        ...shared,
        uMode: { value: cfg.mode },
        uPass: { value: cfg.pass || 0 },
        uSizeMul: { value: Math.pow(1 / tier.q, 0.2) },
        uMinPx: { value: cfg.minPx },
        uMaxPx: { value: cfg.maxPx },
        uAlphaMul: { value: cfg.alpha * (cfg.mode === 2 ? 1 : comp) },
        uArmMix: { value: cfg.armMix },
        uArmShift: { value: cfg.armShift || 0 },
        uArmSharp: { value: cfg.armSharp || 2 },
        uSharp: { value: cfg.sharp },
        uIRColor: { value: cfg.ir[0] },
        uIRColor2: { value: cfg.ir[1] },
        uIRGain: { value: cfg.irGain },
        uIRFloor: { value: cfg.irFloor },
        uNearFade: { value: cfg.nearFade },
        uTwinkle: { value: cfg.twinkle || 0 },
      },
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: cfg.blending === 'normal' ? NormalBlending : AdditiveBlending,
    });
    const obj = new Points(geomFor(cfg.geom || cfg.key), mat);
    obj.frustumCulled = false;
    obj.renderOrder = cfg.key === 'sky' ? 0 : 3 + i;
    scene.add(obj);
    return obj;
  });

  const bandLayer = points[LAYERS.findIndex((c) => c.key === 'band')];
  const irOnly = [irHaze, ...points.filter((p, i) => LAYERS[i].key === 'irWebIR' || LAYERS[i].key === 'irArmsIR')];

  // section 02: the real dust map on its own full-resolution canvas (loaded on approach)
  const dust = createDustSky(mapCanvas);

  const camera = new PerspectiveCamera(40, 1, 0.01, 3000);
  const hud = createHud(hudCanvas);

  // ---------- sizing ----------
  let W = 1;
  let H = 1;
  let mob = 0;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    hud.resize(W, H, Math.min(window.devicePixelRatio || 1, 2));
    dust.resize(W, H);
    const db = renderer.getDrawingBufferSize(new Vector2());
    shared.uRes.value = [db.x, db.y];
    shared.uDpr.value = dpr;
    camera.aspect = W / H;
    mob = Math.min(1, Math.max(0, (1.15 - W / H) / 0.55));
  }

  // ---------- scroll ----------
  let stops = [0, 1, 2, 3, 4, 5, 6];
  let scrollY = window.scrollY;
  const measure = () => {
    stops = measureAnchors();
  };
  const onScroll = () => {
    scrollY = window.scrollY;
  };
  const onResize = () => {
    resize();
    measure();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(measure);
  ro.observe(document.body);
  document.fonts?.ready.then(measure);

  function aimCamera(cam, rig) {
    cam.position.set(rig.pos[0], rig.pos[1], rig.pos[2]);
    cam.up.set(0, 1, 0);
    target.set(rig.target[0], rig.target[1], rig.target[2]);
    cam.lookAt(target);
    cam.rotateZ(rig.roll * DEG);
    cam.fov = rig.fov;
    cam.aspect = camera.aspect;
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] = -rig.shift[0];
    cam.projectionMatrix.elements[9] = -rig.shift[1];
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld();
  }
  // 02's map grows out of / folds into the Sun as seen before the fly-in along the disk:
  // the live Sun slides down and off screen as the camera pushes in, which would drag a
  // part-folded map down with it
  const originCam = new PerspectiveCamera(40, 1, 0.01, 3000);

  // ---------- projection helpers for the HUD ----------
  const tmp = new Vector3();
  const project = (x, y, z, cam = camera) => {
    tmp.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
    const inFront = tmp.z < -0.02;
    tmp.applyMatrix4(cam.projectionMatrix);
    return {
      x: ((tmp.x + 1) / 2) * W,
      y: ((1 - tmp.y) / 2) * H,
      visible: inFront && Math.abs(tmp.x) < 3 && Math.abs(tmp.y) < 3,
    };
  };
  function helpers(f) {
    const [sx, sy, sz] = f.sun;
    const X = [-f.rhat[0], 0, -f.rhat[2]];
    const Y = f.that;
    const cam = camera.position;
    const sunP = project(sx, sy, sz);
    return {
      sun: sunP,
      galPoint(l, b, d) {
        const v = galDir(l, b, f);
        return project(sx + v[0] * d, sy + v[1] * d, sz + v[2] * d);
      },
      /** A direction on the sky, given as a Galactic unit vector, seen from the camera. */
      skyPoint(v) {
        const dx = X[0] * v[0] + Y[0] * v[1];
        const dy = v[2];
        const dz = X[2] * v[0] + Y[2] * v[1];
        return project(cam.x + dx * 60, cam.y + dy * 60, cam.z + dz * 60);
      },
      pxPerDeg() {
        return (H / 2 / Math.tan((camera.fov * DEG) / 2)) * DEG;
      },
    };
  }

  // ---------- adaptive quality ----------
  // Below 30 fps, step down: resolution, particle count, resolution, particle
  // count, and finally stop the spin and redraw the galaxy only when the scroll
  // moves (the 2-D overlay keeps going, see the loop).
  const perf = { wall: 0, frames: 0, acc: 0, level: 0, cooldown: 0 };
  let lowPower = false;
  function applyFrac(f) {
    frac = f;
    Object.values(geoms).forEach((g) => g.setDrawRange(0, Math.floor(g.userData.n * frac)));
    points.forEach((p, i) => {
      const cfg = LAYERS[i];
      if (cfg.mode !== 2) p.material.uniforms.uAlphaMul.value = cfg.alpha * comp * Math.min(2, Math.pow(1 / frac, 0.6));
    });
  }
  function watchPerf(realDt) {
    // a long gap is mostly the page coming back from being hidden (other tab, window
    // or pane) or a one-off hitch, not a slow GPU, so it counts as one slow frame only;
    // a device that is slow frame after frame still steps down
    const d = Math.min(realDt, 0.25);
    perf.wall += d;
    if (perf.wall < 2 || perf.level >= 5) return;
    if (perf.cooldown > 0) {
      perf.cooldown -= d;
      return;
    }
    perf.frames++;
    perf.acc += d;
    if (perf.acc < 1.5) return;
    const fps = perf.frames / perf.acc;
    perf.frames = 0;
    perf.acc = 0;
    if (fps >= 30) return;
    perf.level++;
    perf.cooldown = 0.8;
    if (perf.level === 1 || perf.level === 3) {
      dpr = Math.max(perf.level === 1 ? 1 : 0.75, dpr * 0.75);
      resize();
    } else if (perf.level === 5) {
      lowPower = true;
    } else applyFrac(perf.level === 2 ? 0.6 : 0.35);
  }

  // ---------- loop ----------
  let reduced = reducedInit;
  let paused = false;
  let raf = 0;
  let last = performance.now();
  // dev only: ?t0=<seconds> starts the clock elsewhere (used for screenshots)
  let time = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get('t0')) || 0 : 0;
  // clock for the 2-D overlay: unlike `time` it keeps running in low-power mode
  let hudTime = time;
  let sCur = shotAt(scrollY, stops);
  const target = new Vector3();

  let drawnS = NaN;
  let drawnW = 0;
  let drawnAt = 0;
  let drawnZoom = 0;
  // 04: seconds spent at the section (drives the lock-on) and the zoom it leads to
  const red = { t: 0, zoom: 0 };
  // still mode only redraws on scroll, so a hover on an 01 row has to ask for a frame
  const offDemo = demoBus.subscribe(() => {
    drawnS = NaN;
  });

  // an error in one frame must not stop the loop (the galaxy would freeze for good)
  function frame(now) {
    raf = 0;
    try {
      step(now);
    } finally {
      if (!paused && !raf) raf = requestAnimationFrame(frame);
    }
  }

  function step(now) {
    const realDt = (now - last) / 1000;
    const dt = Math.min(0.1, realDt);
    last = now;
    const still = reduced || lowPower;
    if (!still) time += dt;
    if (!reduced) hudTime += dt;
    const t = reduced ? STATIC_T : time;

    const sTarget = shotAt(scrollY, stops);
    sCur = still ? sTarget : sCur + (sTarget - sCur) * (1 - Math.exp(-dt * 5));
    if (reduced) sCur = Math.round(sTarget);
    if (Math.abs(sTarget - sCur) < 1e-4) sCur = sTarget;
    const atRed = Math.abs(sCur - 4) < 0.2;
    red.t = atRed ? red.t + dt : 0;
    if (reduced) red.zoom = atRed ? 1 : 0;
    else if (atRed) {
      const z = Math.min(1, Math.max(0, (red.t - RED_LOCK_S) / RED_ZOOM_S));
      red.zoom = Math.max(red.zoom, z * z * (3 - 2 * z));
    } else red.zoom = red.zoom < 1e-3 ? 0 : red.zoom * Math.exp(-dt * 7);
    // still mode: redraw the galaxy when the scroll position or size changes, plus a
    // slow refresh so sprite sheets that arrive later still get shown; in between,
    // low power still animates the cheap 2-D overlay (01 demos, Sun pulse, grids)
    const hold = still && sCur === drawnS && W === drawnW && red.zoom === drawnZoom && now - drawnAt < 500;
    if (hold && reduced) return;
    if (!hold) {
      drawnS = sCur;
      drawnW = W;
      drawnAt = now;
      drawnZoom = red.zoom;
    }
    const fx = effectsAt(sCur);
    // the distance sweep drives a gentle dolly towards the Galactic Centre in section 02
    // the 02 map streams in from the start (nearest slice first), so it is there on arrival
    dust.load();
    // the distance sweep waits at its nearest slice until the map has bloomed out of the Sun
    if (fx.sky > 0.001 || (sCur > 1.3 && sCur < 2.7)) dust.tick(dt, still, fx.bloom);
    // the fly-in along the disk scales with the bloom, so the camera is back behind the Sun
    // (and the Sun on screen) whenever the map grows out of it or folds back in
    const rig = cameraAt(sCur, t, mob, { push: dust.progress * fx.bloom, zoom: red.zoom });

    aimCamera(camera, rig);
    core.quaternion.copy(camera.quaternion);

    shared.uTime.value = t;
    shared.uShearT.value = dustShearTime(t);
    shared.uBright.value = rig.bright;
    shared.uWipe.value = fx.wipe;
    shared.uIRAmt.value = fx.ir;
    bandLayer.visible = fx.band > 0.001;
    irOnly.forEach((p) => (p.visible = fx.ir > 0.001 && fx.wipe < 0.999));
    bandLayer.material.uniforms.uAlphaMul.value = fx.band;
    shared.uPxPerUnit.value = shared.uRes.value[1] / (2 * Math.tan((rig.fov * DEG) / 2));

    const mr = mollRect(W, H, mob);
    // 02's map is centred on the Sun: it blooms out of the Sun's place on screen (seen
    // from the camera without the fly-in, so the map holds still while the distance sweeps)
    aimCamera(originCam, cameraAt(sCur, t, mob, { push: 0, zoom: red.zoom }));
    const sunP = project(rig.frame.sun[0], rig.frame.sun[1], rig.frame.sun[2], originCam);
    const origin = sunP.visible ? sunP : { x: mr.cx, y: mr.cy };
    const e = fx.bloom * fx.bloom * (3 - 2 * fx.bloom);
    const grown = { cx: origin.x + (mr.cx - origin.x) * e, cy: origin.y + (mr.cy - origin.y) * e, a: mr.a * e, b: mr.b * e };
    const mapOn = dust.ready && !DEV_NODUST ? fx.sky * Math.min(1, fx.bloom * 4) : 0;
    shared.uMapAmt.value = mapOn;
    shared.uMapX.value = [0, mapOn > 0 ? 1.01 : 0];
    const [bx, by] = shared.uRes.value;
    shared.uMapEll.value = [(grown.cx / W) * bx, by - (grown.cy / H) * by, Math.max(1e-3, (grown.a / W) * bx), Math.max(1e-3, (grown.b / H) * by)];
    if (!hold) {
      renderer.clear();
      renderer.render(scene, camera);
      // the map grows with the HUD graticule (the same ellipse), so the two stay locked
      dust.render({
        rect: [(grown.cx / W) * 2 - 1, 1 - (grown.cy / H) * 2, (grown.a / W) * 2, (grown.b / H) * 2],
        opacity: mapOn,
        leftFade: 1 - mob,
      });
    }
    const lock = reduced ? 1 : Math.min(1, red.t / RED_LOCK_S);
    hud.draw({ fx, t: reduced ? t : hudTime, P: helpers(rig.frame), map: { ...grown, grow: e, ready: dust.ready && !DEV_NODUST, kpc: dust.kpc }, red: { lock, zoom: red.zoom, since: red.t - RED_LOCK_S - RED_ZOOM_S }, frozen: reduced });

    if (!reduced) watchPerf(realDt);
  }

  resize();
  measure();
  raf = requestAnimationFrame(frame);

  return {
    setReduced(v) {
      reduced = v;
      drawnS = NaN;
      if (!raf) raf = requestAnimationFrame(frame);
    },
    setPaused(v) {
      paused = v;
      if (!v && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    remeasure: measure,
    dispose() {
      cancelAnimationFrame(raf);
      offDemo();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      dust.dispose();
      Object.values(geoms).forEach((g) => g.dispose());
      points.forEach((p) => p.material.dispose());
      [diskMat, hazeMat, coreMat].forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}
