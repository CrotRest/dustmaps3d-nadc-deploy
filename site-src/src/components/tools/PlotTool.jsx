import { useLang } from '../../i18n/LangContext.jsx';
import { toUiError, useTools } from '../../state/ToolsContext.jsx';
import { plotMap } from '../../data/api.js';
import { MARK_COLORS, PLOT_COLORMAPS } from '../../data/content.js';
import { ORT_PLANES, carRequest, dprRequest, ortRequest, sinRequest } from '../../lib/plotParams.js';
import Segmented from '../ui/Segmented.jsx';
import { errorText } from './errorText.js';
import './tools.css';

export function RangeField({ label, min, max, onMin, onMax, step, to }) {
  return (
    <div className="plot-field">
      <span className="plot-field__label">{label}</span>
      <div className="plot-range">
        <input className="plot-input" type="number" step={step} value={min} onChange={onMin} aria-label={`${label} min`} />
        <span className="plot-range__to">{to}</span>
        <input className="plot-input" type="number" step={step} value={max} onChange={onMax} aria-label={`${label} max`} />
      </div>
    </div>
  );
}

export function NumberField({ id, label, value, onChange, step = 'any' }) {
  return (
    <div className="plot-field">
      <label className="plot-field__label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="plot-input" type="number" step={step} value={value} onChange={onChange} />
    </div>
  );
}

