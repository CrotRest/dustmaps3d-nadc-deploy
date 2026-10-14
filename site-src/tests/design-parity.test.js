// Parity with the Claude Design mock-up: every expected value below was produced
// by running the design's own logic (scripts/extract-design-golden.mjs). The design's
// simulated model now only drives the galaxy HUD's demo numbers; the tools call the
// backend (tests/backend-client.test.js).
import { describe, expect, it } from 'vitest';
import golden from './fixtures/design-golden.json';
import astropy from './fixtures/astropy-coords.json';
import { createMockModel } from '../src/data/mockModel.js';
import { BIBTEX, CODE_SNIPPET } from '../src/data/content.js';
import { cartFromLbd, eclToEq, eqToEcl, eqToGal, galToEq, lbdFromCart } from '../src/lib/coords.js';
import { fmt, fmtDms, fmtHms } from '../src/lib/format.js';
import { resolveSightline } from '../src/lib/sightline.js';
import { convertCoordinates, coordSections } from '../src/lib/coordConvert.js';
import { angularDiameterRows, physicalDiameterRows } from '../src/lib/units.js';
import { textStats } from '../src/lib/textStats.js';
import { InputError } from '../src/lib/parse.js';
import { STRINGS } from '../src/i18n/strings.js';
import { TOOL_DOCS } from '../src/i18n/docs.js';

const model = createMockModel();
const num = (v) => (typeof v === 'string' ? Number(v) : v);

describe('mock dust model', () => {
  it.each(golden.model)('sightline(%o) matches the design bit-for-bit', (g) => {
    const m = model.sightline(g.l, g.b, g.d);
    expect(m.ebv).toBe(g.ebv);
    expect(m.density).toBe(g.density);
    expect(m.sigma).toBe(g.sigma);
    expect(m.maxDist).toBe(g.maxDist);
    expect(m.bubble).toBe(g.bubble);
    expect(m.inCloud).toBe(g.inCloud);
    expect(m.cloud).toEqual(g.cloud);
    expect(model.hash(g.l, g.b)).toBe(g.hash);
    expect(model.densityAt(g.l, g.b, g.d)).toBe(g.dens);
  });

  it('cumulative curve samples match', () => {
    golden.curve.forEach((v, i) => expect(model.ebvCumul(209, -19.4, (9.43 * 1.05 * i) / 64)).toBe(v));
  });
});

describe('coordinates', () => {
  it.each(golden.coords)('transforms of RA=$ra Dec=$dec match the design', (g) => {
    const gal = eqToGal(g.ra, g.dec);
    expect(gal).toEqual(g.gal);
    expect(galToEq(gal.l, gal.b)).toEqual(g.eqBack);
    const ecl = eqToEcl(g.ra, g.dec);
    expect(ecl).toEqual(g.ecl);
    expect(eclToEq(ecl.lambda, ecl.beta)).toEqual(g.eclBack);
    const xyz = cartFromLbd(gal.l, gal.b, 1.234);
    expect(xyz).toEqual(g.xyz);
    expect(lbdFromCart(xyz.x, xyz.y, xyz.z)).toEqual(g.lbd);
  });

  it.each(astropy)('agrees with astropy to 0.1″ at RA=$ra Dec=$dec', (a) => {
    const arcsec = (x) => x * 3600;
    const wrap = (x) => ((x + 180) % 360 + 360) % 360 - 180;
    const gal = eqToGal(a.ra, a.dec);
    expect(Math.abs(arcsec(wrap(gal.l - a.l)) * Math.cos((a.b * Math.PI) / 180))).toBeLessThan(0.1);
    expect(Math.abs(arcsec(gal.b - a.b))).toBeLessThan(0.1);
    const ecl = eqToEcl(a.ra, a.dec);
    expect(Math.abs(arcsec(wrap(ecl.lambda - a.lambda)) * Math.cos((a.beta * Math.PI) / 180))).toBeLessThan(0.1);
    expect(Math.abs(arcsec(ecl.beta - a.beta))).toBeLessThan(0.1);
  });
});

describe('number formatting', () => {
  it.each(golden.fmt)('fmt($v)', (g) => {
    const v = Number(g.v);
    expect(fmt(v)).toBe(g.d);
    expect(fmt(v, 2)).toBe(g.n2);
    expect(fmt(v, 0)).toBe(g.n0);
    expect(fmt(v, 4)).toBe(g.n4);
  });
  it.each(golden.hms)('fmtHms($v)', (g) => expect(fmtHms(g.v)).toBe(g.s));
  it.each(golden.dms)('fmtDms($v)', (g) => expect(fmtDms(g.v)).toBe(g.s));
});

