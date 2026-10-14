import { useLang } from '../../i18n/LangContext.jsx';
import { toUiError, useTools } from '../../state/ToolsContext.jsx';
import { analyzeBubble, bubbleSchematic, plotMap } from '../../data/api.js';
import { BUBBLE_EXAMPLE } from '../../data/content.js';
import { bubbleRequests } from '../../lib/plotParams.js';
import { fmt } from '../../lib/format.js';
import { MarkFields, NumberField, RangeField, StyleFields } from './PlotTool.jsx';
import { errorText } from './errorText.js';
import './tools.css';

const SHELLS = ['near', 'mid', 'far'];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** Side-by-side composite of the three panels at a common height (as the NADC page does). */
async function composeTriptych(urls) {
  const imgs = await Promise.all(urls.map(loadImage));
  const h = Math.max(...imgs.map((i) => i.naturalHeight));
  const widths = imgs.map((i) => Math.round((i.naturalWidth * h) / i.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = widths.reduce((a, b) => a + b, 0);
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let x = 0;
  imgs.forEach((img, i) => {
    ctx.drawImage(img, x, 0, widths[i], h);
    x += widths[i];
  });
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/png'));
}

function Panel({ entry, title, wide }) {
  const { t } = useLang();
  return (
    <figure className={`bubble-panel${wide ? ' bubble-panel--wide' : ''}`}>
      <figcaption className="bubble-panel__title">{title}</figcaption>
      {entry == null && <div className="await-box bubble-panel__await">{t.computing}</div>}
      {entry?.error && <div className="notice notice--error notice--sm">{errorText(entry.error, t)}</div>}
      {entry?.url && (
        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="plot-image__frame">
          <img src={entry.url} alt={title} />
        </a>
      )}
    </figure>
  );
}

export default function BubbleTool() {
  const { t } = useLang();
  const { state, update } = useTools();
  const f = state.bcp;
  const run = f.run;

  const setValue = (patch) => update('bcp', patch);
  const set = (key) => (e) => setValue({ [key]: e.target.value });
  const setPanel = (key, entry) =>
    update('bcp', (s) => ({ run: s.run && { ...s.run, panels: { ...s.run.panels, [key]: entry } } }));

  const generate = async () => {
    let req;
    try {
      req = bubbleRequests(f);
    } catch (e) {
      update('bcp', { error: toUiError(e) });
      return;
    }
    const name = `dustmap_l${req.mid.lon_center.toFixed(2)}_b${req.mid.lat_center.toFixed(2)}.png`;
    const ranges = Object.fromEntries(SHELLS.map((k) => [k, `${fmt(req[k].d_min, 3)}–${fmt(req[k].d_max, 3)} kpc`]));
    update('bcp', { busy: true, error: null, run: { name, ranges, panels: {}, composite: null } });

    // The backend admits at most 4 computations at once: the three shells first, then the rest.
    const call = (key, promise) =>
      promise.then(
        (r) => (setPanel(key, { url: r.url }), r.url),
        (e) => (setPanel(key, { error: toUiError(e) }), null),
      );
    const urls = await Promise.all(SHELLS.map((k) => call(k, plotMap('sin', req[k]))));
    const composite = urls.every(Boolean) ? composeTriptych(urls).catch(() => null) : Promise.resolve(null);
    await Promise.all([
      call('analysis', analyzeBubble(req.analysis)),
      call('schematic', bubbleSchematic(req.schematic)),
      composite.then((url) => update('bcp', (s) => ({ run: s.run && { ...s.run, composite: url } }))),
    ]);
    update('bcp', { busy: false });
  };

  const applyExample = () => setValue({ ...BUBBLE_EXAMPLE, error: null });

  return (
    <div className="card">
      <div className="plot-tool">
        <div className="plot-tool__controls">
          <div>
            <div className="plot-group">{t.bcpKeyH}</div>
            <div className="field-pair field-pair--tight">
              <NumberField id="bcp-l" label={t.plotCenterL} value={f.l} onChange={set('l')} />
              <NumberField id="bcp-b" label={t.plotCenterB} value={f.b} onChange={set('b')} />
            </div>
            <NumberField id="bcp-dia" label={t.bcpDia} value={f.dia} onChange={set('dia')} />
            <RangeField label={t.plotDistRange} to={t.plotTo} step="0.1" min={f.dmin} max={f.dmax} onMin={set('dmin')} onMax={set('dmax')} />
            <MarkFields f={f} setValue={setValue} label={t.bcpMark} idPrefix="bcp" />
          </div>
          <div>
            <div className="plot-group">{t.plotParamsH}</div>
            <StyleFields f={f} set={set} setValue={setValue} idPrefix="bcp" />
          </div>
        </div>

        <div className="plot-tool__output" aria-live="polite" aria-busy={f.busy}>
          {f.error && <div className="notice notice--error notice--sm">{errorText(f.error, t)}</div>}
          {!run && <div className="await-box plot-tool__await">{t.bcpEmpty}</div>}
          {run && (
            <>
              <div className="bubble-triptych">
                {SHELLS.map((k, i) => (
                  <Panel key={k} entry={run.panels[k]} title={`${t.bcpShells[i]} · ${run.ranges[k]}`} />
                ))}
              </div>
              <div className="bubble-actions">
                {run.composite ? (
                  <>
                    <a className="batch-tool__download" href={run.composite} download={run.name}>
                      ↓ {t.bcpDownload}
                    </a>
                    <a className="bubble-actions__open" href={run.composite} target="_blank" rel="noopener noreferrer">
                      {t.openNew} ↗
                    </a>
                  </>
                ) : (
                  <span className="plot-tool__hint">{f.busy ? t.computing : ''}</span>
                )}
              </div>
              <div className="bubble-extra">
                <Panel entry={run.panels.analysis} title={t.bcpAnalysis} wide />
                <Panel entry={run.panels.schematic} title={t.bcpSchematic} />
              </div>
            </>
          )}
          <div className="plot-tool__footer">
            <button type="button" className="btn-secondary" onClick={applyExample}>
              {t.batchSampleBtn}
            </button>
            <button type="button" className="plot-tool__generate" onClick={generate} disabled={f.busy}>
              {f.busy ? t.computing : t.bcpRun}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
