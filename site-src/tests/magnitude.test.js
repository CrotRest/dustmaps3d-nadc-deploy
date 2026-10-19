import { describe, expect, it } from 'vitest';
import { absoluteMag, apparentMag, distanceFromMags, distancePc, distanceRows } from '../src/lib/magnitude.js';
import { InputError } from '../src/lib/parse.js';

describe('magnitude converter', () => {
  it('converts distance units and parallax to pc', () => {
    expect(distancePc(10, 'pc')).toBe(10);
    expect(distancePc(1.5, 'kpc')).toBe(1500);
    expect(distancePc(3.261563777, 'ly')).toBeCloseTo(1, 12);
    expect(distancePc(2, 'mas')).toBe(500);
    expect(() => distancePc(0, 'pc')).toThrow(InputError);
    expect(() => distancePc(-1, 'mas')).toThrow(InputError);
  });
  it('m − M = 5 log10(d / 10 pc) + A', () => {
    expect(absoluteMag(5, 10)).toBeCloseTo(5, 12);
    expect(absoluteMag(10, 100, 0.5)).toBeCloseTo(4.5, 12); // μ = 5
    expect(apparentMag(4.5, 100, 0.5)).toBeCloseTo(10, 12);
    expect(distanceFromMags(10, 4.5, 0.5)).toBeCloseTo(100, 9);
    expect(distanceFromMags(15, 4.5, 0.5)).toBeCloseTo(1000, 9);
    // the Sun at 1 AU: M_V = 4.83 gives m_V ≈ −26.74
    expect(apparentMag(4.83, 1 / 206264.806247)).toBeCloseTo(-26.74, 2);
  });
  it('lists the distance in every unit', () => {
    expect(distanceRows(1000).map((r) => r.v)).toEqual(['1000', '1', '3261.564', '1', '10']);
  });
});