describe('point query input', () => {
  it('validates inputs with translatable errors', () => {
    const err = (fn) => {
      try {
        fn();
      } catch (e) {
        expect(e).toBeInstanceOf(InputError);
        return e.key;
      }
      return null;
    };
    expect(err(() => resolveSightline('galactic', { l: '', b: '1', d: '1' }))).toBe('errEmpty');
    expect(err(() => resolveSightline('galactic', { l: 'abc', b: '1', d: '1' }))).toBe('errNum');
    expect(err(() => resolveSightline('galactic', { l: '1', b: '1', d: '0' }))).toBe('errDist');
    expect(err(() => resolveSightline('galactic', { l: '1', b: '91', d: '1' }))).toBe('errLat');
    expect(err(() => resolveSightline('equatorial', { ra: '10', dec: '', d: '1' }))).toBe('errEmpty');
    // a blank distance is valid: the backend uses the sightline's maximum reliable distance
    expect(resolveSightline('galactic', { l: '1', b: '1', d: '' }).d).toBeNull();
    for (const lang of ['zh', 'en']) for (const k of ['errEmpty', 'errNum', 'errDist', 'errLat']) expect(STRINGS[lang][k]).toBeTruthy();
  });
});

describe('coordinate converter', () => {
  const ids = {
    raDegInput: 'raDeg', decDegInput: 'decDeg', eqDist: 'eqDist',
    raHourInput: 'raH', raMinuteInput: 'raM', raSecondInput: 'raS',
    decDegreeInput: 'decD', decMinuteInput: 'decM', decSecondInput: 'decS',
    lInput: 'l', bInput: 'b', dInput: 'galDist', lambdaInput: 'lambda', betaInput: 'beta', eclDist: 'eclDist',
    xInput: 'x', yInput: 'y', zInput: 'z',
  };
  it.each(golden.convert)('$lang $case.mode matches', ({ lang, case: c, sections, lastGal }) => {
    const values = Object.fromEntries(Object.entries(c.vals).map(([k, v]) => [ids[k], String(v)]));
    const r = convertCoordinates(c.mode, values, { raFormat: c.raFormat, decFormat: c.decFormat });
    expect(coordSections(r, STRINGS[lang])).toEqual(sections);
    expect(r.gal).toEqual(lastGal);
  });
});

describe('angular size & text utilities', () => {
  it.each(golden.ang)('$mode conversion', ({ mode, a, rows }) => {
    const out = mode === 'size'
      ? angularDiameterRows(num(a.sizeValue), a.sizeUnit, num(a.angDist), a.angDistUnit)
      : physicalDiameterRows(num(a.thetaValue), a.thetaUnit, num(a.angDistReverse), a.angDistReverseUnit);
    expect(out).toEqual(rows);
  });
  it.each(golden.text)('text stats ($lang) for %j', ({ lang, s, rows }) => {
    const t = STRINGS[lang];
    const st = textStats(s);
    const got = [[t.tcTotal, st.total], [t.tcWords, st.words], [t.tcCjk, st.cjk], [t.tcLetters, st.letters], [t.tcNoSpace, st.nonSpace]].map(([k, v]) => ({ k, v: String(v) }));
    expect(got).toEqual(rows);
  });
});

// copy the user asked to change after the design (2026-10-08: section 05 became
// "Python · Skills"; the hero line no longer explains the input), and copy that the
// real backend made untrue (2026-10-08: tools follow dustmaps3d-backend)
const REVISED = new Set([
  'navPkg', 'pkgTitle', 'sec1Sub', 'queryTitle', 'plotTitle',
  'batchSub', 'plotSub', 'bcpSub', 'bcpPoints', 'pkgSub', 'resTitle', 'resNote',
  'batchInputLabel', 'batchNone', 'footer', 'navPlot',
  'contacts', // 2026-10-14: user added each contributor's role
]);

describe('copy & content', () => {
  it('UI strings are the design copy', () => {
    for (const lang of ['zh', 'en']) {
      for (const [k, v] of Object.entries(STRINGS[lang])) {
        if (k === 'resources' || REVISED.has(k) || !(k in golden.TR[lang])) continue;
        expect(v, `${lang}.${k}`).toEqual(golden.TR[lang][k]);
      }
      expect(Object.keys(STRINGS[lang]).sort()).toEqual(Object.keys(STRINGS.zh).sort());
    }
  });
  it('resource rows are real links or open a reading modal', () => {
    const modals = new Set(['reddening', 'docs', 'gallery']);
    for (const lang of ['zh', 'en']) {
      expect(STRINGS[lang].resources).toHaveLength(3);
      for (const r of STRINGS[lang].resources) {
        for (const item of r.items) {
          expect(Boolean(item.href) !== Boolean(item.open), `${lang} ${item.name}`).toBe(true);
          if (item.href) expect(item.href).toMatch(/^https:\/\//);
          else expect(modals.has(item.open)).toBe(true);
        }
      }
    }
  });
  it('tool docs are the design copy', () => {
    for (const lang of ['zh', 'en']) {
      // query, plot and batch were rewritten for the backend; the utilities keep the design copy
      for (const m of ['tools']) {
        const g = golden.docs[lang][m];
        const d = TOOL_DOCS[lang][m];
        expect(d.intro).toBe(g.intro);
        expect(d.steps.map(([t, desc], i) => ({ n: i + 1, t, d: desc }))).toEqual(g.steps);
        expect(d.caveats).toEqual(g.caveats);
      }
    }
  });
  it('code snippet and BibTeX match', () => {
    expect(CODE_SNIPPET).toBe(golden.codeSnippet);
    expect(BIBTEX).toBe(golden.bibtex);
  });
});
