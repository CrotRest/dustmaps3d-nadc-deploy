import { useReveal } from '../hooks/motion.js';
import { useLang } from '../i18n/LangContext.jsx';
import { useTools } from '../state/ToolsContext.jsx';
import SkillPrompt from './ui/SkillPrompt.jsx';
import './ShowcaseSections.css';

/** Section 02 — all-sky map teaser; the map and its distance sweep play in the galaxy background. */
export function SkyMapSection() {
  const { t } = useLang();
  const { openModal } = useTools();
  const reveal = useReveal();

  return (
    <section id="sky-map" className="showcase showcase--sky">
      <div ref={reveal} className="showcase__content">
        <div className="kicker">02</div>
        <h2 className="section-title">{t.plotTitle}</h2>
        <p className="section-sub showcase__sub">{t.plotSub}</p>
        <button type="button" className="pill-link showcase__cta" onClick={() => openModal('plot')}>
          {t.featEnter} →
        </button>
        <SkillPrompt which={1} className="skill-prompt--cta" />
      </div>
    </section>
  );
}

/** Section 03 — the bubble plotter; the infrared galaxy sweeps in behind it. */
export function BcpSection() {
  const { t } = useLang();
  const { openModal } = useTools();
  const reveal = useReveal();
  return (
    <section id="bcp" className="showcase showcase--bcp">
      <div ref={reveal} className="showcase__content">
        <div className="kicker">03</div>
        <h2 className="section-title">{t.bcpTitle}</h2>
        <p className="section-sub showcase__sub">{t.bcpSub}</p>
        <button type="button" className="pill-link showcase__cta" onClick={() => openModal('bcp')}>
          {t.featEnter} →
        </button>
        <SkillPrompt which={2} className="skill-prompt--cta" />
      </div>
    </section>
  );
}

/** Section 04 — the reddening-coefficient toolboxes; a star dims and reddens behind the Aquila Rift. */
export function ReddeningSection() {
  const { t } = useLang();
  const { openModal } = useTools();
  const reveal = useReveal();
  return (
    <section id="reddening" className="showcase showcase--red">
      <div ref={reveal} className="showcase__content">
        <div className="kicker">04</div>
        <h2 className="section-title">{t.redSecTitle}</h2>
        <button type="button" className="pill-link showcase__cta" onClick={() => openModal('reddening')}>
          {t.featEnter} →
        </button>
      </div>
    </section>
  );
}

/** Section 05 — utilities teaser; the celestial sphere is drawn by the galaxy background. */
export function ToolsBoxSection() {
  const { t } = useLang();
  const { openModal } = useTools();
  const reveal = useReveal();

  return (
    <section id="tools-box" className="showcase showcase--tools">
      <div ref={reveal} className="showcase__content">
        <div className="kicker">05</div>
        <h2 className="section-title">{t.toolsTitle}</h2>
        <ol className="bcp__points">
          {[t.tabCoord, t.tabAng, t.tabMag].map((name, i) => (
            <li key={name}>
              <span className="bcp__num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{name}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="pill-link showcase__cta" onClick={() => openModal('tools')}>
          {t.featEnter} →
        </button>
      </div>
    </section>
  );
}
