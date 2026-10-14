// GLSL for the galaxy background. All layers share one point shader; per-layer
// uniforms pick how a layer moves (orbit / capped-shear orbit / rigid bar / static), how strongly the
// spiral density wave modulates it, and how it looks behind the infrared wipe.

const ARM_GLSL = /* glsl */ `
uniform float uTime;
uniform float uPattern;
uniform float uArmK;
uniform float uArmRef;

float armWeight(vec3 p, float shift, float sharp) {
  float r = length(p.xz);
  float ang = atan(p.z, p.x);
  float psi = ang - uPattern * uTime + uArmK * log(max(r, 0.3) / uArmRef) + shift;
  float w2 = exp((cos(2.0 * psi) - 1.0) * sharp);
  float w4 = exp((cos(4.0 * psi + 1.1) - 1.0) * sharp * 1.6) * 0.5;
  float radial = smoothstep(4.4, 5.6, r) * (1.0 - smoothstep(13.5, 17.0, r)); // arms start at the bar ends (5 kpc)
  return max(w2, w4) * radial;
}
`;

const IR_GLSL = /* glsl */ `
uniform float uWipe;
uniform float uIRAmt;
uniform vec2 uRes;

float irMask() {
  float x = gl_FragCoord.x / uRes.x;
  return uIRAmt * smoothstep(uWipe - 0.0025, uWipe + 0.0025, x);
}

// section 02: between the scan lines the galaxy steps back behind the dust map,
// strongly inside the Mollweide ellipse and lightly around it
uniform vec2 uMapX;
uniform vec4 uMapEll;   // ellipse centre + semi-axes in drawing-buffer px (y up)
uniform float uMapAmt;
float mapDim() {
  if (uMapAmt <= 0.0) return 1.0;
  float x = gl_FragCoord.x / uRes.x;
  float band = smoothstep(uMapX.x - 0.002, uMapX.x + 0.002, x) * (1.0 - smoothstep(uMapX.y - 0.002, uMapX.y + 0.002, x));
  vec2 q = (gl_FragCoord.xy - uMapEll.xy) / uMapEll.zw;
  float inside = 1.0 - smoothstep(0.85, 1.05, dot(q, q));
  return 1.0 - band * uMapAmt * mix(0.22, 0.8, inside);
}
`;

export const pointVertex = /* glsl */ `
${ARM_GLSL}
uniform int uMode;          // 0 orbit, 1 rigid (bar), 2 static (sky), 3 orbit with capped shear (infrared dust)
uniform float uShearT;      // mode 3: elapsed shear time (= uTime until the knee, see dustShearTime)
uniform float uRefOmega;    // mode 3: the solid-body rate once the shear is capped
uniform float uPxPerUnit;   // drawing-buffer px per world unit at distance 1
uniform float uDpr;
uniform float uSizeMul;
uniform float uMinPx;
uniform float uMaxPx;
uniform float uAlphaMul;
uniform float uArmShift;
uniform float uArmSharp;
uniform float uNearFade;
uniform float uTwinkle;

attribute float aOmega;
attribute vec4 aColor;
attribute float aSize;
attribute float aSeed;

varying vec3 vColor;
varying float vAlpha;
varying float vArm;
varying float vSeed;

void main() {
  vec3 p;
  if (uMode == 0) {
    float th = position.z + aOmega * uTime;
    p = vec3(position.x * cos(th), position.y, position.x * sin(th));
  } else if (uMode == 3) {
    float th = position.z + aOmega * uShearT + uRefOmega * (uTime - uShearT);
    p = vec3(position.x * cos(th), position.y, position.x * sin(th));
  } else if (uMode == 1) {
    float a = uPattern * uTime;
    float c = cos(a);
    float s = sin(a);
    p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
  } else {
    p = position;
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  float a = aColor.a * uAlphaMul;
  float size;
  if (uMode == 2) {
    size = aSize * uDpr;
    a *= 1.0 - uTwinkle * 0.5 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.7) + aSeed * 40.0));
  } else {
    size = aSize * uSizeMul * uPxPerUnit / max(dist, 1e-3);
  }
  // keep tiny points energy-conserving and huge ones bounded
  float minPx = uMinPx * uDpr;
  if (size < minPx) {
    a *= (size * size) / (minPx * minPx);
    size = minPx;
  }
  float maxPx = uMaxPx * uDpr;
  if (size > maxPx) {
    a *= maxPx / size;
    size = maxPx;
  }
  a *= smoothstep(uNearFade * 0.35, uNearFade, dist);
  if (dist <= 0.0) a = 0.0;

  vArm = uMode == 2 ? 1.0 : armWeight(p, uArmShift, uArmSharp);
  vColor = aColor.rgb;
  vAlpha = a;
  vSeed = aSeed;
  gl_PointSize = size;
  gl_Position = projectionMatrix * mv;
}
`;

