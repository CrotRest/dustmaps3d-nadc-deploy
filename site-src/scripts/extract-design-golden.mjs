// Runs the logic class embedded in the Claude Design mock-up
// (design/3D Dust Map Platform.dc.html) under Node and records its outputs
// as golden fixtures. The unit tests compare the React implementation against
// these values, so the ported model/format/coordinate code stays bit-identical.
//
//   pnpm golden   →   tests/fixtures/design-golden.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(path.join(root, 'tests/fixtures'));
globalThis.requestAnimationFrame = () => 0;
const html = fs.readFileSync(path.join(root, 'design/3D Dust Map Platform.dc.html'), 'utf8');
const start = html.indexOf('<script type="text/x-dc"');
const bodyStart = html.indexOf('>', start) + 1;
const end = html.indexOf('</script>', bodyStart);
const code = html.slice(bodyStart, end);
const factory = new Function('DCLogic', 'React', code + '\nreturn Component;');
class DCLogic { constructor(props) { this.props = props; } setState(p, cb) { const patch = typeof p === 'function' ? p(this.state) : p; Object.assign(this.state, patch || {}); cb && cb(); } }
const React = { createRef: () => ({ current: null }) };
const Component = factory(DCLogic, React);
const make = (lang = 'zh') => new Component({ demoSeed: 7, defaultLang: lang, animate3d: true, showNotes: true });
const c = make();
const inputs = (vals) => { c.el = (id) => (id in vals ? { value: String(vals[id]) } : null); };

