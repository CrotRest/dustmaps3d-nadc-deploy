// The browser side of the dustmaps3d-backend integration: request bodies, response
// mapping and error handling (fetch is stubbed — backend/parity_test.py covers the
// numbers against the running backend and the pip package).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  analyzeBubble,
  extinctionCoefficient,
  plotMap,
  queryBatchFile,
  queryExtinction,
  templateUrl,
} from '../src/data/api.js';
import { batchInputCsv, formatBatchRows, parseCsv } from '../src/lib/batch.js';
import { bubbleRequests, carRequest, dprRequest, sinRequest } from '../src/lib/plotParams.js';
import { formatSightline, resolveSightline } from '../src/lib/sightline.js';
import { InputError } from '../src/lib/parse.js';
import { parseRich } from '../src/components/ui/RichText.jsx';
import { toUiError } from '../src/state/ToolsContext.jsx';
import { errorText } from '../src/components/tools/errorText.js';
import { FILTERS_2023, FILTERS_2024, GALLERY, PLOT_COLORMAPS, SKILL_IDS, SKILLS_REPO_URL } from '../src/data/content.js';
import { STRINGS } from '../src/i18n/strings.js';
import { REFERENCE } from '../src/i18n/reference.js';
import { skillPrompt } from '../src/lib/skills.js';

const json = (status, body) => ({
  ok: status < 400,
  status,
  json: async () => body,
  blob: async () => new Blob([JSON.stringify(body)]),
});

function stubFetch(response) {
  const fn = vi.fn(async () => (typeof response === 'function' ? response() : response));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('point query posts the backend schema and maps the reply', async () => {
    const fetch = stubFetch(json(200, { EBV: 0.1977, dust_density: 0.03, sigma: 0.0385, max_distance: 21.05 }));
    const r = await queryExtinction({ frame: 'equatorial', c1: 83.82, c2: -5.39, d: null });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('./api/v2/dust/query');
    expect(JSON.parse(init.body)).toEqual({ coord_system: 'equatorial', coord1: 83.82, coord2: -5.39, d: null });
    expect(r).toEqual({ ebv: 0.1977, sigma: 0.0385, density: 0.03, maxDist: 21.05 });
  });

  it('batch upload is multipart with the output format', async () => {
    const fetch = stubFetch(json(200, {}));
    await queryBatchFile(new Blob(['l,b,d\n1,2,3\n']), 'input.csv', 'fits');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('./api/v2/dust/batch');
    expect(init.body.get('output_format')).toBe('fits');
    expect(init.body.get('file').name).toBe('input.csv');
    expect(templateUrl('equatorial', 'csv')).toBe('./api/v2/dust/templates?coords=equatorial&file_format=csv');
  });

  it('image endpoints return URLs under /files', async () => {
    stubFetch(json(200, { url: '/files/x.png', filename: 'x.png' }));
    // relative to the page, so the site works under any path the web server proxies
    expect((await plotMap('sin', {})).url).toBe('./files/x.png');
    stubFetch(json(200, { url: 'http://host:58123/files/y.png', filename: 'y.png' }));
    expect((await analyzeBubble({})).url).toBe('http://host:58123/files/y.png');
  });

  it('extinction requests send band for extinction and color for reddening', async () => {
    const fetch = stubFetch(json(200, { result: 0.74 }));
    await extinctionCoefficient({ use2023: false, mode: 'ext', band: 'GAIA3.G', color: 'x', ebv: 0.3, teff: 5500 });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ use_2023: false, mode: 'ext', ebv: 0.3, teff: 5500, band: 'GAIA3.G' });
    await extinctionCoefficient({ use2023: true, mode: 'reddening', band: 'BP', color: 'BP-RP', ebv: 0.3, teff: 5500 });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ use_2023: true, mode: 'reddening', ebv: 0.3, teff: 5500, color: 'BP-RP' });
  });

  it('maps failures to translatable errors', async () => {
    const fail = async (response) => {
      stubFetch(response);
      try {
        await queryExtinction({ frame: 'galactic', c1: 1, c2: 2, d: 1 });
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        return toUiError(e);
      }
      throw new Error('no error');
    };
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(queryExtinction({ frame: 'galactic', c1: 1, c2: 2, d: 1 })).rejects.toMatchObject({ key: 'errBackend' });
    // Vite's proxy answers 500 with a non-JSON body when the backend is down
    expect(await fail({ ok: false, status: 500, json: async () => { throw new SyntaxError('html'); } })).toEqual({ key: 'errBackend', detail: '' });
    expect(await fail(json(503, { detail: 'Computation capacity reached; retry later' }))).toMatchObject({ key: 'errBusy' });
    expect(await fail(json(503, { detail: 'Required scientific dataset or dependency is unavailable' }))).toMatchObject({ key: 'errUnavailable' });
    expect(await fail(json(422, { detail: [{ loc: ['body', 'coord2'], msg: 'Input should be less than or equal to 90' }] }))).toEqual({
      message: 'coord2: Input should be less than or equal to 90',
    });
    expect(await fail(json(422, { detail: '文件列不符合要求。' }))).toEqual({ message: '文件列不符合要求。' });
    for (const lang of ['zh', 'en']) {
      for (const k of ['errBackend', 'errBusy', 'errUnavailable', 'errTooLarge', 'errServer']) expect(STRINGS[lang][k]).toBeTruthy();
      expect(errorText({ key: 'errUnavailable', detail: 'x' }, STRINGS[lang])).toBe(`${STRINGS[lang].errUnavailable} (x)`);
    }
  });
});

