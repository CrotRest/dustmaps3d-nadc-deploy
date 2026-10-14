import { useEffect, useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import Segmented from './ui/Segmented.jsx';
import logoMark from '../assets/logo-mark.svg';
import './Nav.css';

const LANG_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'EN' },
];

// every section, in page order
const SECTIONS = [
  { id: 'features', key: 'navQuery' },
  { id: 'sky-map', key: 'navPlot' },
  { id: 'bcp', key: 'navBcp' },
  { id: 'reddening', key: 'navRed' },
  { id: 'tools-box', key: 'navTools' },
  { id: 'package', key: 'navPkg' },
  { id: 'cite', key: 'navCite' },
  { id: 'resources', key: 'navRes' },
  { id: 'contact', key: 'navContact' },
];
// above these widths the links show in the bar, below they fold into the menu button
// (keep in step with Nav.css; the English labels are longer)
const WIDE = { zh: '(min-width: 1101px)', en: '(min-width: 1201px)' };

/** Id of the section under the upper third of the viewport (null over the hero). */
function useActiveSection() {
  const [active, setActive] = useState(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.35;
      let cur = null;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) cur = id;
      }
      // the last, short section never reaches the line: count it once the page bottoms out
      const end = document.documentElement.scrollHeight - 2;
      if (window.innerHeight + window.scrollY >= end) cur = SECTIONS[SECTIONS.length - 1].id;
      setActive(cur);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return active;
}

export default function Nav() {
  const { lang, setLang, t } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = useActiveSection();

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    const mq = window.matchMedia(WIDE[lang]);
    const onWide = () => mq.matches && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    mq.addEventListener('change', onWide);
    return () => {
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onWide);
    };
  }, [menuOpen, lang]);

  const links = SECTIONS.map((s) => ({ id: s.id, href: `#${s.id}`, label: t[s.key] }));
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`nav nav--${lang}`}>
      <div className="nav__inner">
        <a href="#top" className="nav__brand" onClick={closeMenu}>
          <img className="nav__mark" src={logoMark} alt="" aria-hidden="true" />
          <span className="nav__name">3D Dust Map</span>
        </a>
        <nav className="nav__links">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`nav__link${active === l.id ? ' is-active' : ''}`}
              aria-current={active === l.id ? 'location' : undefined}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav__actions">
          <Segmented className="seg--nav" options={LANG_OPTIONS} value={lang} onChange={setLang} label={t.language} />
          <button
            type="button"
            className="nav__menu-btn"
            aria-label={t.menu}
            aria-expanded={menuOpen}
            aria-controls="nav-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              {menuOpen ? (
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="nav-menu" className="nav__menu">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`nav__menu-link${active === l.id ? ' is-active' : ''}`}
              aria-current={active === l.id ? 'location' : undefined}
              onClick={closeMenu}
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
