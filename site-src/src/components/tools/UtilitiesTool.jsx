import { useRef } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { toUiError, useTools } from '../../state/ToolsContext.jsx';
import { convertCoordinates, coordSections } from '../../lib/coordConvert.js';
import { OBLIQUITY_DEG } from '../../lib/coords.js';
import { requiredNumber } from '../../lib/parse.js';
import { angularDiameterRows, physicalDiameterRows } from '../../lib/units.js';
import { absoluteMag, apparentMag, distanceFromMags, distancePc, distanceRows } from '../../lib/magnitude.js';
import { resolveSightline } from '../../lib/sightline.js';
import { fmt } from '../../lib/format.js';
import { extinctionCoefficient, queryExtinction } from '../../data/api.js';
import { FILTERS_2024 } from '../../data/content.js';
import Segmented from '../ui/Segmented.jsx';
import RichText from '../ui/RichText.jsx';
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

function Magnitudes() {
  const { t } = useLang();
  const { state, update } = useTools();
  const run = useRef(0);
  const u = state.utils;
  const v = u.magValues;
  const mode = u.magMode;
  const field = (key) => ({
    value: v[key],
    onChange: (e) => update('utils', (s) => ({ magValues: { ...s.magValues, [key]: e.target.value } })),
  });
  const setValues = (patch) => update('utils', (s) => ({ magValues: { ...s.magValues, ...patch } }));
  const clear = { magRows: null, magNote: null, magError: null };

  // A_λ: none, typed, or E(B−V) from this map at (position, d) turned into A_λ by the 2024 toolbox
  const extinction = async (dPc) => {
    if (v.ext === 'none') return { A: 0 };
    if (v.ext === 'manual') return { A: requiredNumber(v.A) };
    const pos = resolveSightline(v.frame, { ...v, d: String(dPc / 1000) });
    const teff = requiredNumber(v.teff);
    const q = await queryExtinction(pos);
    if (q.ebv == null) throw new Error('E(B−V) = null');
    const r = await extinctionCoefficient({ use2023: false, mode: 'ext', band: v.band, ebv: Math.max(0, q.ebv), teff });
    return {
      A: r.result,
      rows: [
        { k: t.magEbv, v: `${fmt(q.ebv, 4)} ± ${fmt(q.sigma, 4)}` },
        { k: `A_{λ} (${bandLabel(v.band)})`, v: fmt(r.result, 4) },
      ],
      warn: pos.d > q.maxDist ? t.warnMax.replace('{d}', fmt(q.maxDist, 2)) : null,
    };
  };

  const compute = async () => {
    const id = ++run.current;
    update('utils', { ...clear, magBusy: true });
    try {
      let rows;
      let ext;
      if (mode === 'toDist') {
        ext = await extinction(null);
        const dPc = distanceFromMags(requiredNumber(v.m), requiredNumber(v.M), ext.A);
        rows = distanceRows(dPc);
      } else {
        const dPc = distancePc(requiredNumber(v.dist), v.distUnit);
        ext = await extinction(dPc);
        rows =
          mode === 'toAbs'
            ? [{ k: 'M', v: fmt(absoluteMag(requiredNumber(v.m), dPc, ext.A), 4) }]
            : [{ k: 'm', v: fmt(apparentMag(requiredNumber(v.M), dPc, ext.A), 4) }];
        rows.push({ k: 'μ = 5 log₁₀(d / 10 pc)', v: distanceRows(dPc).at(-1).v });
      }
      if (v.ext !== 'none') rows.push(...(ext.rows || [{ k: 'A_{λ}', v: fmt(ext.A, 4) }]));
      if (id === run.current) update('utils', { magRows: rows, magNote: ext.warn || null, magError: null, magBusy: false });
    } catch (e) {
      if (id === run.current) update('utils', { ...clear, magError: toUiError(e), magBusy: false });
    }
  };

  const extOptions = [
    { value: 'none', label: t.extNone },
    { value: 'manual', label: t.extManual },
    ...(mode === 'toDist' ? [] : [{ value: 'map', label: t.extMap }]),
  ];
  return (
    <div className="card">
      <Segmented
        className="seg--wrap ang__mode"
        label={t.tabMag}
        value={mode}
        onChange={(magMode) => {
          update('utils', { magMode, ...clear });
          if (magMode === 'toDist' && v.ext === 'map') setValues({ ext: 'manual' });
        }}
        options={[
          { value: 'toAbs', label: t.magToAbs },
          { value: 'toApp', label: t.magToApp },
          { value: 'toDist', label: t.magToDist },
        ]}
      />
      <div className="split split--start">
        <div>
          <div className={mode === 'toDist' ? 'field-pair' : 'mag__row3'}>
            {mode !== 'toApp' && <Field id="magM" label={t.appMag} step="0.01" {...field('m')} />}
            {mode !== 'toAbs' && <Field id="magAbs" label={t.absMag} step="0.01" {...field('M')} />}
            {mode !== 'toDist' && (
              <>
                <Field id="magDist" label={t.distOrPlx} step="0.0001" {...field('dist')} />
                <UnitSelect
                  id="magDistUnit"
                  label={t.unit}
                  options={[['pc', 'pc'], ['kpc', 'kpc'], ['ly', 'ly'], ['mas', t.unitPlx]]}
                  {...field('distUnit')}
                />
              </>
            )}
          </div>
          <div className="field-label mag__ext-label">
            <RichText text={t.extLabel} />
          </div>
          <Segmented className="seg--wrap seg--sm" label={t.extLabel.replace(/_\{(.*?)\}/g, '$1')} value={v.ext} onChange={(ext) => setValues({ ext })} options={extOptions} />
          {mode === 'toDist' && (
            <p className="mag__hint">
              <RichText text={t.extMapNoDist} />
            </p>
          )}
          {v.ext === 'manual' && <Field id="magA" label={<RichText text="A_{λ} (mag)" />} step="0.001" {...field('A')} />}
          {v.ext === 'map' && (
            <div className="stack">
              <div className="mag__row3">
                <UnitSelect
                  id="magFrame"
                  label={t.frameLabel}
                  options={[
                    ['galactic', t.galactic],
                    ['equatorial', t.equatorial],
                  ]}
                  {...field('frame')}
                />
                {v.frame === 'galactic' ? (
                  <>
                    <Field id="magL" label={t.lLabel} step="0.0001" {...field('l')} />
                    <Field id="magB" label={t.bLabel} step="0.0001" {...field('b')} />
                  </>
                ) : (
                  <>
                    <Field id="magRa" label="RA (deg)" step="0.0001" {...field('ra')} />
                    <Field id="magDec" label="Dec (deg)" step="0.0001" {...field('dec')} />
                  </>
                )}
              </div>
              <div className="field-pair">
                <div>
                  <label htmlFor="magBand" className="field-label">
                    {t.magBand}
                  </label>
                  <select id="magBand" className="select" {...field('band')}>
                    {FILTERS_2024.map((g) => (
                      <optgroup key={g.sys} label={g.sys}>
                        {g.bands.map(([id, label]) => (
                          <option key={id} value={id}>
                            {g.sys === 'Wavelength' ? label : `${g.sys} ${label}`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <Field id="magTeff" label="Teff (K)" step="10" {...field('teff')} />
              </div>
            </div>
          )}
          <button type="button" className="btn-primary tool-submit" onClick={compute} disabled={u.magBusy}>
            {u.magBusy ? t.computing : t.compute}
          </button>
        </div>
        <Output label={t.output} error={u.magError} empty={!u.magRows} minHeight={160}>
          {u.magRows && (
            <div className="tile-grid">
              {u.magRows.map((row) => (
                <div key={row.k} className="tile">
                  <div className="tile__k">
                    <RichText text={row.k} />
                  </div>
                  <div className="tile__v">{row.v}</div>
                </div>
              ))}
            </div>
          )}
          {u.magNote && <div className="qr__warn mag__warn">⚠ {u.magNote}</div>}
          <p className="mag__hint">
            <RichText text={v.ext === 'map' ? `${t.magFormula} ${t.magMapNote}` : t.magFormula} />
          </p>
        </Output>
      </div>
    </div>
  );
}

const bandLabel = (id) => {
  for (const g of FILTERS_2024) {
    const hit = g.bands.find(([b]) => b === id);
    if (hit) return g.sys === 'Wavelength' ? hit[1] : `${g.sys} ${hit[1]}`;
  }
  return id;
};

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
          { value: 'mag', label: t.tabMag },
        ]}
      />
      {tab === 'coord' && <CoordConverter />}
      {tab === 'angular' && <AngularSize />}
      {tab === 'mag' && <Magnitudes />}
    </div>
  );
}
