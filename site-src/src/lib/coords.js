// Sky-coordinate transforms (ICRS J2000 ↔ Galactic ↔ ecliptic, heliocentric XYZ).
// Angles in degrees; distances in kpc.

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
/** Mean obliquity of the ecliptic at J2000. */
export const OBLIQUITY_DEG = 23.4392911;
const OBL = OBLIQUITY_DEG * DEG;

/** ICRS → Galactic rotation matrix. */
const M = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
];
const MT = M[0].map((_, c) => M.map((r) => r[c]));

export const normDeg = (x) => ((x % 360) + 360) % 360;

const matVec = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

function sph(lon, lat) {
  const a = lon * DEG;
  const d = lat * DEG;
  const cl = Math.cos(d);
  return [cl * Math.cos(a), cl * Math.sin(a), Math.sin(d)];
}

function toSph(v) {
  const r = Math.hypot(v[0], v[1], v[2]);
  return {
    lon: normDeg(Math.atan2(v[1], v[0]) * RAD),
    lat: Math.asin(Math.max(-1, Math.min(1, v[2] / r))) * RAD,
    r,
  };
}

export function eqToGal(ra, dec) {
  const s = toSph(matVec(M, sph(ra, dec)));
  return { l: s.lon, b: s.lat };
}

export function galToEq(l, b) {
  const s = toSph(matVec(MT, sph(l, b)));
  return { ra: s.lon, dec: s.lat };
}

export function eqToEcl(ra, dec) {
  const r = ra * DEG;
  const d = dec * DEG;
  const x = Math.cos(d) * Math.cos(r);
  const y = Math.cos(d) * Math.sin(r);
  const z = Math.sin(d);
  const ye = Math.cos(OBL) * y + Math.sin(OBL) * z;
  const ze = -Math.sin(OBL) * y + Math.cos(OBL) * z;
  return { lambda: normDeg(Math.atan2(ye, x) * RAD), beta: Math.asin(ze) * RAD };
}

export function eclToEq(lambda, beta) {
  const l = lambda * DEG;
  const b = beta * DEG;
  const x = Math.cos(b) * Math.cos(l);
  const ye = Math.cos(b) * Math.sin(l);
  const ze = Math.sin(b);
  const y = Math.cos(OBL) * ye - Math.sin(OBL) * ze;
  const z = Math.sin(OBL) * ye + Math.cos(OBL) * ze;
  const s = toSph([x, y, z]);
  return { ra: s.lon, dec: s.lat };
}

/** Galactic (l, b, d) → heliocentric Cartesian XYZ. */
export function cartFromLbd(l, b, d) {
  const lr = l * DEG;
  const br = b * DEG;
  return { x: d * Math.cos(br) * Math.cos(lr), y: d * Math.cos(br) * Math.sin(lr), z: d * Math.sin(br) };
}

export function lbdFromCart(x, y, z) {
  const d = Math.hypot(x, y, z);
  return { l: normDeg(Math.atan2(y, x) * RAD), b: Math.asin(z / d) * RAD, d };
}