export const pointFragment = /* glsl */ `
${IR_GLSL}
uniform int uPass;          // 0 additive layer, 1 dust (optical, darkening), 2 dust (infrared, glowing)
uniform float uSharp;
uniform float uArmMix;
uniform float uBright;
uniform vec3 uIRColor;
uniform vec3 uIRColor2;
uniform float uIRGain;
uniform float uIRFloor;

varying vec3 vColor;
varying float vAlpha;
varying float vArm;
varying float vSeed;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(c, c);
  if (d2 > 1.0) discard;
  float fall = mix(exp(-d2 * 3.2), exp(-d2 * 11.0), uSharp) * (1.0 - d2);
  float ir = irMask();
  float visW = mix(1.0, vArm, uArmMix);
  float irW = mix(uIRFloor, 1.0, vArm);
  vec3 irCol = mix(uIRColor, uIRColor2, vSeed * vSeed);

  float dim = mapDim();
  if (uPass == 1) {
    float a = vAlpha * visW * fall * (1.0 - ir) * uBright * dim;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor, a);
  } else if (uPass == 2) {
    float a = vAlpha * irW * fall * ir * uIRGain * uBright * dim;
    if (a < 0.002) discard;
    gl_FragColor = vec4(irCol, a);
  } else {
    vec3 col = mix(vColor * visW, irCol * irW * uIRGain, ir);
    float a = vAlpha * fall * uBright * dim;
    if (a < 0.002) discard;
    gl_FragColor = vec4(col, a);
  }
}
`;

// Smooth disk light on a flat plane: exponential profile + spiral arm glow.
export const diskVertex = /* glsl */ `
varying vec3 vWorld;
varying float vFacing;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec3 toCam = normalize(cameraPosition - w.xyz);
  vFacing = abs(toCam.y);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const diskFragment = /* glsl */ `
${ARM_GLSL}
${IR_GLSL}
uniform float uBright;
uniform float uBarAngle;
varying vec3 vWorld;
varying float vFacing;
void main() {
  float r = length(vWorld.xz);
  float arm = armWeight(vWorld, 0.0, 2.2);
  // bar glow in the pattern frame
  float pa = uPattern * uTime + uBarAngle;
  float along = vWorld.x * cos(pa) + vWorld.z * sin(pa);
  float across = -vWorld.x * sin(pa) + vWorld.z * cos(pa);
  float bar = exp(-(along * along / 14.0 + across * across / 0.45) * 1.4);
  float base = exp(-r / 3.2) * 0.3 + exp(-r * r / 1.2) * 0.14 + bar * 0.55;
  float armGlow = arm * exp(-r / 8.5) * 0.5;
  vec3 warm = vec3(1.0, 0.74, 0.46);
  vec3 cool = vec3(0.5, 0.6, 1.0);
  vec3 pink = vec3(0.82, 0.78, 1.0);
  vec3 col = mix(warm, cool, smoothstep(2.0, 12.0, r)) * base + mix(pink, cool, smoothstep(5.0, 13.0, r)) * armGlow;
  float edge = 1.0 - smoothstep(14.0, 17.5, r);
  float facing = smoothstep(0.03, 0.35, vFacing);
  float ir = irMask();
  vec3 irCol = vec3(1.0, 0.36, 0.1) * (base * 0.35 + arm * exp(-r / 8.0) * 0.12);
  vec3 outCol = mix(col, irCol, ir) * edge * facing * uBright * mapDim();
  gl_FragColor = vec4(outCol, 1.0);
}
`;

// Infrared only: the dust disk reaches far past the optical one, a faint warm haze out to
// ~55 kpc on its own wide plane (the optical disk plane above is left as it was).
export const irHazeFragment = /* glsl */ `
${IR_GLSL}
uniform float uBright;
varying vec3 vWorld;
void main() {
  float r = length(vWorld.xz);
  float haze = 0.05 * exp(-r / 14.0) * (1.0 - smoothstep(38.0, 56.0, r));
  float facing = smoothstep(0.03, 0.35, abs(normalize(cameraPosition - vWorld).y));
  gl_FragColor = vec4(vec3(1.0, 0.36, 0.1) * haze * irMask() * facing * uBright * mapDim(), 1.0);
}
`;

// Camera-facing glow around the bulge.
export const coreVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const coreFragment = /* glsl */ `
${IR_GLSL}
uniform float uBright;
varying vec2 vUv;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 46.0) * 0.6 + exp(-r2 * 12.0) * 0.18 + exp(-r2 * 3.0) * 0.06;
  g *= 1.0 - r2;
  vec3 col = mix(vec3(1.0, 0.72, 0.42), vec3(1.0, 0.94, 0.82), exp(-r2 * 45.0)) * g;
  vec3 irCol = vec3(1.0, 0.42, 0.14) * g * 0.6;
  gl_FragColor = vec4(mix(col, irCol, irMask()) * uBright * mapDim(), 1.0);
}
`;
