import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../hooks/motion.js';
import { useLang } from '../i18n/LangContext.jsx';
import { PAPER_DOI_URL } from '../data/content.js';
import bnuLogo from '../assets/logos/bnu.png';
import nadcLogo from '../assets/logos/nadc.png';
import './Hero.css';

/** Number that counts up (ease-out cubic, 1.1 s) the first time it is mostly visible. */
function CountUp({ value, decimals = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return undefined;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - t0) / 1100);
          el.textContent = (value * (1 - Math.pow(1 - k, 3))).toFixed(decimals);
          if (k < 1) raf = requestAnimationFrame(step);
          else el.textContent = value.toFixed(decimals);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, decimals]);
  return <span ref={ref}>{value.toFixed(decimals)}</span>;
}

const LOGOS = [
  { src: bnuLogo, alt: '北京师范大学', height: 34 },
  { src: nadcLogo, alt: 'NADC 国家天文科学数据中心', height: 42 },
];

/** Partner logos, side by side. */
function PartnerLogos() {
  const { t } = useLang();
  return (
    <div className="logos">
      <span className="logos__label">{t.builtOn}</span>
      <div className="logos__row">
        {LOGOS.map((logo) => (
          <div key={logo.alt} className="logos__item">
            <img src={logo.src} alt={logo.alt} style={{ height: logo.height }} draggable="false" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  const { t } = useLang();
  return (
    <>
      <section className="hero">
        <div className="hero__body">
          <h1 className="hero__title">{t.heroTitle}</h1>
          <p className="hero__cite">
            {t.heroCitePre} ·{' '}
            <a href={PAPER_DOI_URL} target="_blank" rel="noopener noreferrer">
              {t.heroDoi}
            </a>
          </p>
          <div className="hero__ctas">
            {/* to section 01 rather than straight into the tool, so the lock-on demos get seen */}
            <a href="#features" className="hero__cta hero__cta--primary">
              {t.heroCta1} →
            </a>
            <a href="#package" className="hero__cta hero__cta--ghost">
              {t.heroCta2}
            </a>
            <a href="#skills" className="hero__cta hero__cta--ghost">
              {t.heroSkill}
            </a>
          </div>
          <div className="hero__stats">
            <div>
              <div className="hero__stat-value">
                <CountUp value={3.3} decimals={1} />
                <span className="hero__stat-prime">′</span>
              </div>
              <div className="hero__stat-label">{t.statRes}</div>
            </div>
            <div className="hero__stat-divider" />
            <div>
              <div className="hero__stat-value">
                <CountUp value={15} />+<span className="hero__stat-unit"> kpc</span>
              </div>
              <div className="hero__stat-label">{t.mMax}</div>
            </div>
            <div className="hero__stat-divider" />
            <div>
              <div className="hero__stat-value">
                ~<CountUp value={0.01} decimals={2} />
                <span className="hero__stat-unit"> mag</span>
              </div>
              <div className="hero__stat-label">{t.statPrec}</div>
            </div>
          </div>
        </div>
      </section>
      <PartnerLogos />
    </>
  );
}
