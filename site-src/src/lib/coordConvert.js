import { cartFromLbd, eclToEq, eqToEcl, eqToGal, galToEq, lbdFromCart, normDeg } from './coords.js';
import { fmt, fmtDms, fmtHms } from './format.js';
import { optionalNumber, requiredNumber } from './parse.js';

function parseRa(format, v) {
  if (format === 'deg') return normDeg(requiredNumber(v.raDeg));
  const h = requiredNumber(v.raH);
  const m = requiredNumber(v.raM);
  const s = requiredNumber(v.raS);
  return normDeg((h + m / 60 + s / 3600) * 15);
}

function parseDec(format, v) {
  if (format === 'deg') return requiredNumber(v.decDeg);
  const negative = String(v.decD ?? '').trim().startsWith('-');
  const d = requiredNumber(v.decD);
  const m = requiredNumber(v.decM);
  const s = requiredNumber(v.decS);
  return (negative ? -1 : 1) * (Math.abs(d) + Math.abs(m) / 60 + Math.abs(s) / 3600);
}

/**
 * Convert from the chosen input frame to all others.
 * @param {'equatorial'|'galactic'|'ecliptic'|'cartesian'} mode
 * @param {Record<string,string>} v raw input strings
 * @param {{raFormat:'deg'|'hms', decFormat:'deg'|'dms'}} formats
 */
export function convertCoordinates(mode, v, { raFormat, decFormat }) {
  let eq;
  let gal;
  let ecl;
  let xyz;
  let d;
  if (mode === 'equatorial') {
    eq = { ra: parseRa(raFormat, v), dec: parseDec(decFormat, v) };
    d = optionalNumber(v.eqDist);
    gal = eqToGal(eq.ra, eq.dec);
    ecl = eqToEcl(eq.ra, eq.dec);
  } else if (mode === 'galactic') {
    gal = { l: normDeg(requiredNumber(v.l)), b: requiredNumber(v.b) };
    d = optionalNumber(v.galDist);
    eq = galToEq(gal.l, gal.b);
    ecl = eqToEcl(eq.ra, eq.dec);
  } else if (mode === 'ecliptic') {
    ecl = { lambda: normDeg(requiredNumber(v.lambda)), beta: requiredNumber(v.beta) };
    d = optionalNumber(v.eclDist);
    eq = eclToEq(ecl.lambda, ecl.beta);
    gal = eqToGal(eq.ra, eq.dec);
  } else {
    xyz = { x: requiredNumber(v.x), y: requiredNumber(v.y), z: requiredNumber(v.z) };
    const lbd = lbdFromCart(xyz.x, xyz.y, xyz.z);
    d = lbd.d;
    gal = { l: lbd.l, b: lbd.b };
    eq = galToEq(gal.l, gal.b);
    ecl = eqToEcl(eq.ra, eq.dec);
  }
  if (mode !== 'cartesian') xyz = d == null ? null : cartFromLbd(gal.l, gal.b, d);
  return { eq, gal, ecl, xyz, d };
}

/** Output cards for a conversion result in the active language. */
export function coordSections(r, t) {
  const sections = [
    { title: t.eqCoord, rows: [['RA', `${fmt(r.eq.ra)} deg`], ['RA', fmtHms(r.eq.ra)], ['Dec', `${fmt(r.eq.dec)} deg`], ['Dec', fmtDms(r.eq.dec)]] },
    { title: t.galCoord, rows: [['l', `${fmt(r.gal.l)} deg`], ['b', `${fmt(r.gal.b)} deg`]] },
    { title: t.eclCoord, rows: [['λ', `${fmt(r.ecl.lambda)} deg`], ['β', `${fmt(r.ecl.beta)} deg`]] },
  ];
  if (r.xyz && Number.isFinite(r.d)) {
    sections.push({ title: t.xyzCoord, rows: [['X', `${fmt(r.xyz.x)} kpc`], ['Y', `${fmt(r.xyz.y)} kpc`], ['Z', `${fmt(r.xyz.z)} kpc`], ['d', `${fmt(r.d)} kpc`]] });
  }
  return sections.map((s) => ({ title: s.title, rows: s.rows.map(([k, val]) => ({ k, v: val })) }));
}
