import { useRef, useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { toUiError, useTools } from '../../state/ToolsContext.jsx';
import { queryBatchFile, templateUrl } from '../../data/api.js';
import { BATCH_SAMPLE, batchInputCsv, formatBatchRows, parseCsv } from '../../lib/batch.js';
import { saveFile } from '../../lib/download.js';
import Segmented from '../ui/Segmented.jsx';
import { errorText } from './errorText.js';
import './tools.css';

const fileSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

const TEMPLATES = [
  ['galactic', 'csv'],
  ['equatorial', 'csv'],
  ['galactic', 'fits'],
  ['equatorial', 'fits'],
];

/** Upload a CSV/FITS table; the backend returns the same table with the result columns appended. */
function FileBatch() {
  const { t } = useLang();
  const { state, update } = useTools();
  const b = state.batch;
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);

  const run = async () => {
    if (!file) {
      update('batch', { fileError: { key: 'batchFileNone' }, fileDone: null });
      return;
    }
    update('batch', { fileBusy: true, fileError: null, fileDone: null });
    try {
      const blob = await queryBatchFile(file, file.name, b.fileFormat);
      const name = `${file.name.replace(/\.(csv|fits?)$/i, '')}_dustmaps3d.${b.fileFormat}`;
      saveFile(blob, name);
      update('batch', { fileBusy: false, fileDone: name });
    } catch (e) {
      update('batch', { fileBusy: false, fileError: toUiError(e) });
    }
  };

  return (
    <div className="batch-file">
      <div className="batch-file__head">
        <div className="tool-label batch-file__title">{t.batchFileH}</div>
        <div className="batch-file__templates">
          <span>{t.batchTemplates}</span>
          {TEMPLATES.map(([coords, format]) => (
            <a key={coords + format} className="batch-file__tpl" href={templateUrl(coords, format)} download>
              {coords === 'galactic' ? t.cGal : t.cEq} · {format.toUpperCase()}
            </a>
          ))}
        </div>
      </div>
      <p className="batch-file__hint">{t.batchFileHint}</p>
      <div className="batch-file__row">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.fits,.fit"
          className="visually-hidden"
          id="batchFile"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            update('batch', { fileError: null, fileDone: null });
          }}
        />
        <label htmlFor="batchFile" className="btn-secondary batch-file__pick">
          {t.batchFileChoose}
        </label>
        <span className="batch-file__name">{file ? `${file.name} · ${fileSize(file.size)}` : t.batchFileEmpty}</span>
        <Segmented
          className="seg--sm"
          label={t.batchOutFormat}
          value={b.fileFormat}
          onChange={(fileFormat) => update('batch', { fileFormat })}
          options={[
            { value: 'csv', label: 'CSV' },
            { value: 'fits', label: 'FITS' },
          ]}
        />
        <button type="button" className="btn-primary batch-file__run" onClick={run} disabled={b.fileBusy}>
          {b.fileBusy ? t.computing : t.batchFileRun}
        </button>
      </div>
      {b.fileError && <div className="notice notice--error notice--sm">{errorText(b.fileError, t)}</div>}
      {b.fileDone && <div className="batch-file__done">✓ {t.batchFileDone.replace('{name}', b.fileDone)}</div>}
    </div>
  );
}

export default function BatchTool() {
  const { t } = useLang();
  const { state, update } = useTools();
  const b = state.batch;

  const run = async () => {
    let input;
    try {
      input = batchInputCsv(b.text, b.frame);
    } catch (e) {
      update('batch', { rows: null, error: toUiError(e) });
      return;
    }
    update('batch', { busy: true, error: null });
    try {
      const blob = await queryBatchFile(new Blob([input.csv], { type: 'text/csv' }), 'input.csv', 'csv');
      const csv = await blob.text();
      update('batch', { rows: formatBatchRows(parseCsv(csv)), csv, error: null, busy: false });
    } catch (e) {
      update('batch', { rows: null, error: toUiError(e), busy: false });
    }
  };

  return (
    <div className="card">
      <div className="split">
        <div>
          <div className="tool-label">{t.batchFrameLabel}</div>
          <Segmented
            className="batch-tool__frame"
            label={t.batchFrameLabel}
            value={b.frame}
            onChange={(frame) => update('batch', { frame })}
            options={[
              { value: 'galactic', label: t.galactic },
              { value: 'equatorial', label: t.equatorial },
            ]}
          />
          <label htmlFor="batchInput" className="field-label">
            {t.batchInputLabel}
          </label>
          <textarea
            id="batchInput"
            className="textarea batch-tool__input"
            placeholder="209.0, -19.4, 0.4"
            spellCheck="false"
            value={b.text}
            onChange={(e) => update('batch', { text: e.target.value })}
          />
          <div className="button-row">
            <button type="button" className="btn-primary button-row__grow" onClick={run} disabled={b.busy}>
              {b.busy ? t.computing : t.batchRun}
            </button>
            <button type="button" className="btn-secondary" onClick={() => update('batch', { text: BATCH_SAMPLE })}>
              {t.batchSampleBtn}
            </button>
          </div>
        </div>

        <div className="output-col" aria-live="polite" aria-busy={b.busy}>
          <div className="batch-tool__output-head">
            <div className="output-col__label">{t.output}</div>
            {b.rows && (
              <button type="button" className="batch-tool__download" onClick={() => saveFile(new Blob([b.csv], { type: 'text/csv' }), 'dustmaps3d_batch.csv')}>
                ↓ {t.batchDownload}
              </button>
            )}
          </div>
          {b.error && <div className="notice notice--error notice--sm">{errorText(b.error, t)}</div>}
          {!b.rows && !b.error && <div className="await-box batch-tool__await">{b.busy ? t.computing : t.awaitInput}</div>}
          {b.rows && (
            <div className="batch-table">
              <div className="batch-table__scroll">
                <div className="batch-table__row batch-table__row--head">
                  <span>l</span>
                  <span>b</span>
                  <span>d</span>
                  <span>E(B−V)</span>
                  <span>σ</span>
                  <span>dE/dd</span>
                  <span>d_max</span>
                </div>
                <div className="batch-table__body">
                  {b.rows.map((r, i) => (
                    <div key={i} className="batch-table__row">
                      <span>{r.l}</span>
                      <span>{r.b}</span>
                      <span>{r.d}</span>
                      <span className="batch-table__ebv">{r.ebv}</span>
                      <span className="batch-table__sigma">{r.sigma}</span>
                      <span>{r.density}</span>
                      <span className="batch-table__sigma">{r.maxd}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <FileBatch />
    </div>
  );
}
