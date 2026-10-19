import { useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { REFERENCE } from '../../i18n/reference.js';
import { toUiError, useTools } from '../../state/ToolsContext.jsx';
import { extinctionCoefficient } from '../../data/api.js';
import { FILTERS_2023, FILTERS_2024 } from '../../data/content.js';
import Segmented from '../ui/Segmented.jsx';
import ReferenceDoc from './ReferenceDoc.jsx';
import RichText from '../ui/RichText.jsx';
import { errorText } from './errorText.js';
import './reference.css';

const MODELS = {
  '2024': { slice: 't2024', groups: FILTERS_2024, use2023: false },
  '2023': { slice: 't2023', groups: FILTERS_2023, use2023: true },
};

const labelOf = (groups, id) => groups.flatMap((g) => g.bands).find(([b]) => b === id)?.[1] ?? id;
const fmt4 = (x) => (Number.isFinite(x) ? x.toFixed(4) : '—');

/**
 * One reddening calculator (Zhang et al. 2024 XP curve, or the Zhang et al. 2023 package),
 * behaving like the NADC toolboxes: XP returns A_λ / E(a−b) and R = value / E(B−V);
 * 2023 returns R and A_λ / E(a−b) = R × E(B−V).
 */
function Toolbox({ model }) {
  const { lang, t } = useLang();
  const tx = REFERENCE[lang].toolbox;
  const { state, update } = useTools();
  const { slice, groups, use2023 } = MODELS[model];
  const box = state.reddening[slice];
  const set = (patch) => update('reddening', (s) => ({ [slice]: { ...s[slice], ...patch } }));
  const need = box.mode === 'ext' ? 1 : 2;

  const pick = (id) => {
    let picked = box.picked.includes(id) ? box.picked.filter((b) => b !== id) : [...box.picked, id];
    if (picked.length > need) picked = picked.slice(-need);
    set({ picked, result: null, error: null });
  };

  const calc = async () => {
    const ebv = Number(box.ebv);
    const teff = Number(box.teff);
    if (box.picked.length !== need) return set({ error: { message: tx.errPick }, result: null });
    if (!(String(box.ebv).trim() && ebv >= 0 && teff >= 1000)) return set({ error: { message: tx.errEbv }, result: null });
    set({ busy: true, error: null });
    try {
      const r = await extinctionCoefficient({
        use2023, mode: box.mode === 'ext' ? 'ext' : 'reddening',
        band: box.picked[0], color: box.picked.join('-'), ebv, teff,
      });
      const R = use2023 ? r.result : ebv > 0 ? r.result / ebv : NaN;
      const X = use2023 ? r.result * ebv : r.result;
      set({ busy: false, result: { R, X, mode: box.mode, picked: box.picked } });
    } catch (e) {
      set({ busy: false, error: toUiError(e) });
    }
  };

  const names = box.picked.map((id) => labelOf(groups, id));
  const res = box.result;
  const resNames = res?.picked.map((id) => labelOf(groups, id));

  return (
    <section className="toolbox" aria-label={tx[model].title}>
      <div className="toolbox__head">
        <h4 className="toolbox__title">{tx[model].title}</h4>
        <Segmented
          className="seg--sm"
          label={tx[model].title}
          value={box.mode}
          onChange={(mode) => set({ mode, picked: box.picked.slice(0, mode === 'ext' ? 1 : 2), result: null, error: null })}
          options={[
            { value: 'ext', label: tx.modeExt },
            { value: 'red', label: tx.modeRed },
          ]}
        />
      </div>
      <div className="toolbox__groups">
        {groups.map((g) => (
          <div key={g.sys} className="toolbox__group">
            <div className="toolbox__sys">{g.sys}</div>
            <div className="toolbox__chips">
              {g.bands.map(([id, label]) => (
                <button key={id} type="button" className={`toolbox__chip${box.picked.includes(id) ? ' is-on' : ''}`} aria-pressed={box.picked.includes(id)} onClick={() => pick(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="toolbox__inputs">
        <div className="toolbox__field toolbox__field--pick">
          <span className="toolbox__label">{tx.pick}</span>
          <span className="toolbox__picked">{names.length ? names.join(' − ') : need === 1 ? tx.pickHintExt : tx.pickHintRed}</span>
        </div>
        <label className="toolbox__field">
          <span className="toolbox__label">E(B−V)</span>
          <input className="plot-input" type="number" step="0.01" min="0" value={box.ebv} onChange={(e) => set({ ebv: e.target.value })} />
        </label>
        <label className="toolbox__field">
          <span className="toolbox__label">{tx.teff}</span>
          <input className="plot-input" type="number" step="100" min="1000" value={box.teff} onChange={(e) => set({ teff: e.target.value })} />
        </label>
        <button type="button" className="btn-primary toolbox__calc" onClick={calc} disabled={box.busy}>
          {tx.calc}
        </button>
      </div>
      <div className="toolbox__result" aria-live="polite">
        {box.error && <div className="notice notice--error notice--sm">{errorText(box.error, t)}</div>}
        {res && (
          <div className="toolbox__values">
            {res.mode === 'ext' ? (
              <>
                <span>
                  R<sub>{resNames[0]}</sub> = <b>{fmt4(res.R)}</b>
                </span>
                <span>
                  A({resNames[0]}) = <b>{fmt4(res.X)}</b> mag
                </span>
              </>
            ) : (
              <>
                <span>
                  R<sub>{resNames.join(' − ')}</sub> = <b>{fmt4(res.R)}</b>
                </span>
                <span>
                  E({resNames.join(' − ')}) = <b>{fmt4(res.X)}</b> mag
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <p className="toolbox__cite">
        <RichText text={tx[model].cite} />
      </p>
      {tx[model].note && <p className="toolbox__cite toolbox__cite--warn">{tx[model].note}</p>}
    </section>
  );
}

/** Three tabs so each fits one screen: the two calculators, and the method write-up without them. */
export default function ReddeningPanel() {
  const { lang } = useLang();
  const tx = REFERENCE[lang].toolbox;
  const [tab, setTab] = useState('2024');
  return (
    <div className="red-panel">
      <Segmented
        className="seg--tabs"
        label={tx.tabs.guide}
        value={tab}
        onChange={setTab}
        options={['2024', '2023', 'guide'].map((v) => ({ value: v, label: tx.tabs[v] }))}
      />
      {tab === 'guide' ? <ReferenceDoc blocks={REFERENCE[lang].reddening.filter(([type]) => type !== 'toolbox')} /> : <Toolbox key={tab} model={tab} />}
    </div>
  );
}
