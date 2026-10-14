import { useLang } from '../../i18n/LangContext.jsx';
import { toUiError, useTools } from '../../state/ToolsContext.jsx';
import { convertCoordinates, coordSections } from '../../lib/coordConvert.js';
import { OBLIQUITY_DEG } from '../../lib/coords.js';
import { requiredNumber } from '../../lib/parse.js';
import { textStats } from '../../lib/textStats.js';
import { angularDiameterRows, physicalDiameterRows } from '../../lib/units.js';
import Segmented from '../ui/Segmented.jsx';
import { errorText } from './errorText.js';
import './tools.css';

function Field({ id, label, ...input }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input id={id} className="input" type="number" {...input} />
    </div>
  );
}

function UnitSelect({ id, label, options, ...select }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="select" {...select}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function Output({ label, error, empty, minHeight, children }) {
  const { t } = useLang();
  return (
    <div className="output-col" aria-live="polite">
      <div className="output-col__label output-col__label--tight">{label}</div>
      {error && <div className="notice notice--error notice--sm">{errorText(error, t)}</div>}
      {empty && !error && (
        <div className="await-box" style={{ minHeight }}>
          {t.awaitInput}
        </div>
      )}
      {children}
    </div>
  );
}

function CoordConverter() {
  const { t } = useLang();
  const { state, update, sendToQuery } = useTools();
  const u = state.utils;
  const clearing = { coord: null, coordError: null };
  const field = (key) => ({
    value: u.coordValues[key] ?? '',
    onChange: (e) => update('utils', (s) => ({ coordValues: { ...s.coordValues, [key]: e.target.value } })),
  });

  const convert = () => {
    try {
      const coord = convertCoordinates(u.coordMode, u.coordValues, { raFormat: u.raFormat, decFormat: u.decFormat });
      update('utils', { coord, coordError: null });
    } catch (e) {
      update('utils', { coord: null, coordError: toUiError(e) });
    }
  };

  const mode = u.coordMode;
  return (
    <div className="card">
      <Segmented
        className="seg--block"
        label={t.tabCoord}
        value={mode}
        onChange={(coordMode) => update('utils', { coordMode, ...clearing })}
        options={[
          { value: 'equatorial', label: t.cEq },
          { value: 'galactic', label: t.cGal },
          { value: 'ecliptic', label: t.cEcl },
          { value: 'cartesian', label: 'XYZ' },
        ]}
      />
      <div className="split">
        <div>
          {mode === 'equatorial' && (
            <div>
              <div className="coord__fmt-row">
                <div className="field-label">RA {t.format}</div>
                <Segmented
                  className="seg--sm coord__format"
                  label={`RA ${t.format}`}
                  value={u.raFormat}
                  onChange={(raFormat) => update('utils', { raFormat, ...clearing })}
                  options={[
                    { value: 'deg', label: 'deg' },
                    { value: 'hms', label: 'h m s' },
                  ]}
                />
              </div>
              {u.raFormat === 'deg' ? (
                <input className="input coord__gap" type="number" step="0.000001" placeholder="64.545833" aria-label="RA (deg)" {...field('raDeg')} />
              ) : (
                <div className="triple coord__gap">
                  <input className="input input--compact" type="number" placeholder="h" aria-label="RA h" {...field('raH')} />
                  <input className="input input--compact" type="number" placeholder="m" aria-label="RA m" {...field('raM')} />
                  <input className="input input--compact" type="number" step="0.001" placeholder="s" aria-label="RA s" {...field('raS')} />
                </div>
              )}
              <div className="coord__fmt-row">
                <div className="field-label">Dec {t.format}</div>
                <Segmented
                  className="seg--sm coord__format"
                  label={`Dec ${t.format}`}
                  value={u.decFormat}
                  onChange={(decFormat) => update('utils', { decFormat, ...clearing })}
                  options={[
                    { value: 'deg', label: 'deg' },
                    { value: 'dms', label: 'd m s' },
                  ]}
                />
              </div>
              {u.decFormat === 'deg' ? (
                <input className="input coord__gap" type="number" step="0.000001" placeholder="-0.0027" aria-label="Dec (deg)" {...field('decDeg')} />
              ) : (
                <div className="triple coord__gap">
                  <input className="input input--compact" type="number" placeholder="d" aria-label="Dec d" {...field('decD')} />
                  <input className="input input--compact" type="number" placeholder="m" aria-label="Dec m" {...field('decM')} />
                  <input className="input input--compact" type="number" step="0.001" placeholder="s" aria-label="Dec s" {...field('decS')} />
                </div>
              )}
              <Field id="eqDist" label={t.distOpt} step="0.001" placeholder={t.distOptPh} {...field('eqDist')} />
            </div>
          )}
          {mode === 'galactic' && (
            <div className="stack">
              <Field id="lInput" label="l (deg)" step="0.000001" {...field('l')} />
              <Field id="bInput" label="b (deg)" step="0.000001" {...field('b')} />
              <Field id="dInput" label={t.distOpt} step="0.001" placeholder={t.distOptPh} {...field('galDist')} />
            </div>
          )}
          {mode === 'ecliptic' && (
            <div className="stack">
              <Field id="lambdaInput" label="λ (deg)" step="0.000001" {...field('lambda')} />
              <Field id="betaInput" label="β (deg)" step="0.000001" {...field('beta')} />
              <Field id="eclDist" label={t.distOpt} step="0.001" placeholder={t.distOptPh} {...field('eclDist')} />
            </div>
          )}
          {mode === 'cartesian' && (
            <div className="stack">
              <Field id="xInput" label="X (kpc)" step="0.001" {...field('x')} />
              <Field id="yInput" label="Y (kpc)" step="0.001" {...field('y')} />
              <Field id="zInput" label="Z (kpc)" step="0.001" {...field('z')} />
            </div>
          )}
          <div className="button-row button-row--wrap">
            <button type="button" className="btn-primary button-row__grow coord__convert" onClick={convert}>
              {t.convertBtn}
            </button>
          </div>
        </div>

        <Output label={t.output} error={u.coordError} empty={!u.coord} minHeight={200}>
          {u.coord && (
            <div className="coord__sections">
              {coordSections(u.coord, t).map((sec) => (
                <div key={sec.title} className="result-card">
                  <div className="result-card__title">{sec.title}</div>
                  <div className="result-card__grid">
                    {sec.rows.map((row, i) => (
                      <div key={i} className="result-card__cell">
                        <div className="result-card__k">{row.k}</div>
                        <div className="result-card__v">{row.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="coord__send"
                onClick={() => sendToQuery({ l: u.coord.gal.l.toFixed(5), b: u.coord.gal.b.toFixed(5), d: '1' })}
              >
                → {t.sendToQuery}
              </button>
            </div>
          )}
        </Output>
      </div>

      <div className="coord__conventions">
        <span className="coord__conventions-label">{t.convention}:</span>
        <span className="chip">ICRS J2000</span>
        <span className="chip">Galactic</span>
        <span className="chip">ε = {OBLIQUITY_DEG}°</span>
        <span className="chip">XYZ: {t.heliocentric}</span>
      </div>
    </div>
  );
}

function AngularSize() {
  const { t } = useLang();
  const { state, update } = useTools();
  const u = state.utils;
  const v = u.angValues;
  const field = (key) => ({
    value: v[key],
    onChange: (e) => update('utils', (s) => ({ angValues: { ...s.angValues, [key]: e.target.value } })),
  });
  const toAngle = u.angMode === 'size-to-angle';

  const compute = () => {
    try {
      const angRows = toAngle
        ? angularDiameterRows(requiredNumber(v.size), v.sizeUnit, requiredNumber(v.dist), v.distUnit)
        : physicalDiameterRows(requiredNumber(v.theta), v.thetaUnit, requiredNumber(v.distRev), v.distRevUnit);
      update('utils', { angRows, angError: null });
    } catch (e) {
      update('utils', { angRows: null, angError: toUiError(e) });
    }
  };

  const distanceUnits = [['pc', 'pc'], ['kpc', 'kpc'], ['ly', 'ly']];
  return (
    <div className="card">
      <Segmented
        className="seg--wrap ang__mode"
        label={t.tabAng}
        value={u.angMode}
        onChange={(angMode) => update('utils', { angMode, angRows: null, angError: null })}
        options={[
          { value: 'size-to-angle', label: t.amSize },
          { value: 'angle-to-size', label: t.amAngle },
        ]}
      />
      <div className="split split--start">
        <div>
          {toAngle ? (
            <div className="unit-grid">
              <Field id="sizeValue" label={t.physDiam} step="0.0001" {...field('size')} />
              <UnitSelect id="sizeUnit" label={t.unit} options={[['pc', 'pc'], ['kpc', 'kpc'], ['ly', 'ly'], ['au', 'AU']]} {...field('sizeUnit')} />
              <Field id="angDist" label={t.distance} step="0.0001" {...field('dist')} />
              <UnitSelect id="angDistUnit" label={t.unit} options={distanceUnits} {...field('distUnit')} />
            </div>
          ) : (
            <div className="unit-grid">
              <Field id="thetaValue" label={t.angDiam} step="0.000001" {...field('theta')} />
              <UnitSelect id="thetaUnit" label={t.unit} options={[['deg', 'deg'], ['arcmin', 'arcmin'], ['arcsec', 'arcsec'], ['rad', 'rad']]} {...field('thetaUnit')} />
              <Field id="angDistReverse" label={t.distance} step="0.0001" {...field('distRev')} />
              <UnitSelect id="angDistReverseUnit" label={t.unit} options={distanceUnits} {...field('distRevUnit')} />
            </div>
          )}
          <button type="button" className="btn-primary tool-submit" onClick={compute}>
            {t.compute}
          </button>
        </div>
        <Output label={t.output} error={u.angError} empty={!u.angRows} minHeight={160}>
          {u.angRows && (
            <div className="tile-grid">
              {u.angRows.map((row) => (
                <div key={row.k} className="tile">
                  <div className="tile__k">{row.k}</div>
                  <div className="tile__v">{row.v}</div>
                </div>
              ))}
            </div>
          )}
        </Output>
      </div>
    </div>
  );
}

function TextStats() {
  const { t } = useLang();
  const { state, update } = useTools();
  const u = state.utils;
  const s = u.textStats;
  const rows = s && [
    [t.tcTotal, s.total],
    [t.tcWords, s.words],
    [t.tcCjk, s.cjk],
    [t.tcLetters, s.letters],
    [t.tcNoSpace, s.nonSpace],
  ];
  return (
    <div className="card">
      <div className="split">
        <div>
          <label htmlFor="textInput" className="field-label">
            {t.inputText}
          </label>
          <textarea
            id="textInput"
            className="textarea text-tool__input"
            value={u.text}
            onChange={(e) => update('utils', { text: e.target.value })}
          />
          <div className="button-row">
            <button type="button" className="btn-primary button-row__grow" onClick={() => update('utils', { textStats: textStats(u.text) })}>
              {t.count}
            </button>
            <button type="button" className="btn-secondary" onClick={() => update('utils', { text: '', textStats: null })}>
              {t.clear}
            </button>
          </div>
        </div>
        <Output label={t.output} empty={!rows} minHeight={160}>
          {rows && (
            <div className="tile-grid">
              {rows.map(([k, value]) => (
                <div key={k} className="tile">
                  <div className="tile__k">{k}</div>
                  <div className="tile__v tile__v--big">{String(value)}</div>
                </div>
              ))}
            </div>
          )}
        </Output>
      </div>
    </div>
  );
}

export default function UtilitiesTool() {
  const { t } = useLang();
  const { state, update } = useTools();
  const tab = state.utils.tab;
  return (
    <div>
      <Segmented
        className="seg--tabs"
        label={t.toolsTitle}
        value={tab}
        onChange={(next) => update('utils', { tab: next })}
        options={[
          { value: 'coord', label: t.tabCoord },
          { value: 'angular', label: t.tabAng },
          { value: 'text', label: t.tabText },
        ]}
      />
      {tab === 'coord' && <CoordConverter />}
      {tab === 'angular' && <AngularSize />}
      {tab === 'text' && <TextStats />}
    </div>
  );
}