describe('point query display', () => {
  it('a blank distance shows the reliable distance the backend used', () => {
    const pos = resolveSightline('galactic', { l: '120', b: '30', d: '' });
    const s = formatSightline(pos, { ebv: 0.2, sigma: 0.04, density: 0.01, maxDist: 21.05 }, STRINGS.en);
    expect(s.posStr).toContain('d 21.05 kpc (max reliable distance)');
    expect(s.warn).toBeNull();
  });
  it('warns when d exceeds the reliable distance and tolerates null values', () => {
    const pos = resolveSightline('equatorial', { ra: '83.82', dec: '-5.39', d: '9' });
    expect(pos).toMatchObject({ frame: 'equatorial', c1: 83.82, c2: -5.39, d: 9 });
    const s = formatSightline(pos, { ebv: null, sigma: null, density: null, maxDist: 4.35 }, STRINGS.zh);
    expect(s.ebvStr).toBe('—');
    expect(s.warn).toContain('4.35');
  });
});

describe('batch input and output', () => {
  it('pasted rows become the backend CSV; blank d is kept blank', () => {
    const text = '209.0, -19.4, 0.4\n370 1.0 2\nbad line\n30.0, 2.0\n1 95 1\n1 2 -1\n83.82 -5.39;1.5';
    expect(batchInputCsv(text, 'galactic')).toEqual({
      csv: 'l,b,d\n209,-19.4,0.4\n10,1,2\n30,2,\n83.82,-5.39,1.5\n',
      count: 4,
    });
    expect(batchInputCsv('83.82, -5.39, 1.5', 'equatorial').csv).toBe('ra,dec,d\n83.82,-5.39,1.5\n');
    expect(() => batchInputCsv('  ', 'galactic')).toThrow(InputError);
    expect(() => batchInputCsv('a b c\n1', 'galactic')).toThrow('batchNone');
  });
  it('the backend CSV is shown with fixed precision', () => {
    const csv = 'ra,dec,d,l,b,E(B-V)_mag,dust_density_mmag_pc,sigma_mag,max_distance_kpc\n'
      + '83.82,-5.39,,209.0123456,-19.3876543,0.0295011,0.0123456,0.00784,5.75\n';
    expect(formatBatchRows(parseCsv(csv))).toEqual([
      { l: '209.012', b: '-19.388', d: '—', ebv: '0.0295', sigma: '0.0078', density: '0.0123', maxd: '5.75' },
    ]);
  });
});

