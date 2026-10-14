import { normDeg } from './coords.js';

/** Fixed-point with trailing zeros trimmed; exponent form for very small/large magnitudes. */
export function fmt(x, n = 6) {
  if (!Number.isFinite(x)) return 'NaN';
  const ax = Math.abs(x);
  if (ax > 0 && (ax < 1e-4 || ax >= 1e7)) return x.toExponential(5);
  return x.toFixed(n).replace(/\.?0+$/, '');
}

export function fmtHms(raDeg) {
  const ts = (normDeg(raDeg) / 15) * 3600;
  const h = Math.floor(ts / 3600);
  const m = Math.floor((ts - h * 3600) / 60);
  const s = ts - h * 3600 - m * 60;
  return `${h}h ${m}m ${fmt(s, 3)}s`;
}

export function fmtDms(dec) {
  const sign = dec < 0 ? '-' : '+';
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = (a - d - m / 60) * 3600;
  return `${sign}${d}° ${m}' ${fmt(s, 3)}"`;
}
