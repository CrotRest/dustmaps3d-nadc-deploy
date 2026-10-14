import { DEG } from '../lib/coords.js';

/** Seed used by the design mock-up; changing it reshuffles the fake clouds. */
export const DEMO_SEED = 7;

/**
 * Deterministic toy dust model that stands in for the real dustmaps3d service.
 * Numbers are plausible-looking but NOT scientific — see README.
 */
export function createMockModel(seed = DEMO_SEED) {
  function hash(l, b) {
    const x = Math.sin((Math.floor(l) + 0.5) * 12.9898 + (Math.floor(b) + 0.5) * 78.233 + seed * 3.17) * 43758.5453;
    return x - Math.floor(x);
  }

  /** Cumulative E(B−V) [mag] from the Sun to distance d [kpc]. */
  function ebvCumul(l, b, d) {
    const hz = 0.15;
    const n0 = 0.55 * (1 + 0.35 * Math.sin(l * DEG * 1.5 + seed));
    const sb = Math.abs(Math.sin(b * DEG));
    let v = sb < 1e-3 ? n0 * d : ((n0 * hz) / sb) * (1 - Math.exp((-d * sb) / hz));
    const h = hash(l, b);
    if (Math.abs(b) < 22 && h < 0.38) {
      const cd = 0.3 + h * 2.4;
      if (d > cd) v += (0.3 + h * 1.4) * (1 - Math.exp(-(d - cd) / 0.25));
    }
    return v;
  }

  /** Extinction gradient dE/dx [mag/kpc] at distance d. */
  function densityAt(l, b, d) {
    const hz = 0.15;
    const n0 = 0.55 * (1 + 0.35 * Math.sin(l * DEG * 1.5 + seed));
    const sb = Math.abs(Math.sin(b * DEG));
    return n0 * Math.exp((-d * sb) / hz);
  }

  /** All per-sightline quantities reported by a point query. */
  function sightline(l, b, d) {
    const ebv = ebvCumul(l, b, d);
    const density = densityAt(l, b, d);
    const sb = Math.abs(Math.sin(b * DEG));
    const sigma = Math.max(0.006, ebv * 0.07 + 0.012 * (1 - sb));
    const maxDist = Math.min(18, 4 + 11 * Math.sqrt(sb) + 1.5 * Math.cos(l * DEG) + (seed % 5) * 0.2);
    const bubble = Math.abs(0.075 + 0.05 * Math.cos((l + seed * 10) * DEG));
    const h = hash(l, b);
    const inCloud = Math.abs(b) < 22 && h < 0.38;
    let cloud = null;
    if (inCloud) {
      const names = ['MBM', 'LDN', 'TGU', 'Dobashi', 'Khavtassi'];
      cloud = {
        name: names[Math.floor(h * 1000) % names.length] + ' ' + (100 + Math.floor(h * 9000)),
        dist: 0.3 + h * 2.4,
        ebv: 0.3 + h * 1.4,
        size: 8 + h * 120,
      };
    }
    return { ebv, density, sigma, maxDist, bubble, inCloud, cloud };
  }

  return { hash, ebvCumul, densityAt, sightline };
}