describe('plot requests', () => {
  const style = { sigma: '0.1', vmin: '0.01', vmax: '1', scale: 'log', cmap: 'viridis' };
  it('car and sin bodies follow the backend schemas', () => {
    expect(carRequest({ frame: 'galactic', lmin: '0', lmax: '360', bmin: '-90', bmax: '90', dmin: '0', dmax: '3', ...style })).toEqual({
      coord_system: 'galactic', lon_min: 0, lon_max: 360, lat_min: -90, lat_max: 90, d_min: 0, d_max: 3,
      vmin: 0.01, vmax: 1, norm: 'log', colormap: 'viridis', smoothing_sigma: 0.1,
    });
    expect(sinRequest({ frame: 'equatorial', lc: '83.8', bc: '-5.4', fov: '20', dmin: '0.3', dmax: '0.5', mark: true, markColor: 'red', ...style })).toEqual({
      coord_system: 'equatorial', lon_center: 83.8, lat_center: -5.4, fov: 20, d_min: 0.3, d_max: 0.5,
      vmin: 0.01, vmax: 1, norm: 'log', colormap: 'viridis', smoothing_sigma: 0.1, mark_region: true, mark_color: 'red',
    });
  });
  it('rejects colour and distance ranges the backend would refuse', () => {
    const base = { frame: 'galactic', lmin: '0', lmax: '10', bmin: '0', bmax: '10', dmin: '0', dmax: '1', ...style };
    expect(() => carRequest({ ...base, vmin: '0' })).toThrow('errLogMin');
    expect(() => carRequest({ ...base, vmin: '2' })).toThrow('errColorRange');
    expect(() => carRequest({ ...base, dmin: '2' })).toThrow('errDistRange');
  });
  it('the oblique slice body follows DprPlot (log scale only)', () => {
    const dpr = { angle: '60', offset: '0.3', halfWidth: '0.1', smin: '-3', smax: '3', zmin: '-0.5', zmax: '0.5', origin: true, bubbles: false, vmin: '0.05', vmax: '1', cmap: 'magma' };
    expect(dprRequest(dpr)).toEqual({
      angle_degrees: 60, offset: 0.3, half_width: 0.1, s_range_min: -3, s_range_max: 3, z_range_min: -0.5, z_range_max: 0.5,
      norm: 'log', vmin: 0.05, vmax: 1, colormap: 'magma', show_markers: true, show_superbubbles: false,
    });
    expect(() => dprRequest({ ...dpr, vmin: '0' })).toThrow('errLogMin');
    expect(() => dprRequest({ ...dpr, halfWidth: '0' })).toThrow('errHalfWidth');
    expect(() => dprRequest({ ...dpr, zmax: '-1' })).toThrow('errSliceRange');
    expect(() => dprRequest({ ...dpr, angle: '400' })).toThrow('errAngle');
  });
  it('the bubble plotter builds near / middle / far shells like the NADC page', () => {
    const r = bubbleRequests({ l: '209', b: '-19.4', dia: '8', dmin: '0.3', dmax: '0.5', mark: true, markColor: 'black', ...style });
    expect([r.near.d_min, r.near.d_max, r.mid.d_min, r.mid.d_max, r.far.d_min]).toEqual([0.09999999999999998, 0.3, 0.3, 0.5, 0.5]);
    expect(r.far.d_max).toBeCloseTo(0.7, 12);
    expect([r.near.show_color_bar, r.mid.show_color_bar, r.far.show_color_bar]).toEqual([false, false, true]);
    expect(r.mid).toMatchObject({ fov: 20, bubble_diameter: 8, coord_system: 'galactic', lon_center: 209, lat_center: -19.4 });
    expect(r.analysis).toEqual({ l: 209, b: -19.4, d: 0.4, d_low: 0.3, d_up: 0.5, diameter: 8 });
    expect(r.schematic).toEqual({ diameter: 8 });
    expect(bubbleRequests({ l: '0', b: '0', dia: '100', dmin: '1', dmax: '2', ...style }).mid.fov).toBe(180);
    expect(() => bubbleRequests({ l: '0', b: '0', dia: '5', dmin: '0', dmax: '1', ...style })).toThrow('errDminPos');
  });
});

