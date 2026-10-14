import { useLang } from '../../i18n/LangContext.jsx';
import { useTools } from '../../state/ToolsContext.jsx';
import { QUERY_EXAMPLES } from '../../data/content.js';
import { formatSightline } from '../../lib/sightline.js';
import CopyButton from '../ui/CopyButton.jsx';
import Segmented from '../ui/Segmented.jsx';
import { errorText } from './errorText.js';
import './tools.css';

function QueryResult({ pos, result }) {
  const { t } = useLang();
  const s = formatSightline(pos, result, t);

  return (
    <>
      <div className="qr__head">
        <div className="qr__pos">{s.posStr}</div>
        <CopyButton
          className="btn-chip"
          getText={() =>
            `${s.posStr}\nE(B-V) = ${s.ebvStr} ± ${s.sigmaStr} mag\ndust density = ${s.densityStr} mag/kpc\nmax reliable distance = ${s.maxStr} kpc`
          }
        />
      </div>

      <div className="qr__metrics">
        <div className="qr__tile qr__tile--ebv">
          <div className="qr__ebv-label">E(B−V) · {t.mEbv}</div>
          <div className="qr__ebv-value">
            {s.ebvStr} <span className="qr__ebv-unit">mag</span>
          </div>
          <div className="qr__ebv-sub">
            ± {s.sigmaStr} mag · {t.mSigma}
          </div>
        </div>
        <div className="qr__tile qr__tile--density">
          <div className="qr__tile-label">{t.mDensity}</div>
          <div className="qr__tile-value">{s.densityStr}</div>
          <div className="qr__tile-unit">mag / kpc</div>
        </div>
        <div className="qr__tile">
          <div className="qr__tile-label">{t.mMax}</div>
          <div className="qr__tile-value">{s.maxStr}</div>
          <div className="qr__tile-unit">kpc</div>
        </div>
      </div>

      {s.warn && <div className="qr__warn">⚠ {s.warn}</div>}
    </>
  );
}

export default function QueryTool() {
  const { t } = useLang();
  const { state, update, runQuery } = useTools();
  const q = state.query;

  const field = (key) => ({
    value: q.values[key],
    onChange: (e) => update('query', (s) => ({ values: { ...s.values, [key]: e.target.value } })),
  });
  const applyExample = (ex) => {
    const values = { ...q.values, l: ex.l, b: ex.b, d: ex.d };
    update('query', { frame: 'galactic', values });
    runQuery('galactic', values);
  };

  return (
    <div className="query-tool">
      <div className="card">
        <div className="tool-label">{t.frameLabel}</div>
        <Segmented
          className="seg--fill"
          label={t.frameLabel}
          value={q.frame}
          onChange={(frame) => update('query', { frame })}
          options={[
            { value: 'galactic', label: t.galactic },
            { value: 'equatorial', label: t.equatorial },
          ]}
        />
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            runQuery(q.frame, q.values);
          }}
        >
          {q.frame === 'galactic' ? (
            <div className="field-pair">
              <div>
                <label htmlFor="q_l" className="field-label">
                  {t.lLabel}
                </label>
                <input id="q_l" className="input input--lg" type="number" step="0.0001" placeholder="160.0" {...field('l')} />
              </div>
              <div>
                <label htmlFor="q_b" className="field-label">
                  {t.bLabel}
                </label>
                <input id="q_b" className="input input--lg" type="number" step="0.0001" placeholder="20.0" {...field('b')} />
              </div>
            </div>
          ) : (
            <div className="field-pair">
              <div>
                <label htmlFor="q_ra" className="field-label">
                  RA (deg)
                </label>
                <input id="q_ra" className="input input--lg" type="number" step="0.0001" placeholder="83.82" {...field('ra')} />
              </div>
              <div>
                <label htmlFor="q_dec" className="field-label">
                  Dec (deg)
                </label>
                <input id="q_dec" className="input input--lg" type="number" step="0.0001" placeholder="-5.39" {...field('dec')} />
              </div>
            </div>
          )}
          <div className="query-tool__dist">
            <label htmlFor="q_d" className="field-label">
              {t.distLabel}
            </label>
            <input id="q_d" className="input input--lg" type="number" step="0.001" placeholder={t.distBlankPh} {...field('d')} />
          </div>
          <button type="submit" className="query-tool__run" disabled={q.busy}>
            {q.busy ? t.computing : t.runBtn}
          </button>
        </form>
        <div className="query-tool__examples">
          <div className="query-tool__examples-label">{t.examples}</div>
          {QUERY_EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" className="example-chip" onClick={() => applyExample(ex)}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card query-tool__result" aria-live="polite" aria-busy={q.busy}>
        {q.error && <div className="notice notice--error">{errorText(q.error, t)}</div>}
        {!q.result && !q.error && (
          <div className="query-tool__empty">
            <div className="query-tool__empty-icon" aria-hidden="true">
              ✦
            </div>
            <div>{q.busy ? t.computing : t.emptyState}</div>
          </div>
        )}
        {q.result && <QueryResult pos={q.pos} result={q.result} />}
      </div>
    </div>
  );
}
