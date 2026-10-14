import { eqToGal, galToEq, normDeg } from './coords.js';
import { fmt } from './format.js';
import { InputError, optionalNumber, requiredNumber } from './parse.js';

/**
 * Validate the query form and resolve both coordinate frames.
 * A blank distance is allowed: the backend then uses the sightline's maximum reliable distance.
 * @param {'galactic'|'equatorial'} frame
 * @param {{l:string, b:string, ra:string, dec:string, d:string}} values raw input strings
 * @returns {{frame:string, c1:number, c2:number, l:number, b:number, ra:number, dec:number, d:number|null}}
 *   c1/c2 are the coordinates in the input frame, as sent to the backend
 */
export function resolveSightline(frame, values) {
  let l;
  let b;
  let ra;
  let dec;
  if (frame === 'galactic') {
    l = normDeg(requiredNumber(values.l));
    b = requiredNumber(values.b);
    ({ ra, dec } = galToEq(l, b));
  } else {
    ra = normDeg(requiredNumber(values.ra));
    dec = requiredNumber(values.dec);
    ({ l, b } = eqToGal(ra, dec));
  }
  if (b < -90 || b > 90 || dec < -90 || dec > 90) throw new InputError('errLat');
  const d = optionalNumber(values.d);
  if (d != null && d <= 0) throw new InputError('errDist');
  const [c1, c2] = frame === 'galactic' ? [l, b] : [ra, dec];
  return { frame, c1, c2, l, b, ra, dec, d };
}

/** Display strings for a point-query result in the active language. */
export function formatSightline(pos, r, t) {
  const dStr = pos.d == null ? `${fmt(r.maxDist, 3)} kpc ${t.atMaxDist}` : `${fmt(pos.d, 3)} kpc`;
  const num = (x, n) => (x == null ? '—' : fmt(x, n));
  return {
    posStr: `l ${fmt(pos.l, 3)}°  b ${fmt(pos.b, 3)}°  ·  d ${dStr}  ·  RA ${fmt(pos.ra, 3)}°  Dec ${fmt(pos.dec, 3)}°`,
    ebvStr: num(r.ebv, 4),
    sigmaStr: num(r.sigma, 4),
    densityStr: num(r.density, 4),
    maxStr: num(r.maxDist, 2),
    warn: pos.d != null && r.maxDist != null && pos.d > r.maxDist ? t.warnMax.replace('{d}', fmt(r.maxDist, 2)) : null,
  };
}