describe('content', () => {
  it('filters match dustmaps3d-backend (toolkit.FILTER_GROUPS / FILTER_GROUPS_2023)', () => {
    const ids = (groups) => groups.flatMap((g) => g.bands.map(([id]) => id)).sort();
    expect(ids(FILTERS_2024)).toEqual([
      'Johnson.U', 'Johnson.B', 'Johnson.V', 'Johnson.R', 'GAIA3.Gbp', 'GAIA3.G', 'GAIA3.Grp',
      ...'ugriz'.split('').map((b) => `SDSS.${b}`), ...'grizy'.split('').map((b) => `PS1.${b}`),
      '2MASS.J', '2MASS.H', '2MASS.Ks', 'WISE.W1', 'WISE.W2', 'WISE.W3', 'WISE.W4', '440', '550',
    ].sort());
    expect(ids(FILTERS_2023)).toEqual([
      'BP', 'G', 'RP', 'FUV', 'NUV', ...'ugriz'.split('').map((b) => `${b}'`), ...'grizy'.split(''),
      'J', 'H', 'Ks', 'W1', 'W2', 'W3', 'W4',
    ].sort());
    expect(PLOT_COLORMAPS).toEqual(['Spectral_r', 'viridis', 'plasma', 'inferno', 'magma', 'cividis', 'Greys', 'rainbow']);
  });
  it('skill install prompts name the repository and the skill folder', () => {
    for (const lang of ['zh', 'en']) {
      const t = STRINGS[lang];
      expect(t.skills).toHaveLength(SKILL_IDS.length);
      SKILL_IDS.forEach((id, i) => {
        const { full, short } = skillPrompt(t, i);
        expect(full).toContain(SKILLS_REPO_URL);
        expect(full).toContain(`skills/${id}`);
        expect(full).toContain(`~/.claude/skills/${id}/`);
        expect(full).not.toMatch(/\{\w+\}/);
        expect(short).toContain(id);
      });
      const all = skillPrompt(t, 'all').full;
      for (const id of SKILL_IDS) expect(all).toContain(id);
      expect(all).not.toMatch(/\{\w+\}/);
    }
  });
  it('gallery has a caption per figure in both languages', () => {
    expect(GALLERY).toHaveLength(12);
    for (const lang of ['zh', 'en']) expect(STRINGS[lang].galleryCaptions).toHaveLength(12);
  });
  it('reference pages have the same structure in both languages', () => {
    for (const page of ['docs', 'reddening']) {
      const shape = (lang) => REFERENCE[lang][page].map((b) => (b[0] === 'toolbox' ? `toolbox:${b[1]}` : b[0]));
      expect(shape('en')).toEqual(shape('zh'));
      const code = (lang) => REFERENCE[lang][page].filter((b) => b[0] === 'code' && !b[1].includes('<')).map((b) => b[1]);
      expect(code('en')).toEqual(code('zh'));
    }
  });
  it('inline markup parses links, modal links, code and sub/superscripts', () => {
    expect(parseRich('R_{λ} = [doc](#open:docs) `x_y` **b** 10^{-3} [a](https://e.org)')).toEqual([
      { type: 'text', text: 'R' }, { type: 'sub', text: 'λ' }, { type: 'text', text: ' = ' },
      { type: 'link', text: 'doc', href: '#open:docs' }, { type: 'text', text: ' ' }, { type: 'code', text: 'x_y' },
      { type: 'text', text: ' ' }, { type: 'bold', text: 'b' }, { type: 'text', text: ' 10' }, { type: 'sup', text: '-3' },
      { type: 'text', text: ' ' }, { type: 'link', text: 'a', href: 'https://e.org' },
    ]);
  });
});
