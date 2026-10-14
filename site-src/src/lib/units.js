import { DEG, RAD } from './coords.js';
import { fmt } from './format.js';

/** Length units expressed in parsecs. */
const PC = { pc: 1, kpc: 1000, ly: 1 / 3.261563777, au: 1 / 206264.806247 };

export const toPc = (value, unit) => value * PC[unit];

export function angleToRad(value, unit) {
  if (unit === 'rad') return value;
  if (unit === 'deg') return value * DEG;
  if (unit === 'arcmin') return (value / 60) * DEG;
  return (value / 3600) * DEG;
}

/** Physical diameter + distance → angular diameter, as display rows. */
export function angularDiameterRows(size, sizeUnit, distance, distanceUnit) {
  const D = toPc(size, sizeUnit);
  const d = toPc(distance, distanceUnit);
  const th = 2 * Math.atan(D / (2 * d));
  return [
    ['deg', fmt(th * RAD, 8)],
    ['arcmin', fmt(th * RAD * 60, 6)],
    ['arcsec', fmt(th * RAD * 3600, 4)],
    ['rad', fmt(th, 10)],
  ].map(([k, v]) => ({ k, v }));
}

/** Angular diameter + distance → physical diameter, as display rows. */
export function physicalDiameterRows(angle, angleUnit, distance, distanceUnit) {
  const th = angleToRad(angle, angleUnit);
  const d = toPc(distance, distanceUnit);
  const D = 2 * d * Math.tan(th / 2);
  return [
    ['pc', fmt(D, 6)],
    ['kpc', fmt(D / 1000, 8)],
    ['ly', fmt(D * 3.261563777, 6)],
    ['AU', fmt(D * 206264.806247, 2)],
  ].map(([k, v]) => ({ k, v }));
}