/** Colour settings shared by the sky map and the bubble plotter. */
export function StyleFields({ f, set, setValue, idPrefix }) {
  const { t } = useLang();
  return (
    <>
      <NumberField id={`${idPrefix}-sigma`} label={t.plotSigmaLabel} step="0.05" value={f.sigma} onChange={set('sigma')} />
      <RangeField label={t.plotColorRange} to={t.plotTo} step="0.01" min={f.vmin} max={f.vmax} onMin={set('vmin')} onMax={set('vmax')} />
      <div className="plot-field">
        <span className="plot-field__label">{t.plotScaleLabel}</span>
        <Segmented
          label={t.plotScaleLabel}
          value={f.scale}
          onChange={(scale) => setValue({ scale })}
          options={['hist', 'linear', 'log'].map((v) => ({ value: v, label: v }))}
        />
      </div>
      <div className="plot-field">
        <label className="plot-field__label" htmlFor={`${idPrefix}-cmap`}>
          {t.plotCmapLabel}
        </label>
        <select id={`${idPrefix}-cmap`} className="plot-select" value={f.cmap} onChange={set('cmap')}>
          {PLOT_COLORMAPS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

/** "Add marker" checkbox + colour, as on the NADC bubble form. */
export function MarkFields({ f, setValue, label, idPrefix }) {
  const { t } = useLang();
  return (
    <div className="plot-field plot-mark">
      <label className="plot-check" htmlFor={`${idPrefix}-mark`}>
        <input id={`${idPrefix}-mark`} type="checkbox" checked={f.mark} onChange={(e) => setValue({ mark: e.target.checked })} />
        <span>{label}</span>
      </label>
      <select className="plot-select plot-mark__color" aria-label={t.plotMarkColor} value={f.markColor} disabled={!f.mark} onChange={(e) => setValue({ markColor: e.target.value })}>
        {MARK_COLORS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A backend-rendered PNG with open / download links. */
export function PlotImage({ result, alt }) {
  const { t } = useLang();
  return (
    <figure className="plot-image">
      <a href={result.url} target="_blank" rel="noopener noreferrer" className="plot-image__frame">
        <img src={result.url} alt={alt} />
      </a>
      <figcaption className="plot-image__bar">
        <span className="plot-image__caption">{result.caption}</span>
        <span className="plot-image__links">
          <a href={result.url} target="_blank" rel="noopener noreferrer">
            {t.openNew} ↗
          </a>
          <a href={result.url} download={result.filename}>
            ↓ PNG
          </a>
        </span>
      </figcaption>
    </figure>
  );
}

function Check({ id, checked, onChange, label }) {
  return (
    <div className="plot-field">
      <label className="plot-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
    </div>
  );
}

/** Oblique-slice geometry, as the backend's DprPlot schema takes it. */
function DprFields({ f, set, setValue }) {
  const { t } = useLang();
  return (
    <>
      <div className="field-pair field-pair--tight">
        <NumberField id="dpr-angle" label={t.dprAngle} value={f.angle} onChange={set('angle')} />
        <NumberField id="dpr-offset" label={t.dprOffset} step="0.05" value={f.offset} onChange={set('offset')} />
      </div>
      <NumberField id="dpr-half" label={t.dprHalfWidth} step="0.01" value={f.halfWidth} onChange={set('halfWidth')} />
      <RangeField label={t.dprTRange} to={t.plotTo} step="0.1" min={f.smin} max={f.smax} onMin={set('smin')} onMax={set('smax')} />
      <RangeField label={t.dprZRange} to={t.plotTo} step="0.1" min={f.zmin} max={f.zmax} onMin={set('zmin')} onMax={set('zmax')} />
      <Check id="dpr-bubbles" checked={f.bubbles} onChange={(bubbles) => setValue({ bubbles })} label={t.dprBubbles} />
      <Check id="dpr-origin" checked={f.origin} onChange={(origin) => setValue({ origin })} label={t.dprOrigin} />
    </>
  );
}

/** Orthogonal-slice geometry, as the backend's OrtPlot schema takes it. */
function OrtFields({ f, set, setValue }) {
  const { t } = useLang();
  const [a1, a2, fixed] = ORT_PLANES[f.plane].map((a) => a.toUpperCase());
  return (
    <>
      <div className="plot-field">
        <span className="plot-field__label">{t.ortPlane}</span>
        <Segmented
          label={t.ortPlane}
          value={f.plane}
          onChange={(plane) => setValue({ plane })}
          options={Object.keys(ORT_PLANES).map((v) => ({ value: v, label: v.toUpperCase() }))}
        />
      </div>
      <RangeField label={t.ortAxisRange.replace('{a}', a1)} to={t.plotTo} step="0.1" min={f.r1min} max={f.r1max} onMin={set('r1min')} onMax={set('r1max')} />
      <RangeField label={t.ortAxisRange.replace('{a}', a2)} to={t.plotTo} step="0.1" min={f.r2min} max={f.r2max} onMin={set('r2min')} onMax={set('r2max')} />
      <RangeField label={t.ortThick.replace('{a}', fixed)} to={t.plotTo} step="0.01" min={f.fmin} max={f.fmax} onMin={set('fmin')} onMax={set('fmax')} />
    </>
  );
}

/** Sampling, smoothing and colours of the orthogonal slice; the backend takes linear or log only (no hist). */
function OrtStyleFields({ f, set, setValue }) {
  const { t } = useLang();
  return (
    <>
      <div className="field-pair field-pair--tight">
        <NumberField id="ort-res" label={t.ortRes} value={f.res} onChange={set('res')} />
        <NumberField id="ort-smooth" label={t.ortSmooth} value={f.smooth} onChange={set('smooth')} />
      </div>
      <div className="plot-field">
        <span className="plot-field__label">{t.ortAgg}</span>
        <Segmented
          label={t.ortAgg}
          value={f.agg}
          onChange={(agg) => setValue({ agg })}
          options={[
            { value: 'mean', label: t.ortMean },
            { value: 'median', label: t.ortMedian },
          ]}
        />
      </div>
      <RangeField label={t.plotColorRange} to={t.plotTo} step="0.01" min={f.vmin} max={f.vmax} onMin={set('vmin')} onMax={set('vmax')} />
      <div className="plot-field">
        <span className="plot-field__label">{t.plotScaleLabel}</span>
        <Segmented label={t.plotScaleLabel} value={f.scale} onChange={(scale) => setValue({ scale })} options={['linear', 'log'].map((v) => ({ value: v, label: v }))} />
      </div>
      <div className="plot-field">
        <label className="plot-field__label" htmlFor="ort-cmap">
          {t.plotCmapLabel}
        </label>
        <select id="ort-cmap" className="plot-select" value={f.cmap} onChange={set('cmap')}>
          {PLOT_COLORMAPS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

/** The slice is always drawn on a log scale, so only the range and colormap are free. */
function DprStyleFields({ f, set }) {
  const { t } = useLang();
  return (
    <>
      <RangeField label={t.plotColorRange} to={t.plotTo} step="0.01" min={f.vmin} max={f.vmax} onMin={set('vmin')} onMax={set('vmax')} />
      <div className="plot-field">
        <span className="plot-field__label">{t.plotScaleLabel}</span>
        <span className="plot-tool__hint">{t.dprScaleNote}</span>
      </div>
      <div className="plot-field">
        <label className="plot-field__label" htmlFor="dpr-cmap">
          {t.plotCmapLabel}
        </label>
        <select id="dpr-cmap" className="plot-select" value={f.cmap} onChange={set('cmap')}>
          {PLOT_COLORMAPS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default function PlotTool() {
  const { t } = useLang();
  const { state, update } = useTools();
  const p = state.plot;
  const proj = p.proj;
  const f = p[proj];
  const galactic = f.frame === 'galactic';

  const setValue = (patch) => update('plot', (s) => ({ [proj]: { ...s[proj], ...patch } }));
  const set = (key) => (e) => setValue({ [key]: e.target.value });

  const generate = async () => {
    let body;
    try {
      body = { car: carRequest, sin: sinRequest, ort: ortRequest, dpr: dprRequest }[proj](f);
    } catch (e) {
      update('plot', { error: toUiError(e) });
      return;
    }
    update('plot', { busy: proj, error: null });
    try {
      const r = await plotMap(proj, body);
      const caption =
        proj === 'dpr'
          ? t.dprCaption.replace('{a}', body.angle_degrees).replace('{b}', body.offset)
          : proj === 'ort'
            ? t.ortCaption
                .replace('{p}', `${body.axis1}${body.axis2}`.toUpperCase())
                .replace('{a}', body.fixed_axis.toUpperCase())
                .replace('{b}', body.fixed_range_min)
                .replace('{c}', body.fixed_range_max)
            : t.plotCaption.replace('{a}', body.d_min).replace('{b}', body.d_max);
      update('plot', (s) => ({ busy: null, results: { ...s.results, [proj]: { ...r, caption } } }));
    } catch (e) {
      update('plot', { busy: null, error: toUiError(e) });
    }
  };

  const result = p.results[proj];

  return (
    <div className="card">
      <div className="plot-tool">
        <div className="plot-tool__controls">
          <div>
            <div className="plot-group">{t.plotRegionH}</div>
            {proj === 'dpr' ? (
              <DprFields f={f} set={set} setValue={setValue} />
            ) : proj === 'ort' ? (
              <OrtFields f={f} set={set} setValue={setValue} />
            ) : (
              <>
                <div className="plot-field">
                  <span className="plot-field__label">{t.plotFrameLabel}</span>
                  <Segmented
                    label={t.plotFrameLabel}
                    value={f.frame}
                    onChange={(frame) => setValue({ frame })}
                    options={[
                      { value: 'galactic', label: t.galactic },
                      { value: 'equatorial', label: t.equatorial },
                    ]}
                  />
                </div>
                {proj === 'car' ? (
                  <>
                    <RangeField label={galactic ? t.plotLonGal : t.plotLonEq} to={t.plotTo} min={f.lmin} max={f.lmax} onMin={set('lmin')} onMax={set('lmax')} />
                    <RangeField label={galactic ? t.plotLatGal : t.plotLatEq} to={t.plotTo} min={f.bmin} max={f.bmax} onMin={set('bmin')} onMax={set('bmax')} />
                  </>
                ) : (
                  <>
                    <div className="field-pair field-pair--tight">
                      <NumberField id="plot-lc" label={galactic ? t.plotCenterL : t.plotCenterRa} value={f.lc} onChange={set('lc')} />
                      <NumberField id="plot-bc" label={galactic ? t.plotCenterB : t.plotCenterDec} value={f.bc} onChange={set('bc')} />
                    </div>
                    <NumberField id="plot-fov" label={t.plotFov} value={f.fov} onChange={set('fov')} />
                  </>
                )}
                <RangeField label={t.plotDistRange} to={t.plotTo} step="0.1" min={f.dmin} max={f.dmax} onMin={set('dmin')} onMax={set('dmax')} />
              </>
            )}
          </div>

          <div>
            <div className="plot-group">{t.plotParamsH}</div>
            {proj === 'dpr' ? (
              <DprStyleFields f={f} set={set} />
            ) : proj === 'ort' ? (
              <OrtStyleFields f={f} set={set} setValue={setValue} />
            ) : (
              <StyleFields f={f} set={set} setValue={setValue} idPrefix="plot" />
            )}
          </div>
        </div>

        <div className="plot-tool__output" aria-live="polite" aria-busy={p.busy === proj}>
          <div className="plot-tool__proj">
            <span className="plot-field__label plot-field__label--inline">{t.plotProjLabel}</span>
            <Segmented
              className="seg--wrap"
              label={t.plotProjLabel}
              value={proj}
              onChange={(next) => update('plot', { proj: next, error: null })}
              options={[
                { value: 'car', label: t.plotProjCar },
                { value: 'sin', label: t.plotProjSin },
                { value: 'ort', label: t.plotProjOrt },
                { value: 'dpr', label: t.plotProjDpr },
              ]}
            />
          </div>
          {p.error && <div className="notice notice--error notice--sm">{errorText(p.error, t)}</div>}
          {result && p.busy !== proj ? (
            <PlotImage result={result} alt={t.plotTitle} />
          ) : (
            <div className="await-box plot-tool__await">{p.busy === proj ? t.plotRendering : t.plotEmpty}</div>
          )}
          <div className="plot-tool__footer">
            <span className="plot-tool__hint">{proj === 'dpr' ? t.dprUnitHint : proj === 'ort' ? t.ortUnitHint : t.plotUnitHint}</span>
            <button type="button" className="plot-tool__generate" onClick={generate} disabled={p.busy != null}>
              {p.busy === proj ? t.computing : t.plotGenerate}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
