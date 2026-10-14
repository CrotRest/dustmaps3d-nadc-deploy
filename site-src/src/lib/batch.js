import { normDeg } from './coords.js';
import { fmt } from './format.js';
import { InputError } from './parse.js';

/**
 * Parse pasted "coord1, coord2[, distance]" lines (comma, semicolon or whitespace separated)
 * into the CSV dustmaps3d-backend's /dust/batch takes: columns l,b,d or ra,dec,d, with a
 * blank d meaning "the sightline's maximum reliable distance". Unparseable lines are skipped.
 * @returns {{csv:string, count:number}}
 */
export function batchInputCsv(text, frame) {
  const raw = text.trim();
  if (!raw) throw new InputError('errEmpty');
  const rows = [];
  for (const line of raw.split(/\n+/).map((s) => s.trim()).filter(Boolean)) {
    const parts = line.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (parts.length < 2 || parts.length > 3 || parts.some((x) => !Number.isFinite(x))) continue;
    const [a, c, d] = parts;
    if (c < -90 || c > 90 || (d != null && d <= 0)) continue;
    rows.push(`${normDeg(a)},${c},${d ?? ''}`);
  }
  if (!rows.length) throw new InputError('batchNone');
  const header = frame === 'galactic' ? 'l,b,d' : 'ra,dec,d';
  return { csv: [header, ...rows].join('\n') + '\n', count: rows.length };
}

/** Minimal CSV reader for the backend's output (pandas to_csv: no quoted fields in these tables). */
export function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  });
}

const cell = (v, n) => (v === '' || v == null || !Number.isFinite(Number(v)) ? '—' : fmt(Number(v), n));

/** Table rows as displayed, from the backend's CSV rows (Galactic l, b are always present). */
export const formatBatchRows = (records) =>
  records.map((r) => ({
    l: cell(r.l, 3),
    b: cell(r.b, 3),
    d: r.d === '' ? '—' : cell(r.d, 3),
    ebv: cell(r['E(B-V)_mag'], 4),
    sigma: cell(r.sigma_mag, 4),
    density: cell(r.dust_density_mmag_pc, 4),
    maxd: cell(r.max_distance_kpc, 2),
  }));

export const BATCH_SAMPLE = '209.0, -19.4, 0.4\n0.0, 88.0, 2.0\n160.0, 20.0, 1.5\n120.5, -3.2, 3.0\n45.0, 0.0, 5.0\n30.0, 2.0';
