// Data access layer. Every number and figure the tools show comes from
// dustmaps3d-backend (FastAPI, /api/v2 — see backend/README.md).
//
// By default requests are relative to the page ("./api/...", "./files/..."), so the
// built site works under any path as long as the web server forwards <path>/api/ and
// <path>/files/ to the backend (Vite does this in development). A backend on another
// origin is set with VITE_API_BASE at build time.

const BASE = String(import.meta.env.VITE_API_BASE || '.').replace(/\/+$/, '');

/**
 * A failed backend call. `key` names a translated message (errBackend, errBusy,
 * errUnavailable, errTooLarge, errServer); `detail` is the backend's own text.
 */
export class ApiError extends Error {
  constructor(key, detail = '') {
    super(detail || key);
    this.key = key;
    this.detail = detail;
  }
}

/** FastAPI 422 bodies carry either a string or a list of pydantic errors. */
function detailText(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = (d.loc || []).filter((p) => p !== 'body').join('.');
        const msg = String(d.msg || '').replace(/^Value error, /, '');
        return field ? `${field}: ${msg}` : msg;
      })
      .join('; ');
  }
  return '';
}

async function request(path, init) {
  let res;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiError('errBackend');
  }
  if (res.ok) return res;
  let detail = '';
  let isJson = false;
  try {
    detail = detailText((await res.json()).detail);
    isJson = true;
  } catch {
    // a proxy error page, not the backend
  }
  if (!isJson || res.status === 502 || res.status === 504) throw new ApiError('errBackend');
  if (res.status === 503) throw new ApiError(/capacity/i.test(detail) ? 'errBusy' : 'errUnavailable', detail);
  if (res.status === 413) throw new ApiError('errTooLarge', detail);
  if (res.status === 422 || res.status === 400) throw new ApiError(null, detail);
  throw new ApiError('errServer', detail || `HTTP ${res.status}`);
}

const postJson = async (path, body) =>
  (await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();

/** Generated images come back as "/files/<name>.png" (or absolute when the backend sets a public base URL). */
const fileUrl = (url) => (/^https?:\/\//.test(url) ? url : BASE + url);

const withUrl = (r) => ({ ...r, url: fileUrl(r.url) });

/**
 * Point query (POST /dust/query). `d` null = the sightline's maximum reliable distance.
 * @param {{frame:'galactic'|'equatorial', c1:number, c2:number, d:number|null}} q
 * @returns {Promise<{ebv:number|null, sigma:number|null, density:number|null, maxDist:number|null}>}
 */
export async function queryExtinction({ frame, c1, c2, d }) {
  const r = await postJson('/api/v2/dust/query', { coord_system: frame, coord1: c1, coord2: c2, d });
  return { ebv: r.EBV, sigma: r.sigma, density: r.dust_density, maxDist: r.max_distance };
}

/**
 * Batch query (POST /dust/batch, multipart). The backend keeps the input columns and
 * appends E(B-V)_mag, dust_density_mmag_pc, sigma_mag, max_distance_kpc.
 * @param {Blob} file CSV or FITS table with l,b,d or ra,dec,d columns
 * @param {string} filename must end in .csv, .fit or .fits
 * @param {'csv'|'fits'} format
 * @returns {Promise<Blob>}
 */
export async function queryBatchFile(file, filename, format = 'csv') {
  const body = new FormData();
  body.append('file', file, filename);
  body.append('output_format', format);
  return (await request('/api/v2/dust/batch', { method: 'POST', body })).blob();
}

/** URL of a batch input template (GET /dust/templates). */
export const templateUrl = (coords, format) =>
  `${BASE}/api/v2/dust/templates?coords=${coords}&file_format=${format}`;

/**
 * Sky map (POST /plots/car or /plots/sin): mean dust density between d_min and d_max.
 * @param {'car'|'sin'} kind
 * @returns {Promise<{url:string, filename:string}>}
 */
export async function plotMap(kind, body) {
  return withUrl(await postJson(`/api/v2/plots/${kind}`, body));
}

/** Dust profile of a bubble's inner disk vs. its annulus (POST /bubbles/analyze). */
export async function analyzeBubble(body) {
  return withUrl(await postJson('/api/v2/bubbles/analyze', body));
}

/** Inner-disk / annulus schematic (POST /bubbles/schematic). */
export async function bubbleSchematic(body) {
  return withUrl(await postJson('/api/v2/bubbles/schematic', body));
}

/**
 * Extinction / reddening (POST /extinction/coefficient).
 * Zhang et al. 2024 (XP) returns A_λ or E(a−b) in mag; Zhang et al. 2023 returns the
 * dimensionless coefficient R.
 * @returns {Promise<{result:number, model:'XP'|'2023', unit:string, identifier:string}>}
 */
export async function extinctionCoefficient({ use2023, mode, band, color, ebv, teff }) {
  const body = { use_2023: use2023, mode, ebv, teff };
  if (mode === 'ext') body.band = band;
  else body.color = color;
  return postJson('/api/v2/extinction/coefficient', body);
}