const out = { model: [], curve: [], coords: [], fmt: [], hms: [], dms: [], query: [], batch: null, convert: [], ang: [], text: [], plotGrid: null, colors: [], scaleU: [] };
const pts = [[209, -19.4, 0.4], [0, 88, 2.0], [160, 20, 1.5], [120.5, -3.2, 3.0], [45, 0, 5.0], [300, 0.0005, 1], [10, 45, 25], [359.9, -89.9, 0.01], [75.3, 12.7, 0.9], [210, 5, 2.2]];
for (const [l, b, d] of pts) out.model.push({ l, b, d, ...c.model(l, b, d), hash: c.hash(l, b), dens: c.densityAt(l, b, d) });
for (let i = 0; i <= 64; i++) out.curve.push(c.ebvCumul(209, -19.4, 9.43 * 1.05 * i / 64));
const cpts = [[83.82, -5.39], [0, 0], [266.405, -28.936], [192.859, 27.128], [359.99, 89.99], [180, -45], [10.68, 41.27]];
for (const [ra, dec] of cpts) {
  const g = c.eqToGal(ra, dec); const e = c.galToEq(g.l, g.b); const ec = c.eqToEcl(ra, dec); const back = c.eclToEq(ec.lambda, ec.beta);
  const x = c.cartFromLbd(g.l, g.b, 1.234); const lbd = c.lbdFromCart(x.x, x.y, x.z);
  out.coords.push({ ra, dec, gal: g, eqBack: e, ecl: ec, eclBack: back, xyz: x, lbd });
}
for (const v of [0, 1, -1, 0.5, 0.123456789, 1e-5, -2.5e-6, 12345678, 3.1, 100, 99.999999, 0.00009999, 1.10, NaN, Infinity, -0.0001, 42.4200]) {
  out.fmt.push({ v: String(v), d: c.fmt(v), n2: c.fmt(v, 2), n0: c.fmt(v, 0), n4: c.fmt(v, 4) });
}
for (const v of [0, 64.545833, 359.9999, 83.82, -10, 720.5]) out.hms.push({ v, s: c.fmtHms(v) });
for (const v of [0, -0.0027, 41.26917, -89.99, 12.5, -5.391]) out.dms.push({ v, s: c.fmtDms(v) });
// query (both langs, both frames)
for (const lang of ['zh', 'en']) {
  for (const q of [{ frame: 'galactic', q_l: 209.0, q_b: -19.4, q_d: 0.4 }, { frame: 'galactic', q_l: 0.0, q_b: 88.0, q_d: 2.0 }, { frame: 'galactic', q_l: 160, q_b: 20, q_d: 25 }, { frame: 'equatorial', q_ra: 83.82, q_dec: -5.39, q_d: 1.5 }, { frame: 'galactic', q_l: 120.5, q_b: -3.2, q_d: 3 }]) {
    const k = make(lang); k.state.frame = q.frame; k.el = (id) => (id in q ? { value: String(q[id]) } : null);
    k.runQuery();
    const r = k.state.query; out.query.push({ lang, input: q, error: k.state.queryError, query: r && { ...r, curve: undefined, curveLen: r.curve.length, curveLast: r.curve[r.curve.length - 1] } });
  }
}
// batch
{
  const k = make('zh'); k.el = (id) => (id === 'batchInput' ? { value: '209.0, -19.4, 0.4\n0.0, 88.0, 2.0\n160.0, 20.0, 1.5\n120.5, -3.2, 3.0\n45.0, 0.0, 5.0\nbad line\n1 2\n83.82 -5.39;1.5' } : null);
  k.runBatch(); const g = { csv: k.state.batchCsv, rows: k.state.batchRows };
  const k2 = make('en'); k2.state.batchFrame = 'equatorial'; k2.el = (id) => (id === 'batchInput' ? { value: '83.82, -5.39, 1.5\n266.405 -28.936 8' } : null);
  k2.runBatch(); out.batch = { gal: g, eq: { csv: k2.state.batchCsv, rows: k2.state.batchRows } };
}
// convert
const convCases = [
  { mode: 'equatorial', raFormat: 'deg', decFormat: 'deg', vals: { raDegInput: 83.82, decDegInput: -5.39, eqDist: '' } },
  { mode: 'equatorial', raFormat: 'hms', decFormat: 'dms', vals: { raHourInput: 4, raMinuteInput: 18, raSecondInput: 11, decDegreeInput: '-0', decMinuteInput: 0, decSecondInput: 9.72, eqDist: 1.2 } },
  { mode: 'galactic', raFormat: 'hms', decFormat: 'deg', vals: { lInput: 209, bInput: -19.4, dInput: 0.4 } },
  { mode: 'ecliptic', raFormat: 'hms', decFormat: 'deg', vals: { lambdaInput: 100, betaInput: 10, eclDist: '' } },
  { mode: 'cartesian', raFormat: 'hms', decFormat: 'deg', vals: { xInput: -0.3, yInput: 0.2, zInput: 0.1 } },
];
for (const lang of ['zh', 'en']) for (const cc of convCases) {
  const k = make(lang); k.state.coordMode = cc.mode; k.state.raFormat = cc.raFormat; k.state.decFormat = cc.decFormat; k.el = (id) => (id in cc.vals ? { value: String(cc.vals[id]) } : null);
  k.convert(); out.convert.push({ lang, case: cc, sections: k.state.coordSections, error: k.state.coordError, lastGal: k.lastGal });
}
// angular
for (const a of [{ sizeValue: 10, sizeUnit: 'pc', angDist: 1, angDistUnit: 'kpc' }, { sizeValue: 1, sizeUnit: 'au', angDist: 1, angDistUnit: 'pc' }, { sizeValue: 100000, sizeUnit: 'ly', angDist: 780, angDistUnit: 'kpc' }]) {
  const k = make('zh'); k.el = (id) => ({ value: String(a[id]) }); k.angSize(); out.ang.push({ mode: 'size', a, rows: k.state.angRows, err: k.state.angError });
}
for (const a of [{ thetaValue: 0.5, thetaUnit: 'deg', angDistReverse: 0.4, angDistReverseUnit: 'kpc' }, { thetaValue: 30, thetaUnit: 'arcmin', angDistReverse: 150, angDistReverseUnit: 'pc' }, { thetaValue: 1, thetaUnit: 'arcsec', angDistReverse: 1, angDistReverseUnit: 'ly' }, { thetaValue: 0.01, thetaUnit: 'rad', angDistReverse: 2, angDistReverseUnit: 'kpc' }]) {
  const k = make('en'); k.el = (id) => ({ value: String(a[id]) }); k.physSize(); out.ang.push({ mode: 'phys', a, rows: k.state.angRows, err: k.state.angError });
}
// text
for (const lang of ['zh', 'en']) for (const s of ['', 'Hello, world!', '银河系三维尘埃 dust map 2025', "It's a well-known fact.\n  Second line\t tab", 'abc123 def_45 ?!']) {
  const k = make(lang); k.el = () => ({ value: s }); k.countText(); out.text.push({ lang, s, rows: k.state.textRows });
}
// plot grid & colors
{
  const k = make('zh'); const d = 3; const Lmin = 0, Lmax = 360, Bmin = -90, Bmax = 90; const grid = []; let vmax = 0.01;
  for (let l = 0; l < 360; l += 3) for (let b = -90; b < 90; b += 3) { const cl = l + 1.5, cb = b + 1.5; const v = k.ebvCumul(cl, cb, d); const ir = cl >= Lmin && cl <= Lmax && cb >= Bmin && cb <= Bmax; grid.push(v); if (ir && v > vmax) vmax = v; }
  out.plotGrid = { n: grid.length, vmax, sample: [grid[0], grid[37], grid[1234], grid[4000], grid[grid.length - 1]], sum: grid.reduce((a, b) => a + b, 0) };
  for (const cmap of ['Spectral_r', 'Viridis', 'Plasma', 'Inferno', 'Magma', 'Cividis', 'Nope']) { k.state.plotCmap = cmap; out.colors.push({ cmap, c: [0, 0.1, 0.25, 0.5, 0.77, 1, -1, 2].map(u => k.plotColor(u)) }); }
  for (const scale of ['linear', 'log', 'hist']) for (const [vmin, vmaxS] of [['', ''], ['0.2', '1.5'], ['2', '1']]) { k.state.plotScale = scale; k.state.plotVmin = vmin; k.state.plotVmax = vmaxS; out.scaleU.push({ scale, vmin, vmaxS, u: [0, 0.3, 1.2, 2.56, 5].map(v => k.scaleU(v, 2.56)) }); }
}
out.TR = Component.prototype.TR;
out.RBANDS = c.RBANDS;
out.docs = { zh: {}, en: {} };
for (const lang of ['zh', 'en']) { const k = make(lang); for (const m of ['query', 'plot', 'batch', 'tools']) out.docs[lang][m] = k.buildDoc(m); }
{ const k = make('zh'); const rv = k.renderVals(); out.codeSnippet = rv.codeSnippet; out.bibtex = rv.bibtex; }
fs.writeFileSync('design-golden.json', JSON.stringify(out, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v), 2));
console.log('wrote tests/fixtures/design-golden.json', Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v])));
