import { fmt } from './format.js';
import { InputError } from './parse.js';

// Distance modulus with extinction: m − M = 5 log10(d / 10 pc) + A_λ.

const LY_PER_PC = 3.261563777;

/** Distance [pc] from a value in pc, kpc, ly, or a parallax in mas (d = 1000 / ϖ, no bias correction). */
export function distancePc(value, unit) {
  if (!(value > 0)) throw new InputError('errDistPos');
  if (unit === 'mas') return 1000 / value;
  if (unit === 'kpc') return value * 1000;
  if (unit === 'ly') return value / LY_PER_PC;
  return value;
}

export const distanceModulus = (dPc) => 5 * Math.log10(dPc / 10);

/** m → M */
export const absoluteMag = (m, dPc, A = 0) => m - distanceModulus(dPc) - A;

/** M → m */
export const apparentMag = (M, dPc, A = 0) => M + distanceModulus(dPc) + A;

/** m, M → d [pc] */
export const distanceFromMags = (m, M, A = 0) => 10 ** ((m - M - A) / 5 + 1);

/** Display rows of a distance in every unit the tool takes, plus its modulus. */
export function distanceRows(dPc) {
  return [
    ['d (pc)', fmt(dPc, 4)],
    ['d (kpc)', fmt(dPc / 1000, 6)],
    ['d (ly)', fmt(dPc * LY_PER_PC, 3)],
    ['ϖ (mas)', fmt(1000 / dPc, 6)],
    ['μ = 5 log₁₀(d / 10 pc)', fmt(distanceModulus(dPc), 4)],
  ].map(([k, v]) => ({ k, v }));
}
