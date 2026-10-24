import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import { useTools } from '../state/ToolsContext.jsx';
import {
  BIBTEX,
  CITATION_AUTHORS,
  CITATION_JOURNAL,
  CITATION_TAIL,
  CITED_BY,
  CODE_SNIPPET,
  PIP_COMMAND,
} from '../data/content.js';
import CopyButton from './ui/CopyButton.jsx';
import SkillPrompt from './ui/SkillPrompt.jsx';
import SectionHeader from './SectionHeader.jsx';
import './InfoSections.css';

/** Section 06 — pip install + usage snippet, and the three skills (install prompts for an AI, sources on GitHub). */
export function PackageSection() {
  const { t } = useLang();
  return (
    <section id="package" className="package">
      <div className="info-head">
        <div className="kicker">06 · {t.navPkg}</div>
        <h2 className="section-title info-head__title">{t.pkgTitle}</h2>
        <p className="info-head__sub">{t.pkgSub}</p>
      </div>
      <div className="code-card">
        <div className="code-card__row">
          <div className="code-card__label">{t.install}</div>
          <CopyButton className="code-card__copy" getText={() => PIP_COMMAND} />
        </div>
        <pre className="code-card__pip">{PIP_COMMAND}</pre>
        <div className="code-card__label code-card__label--usage">{t.usage}</div>
        <pre className="code-card__code">{CODE_SNIPPET}</pre>
      </div>
      <div id="skills" className="skills">
        <h3 className="skills__title">{t.skillsTitle}</h3>
        <p className="skills__sub">{t.skillsSub}</p>
        <SkillPrompt which="all" className="skills__all" />
        <ol className="skills__list">
          {t.skills.map((s, i) => (
            <li key={s.name} className="skill-row">
              <span className="skill-row__no">{String(i + 1).padStart(2, '0')}</span>
              <span className="skill-row__name">{s.name}</span>
              <span className="skill-row__desc">
                {s.desc}
                <SkillPrompt which={i} className="skill-row__prompt" />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Section 07 — how to cite. */
export function CiteSection() {
  const { t } = useLang();
  return (
    <section id="cite" className="cite">
      <div className="cite__head">
        <div className="info-head info-head--flush">
          <div className="kicker">07 · {t.citeTitle}</div>
          <h2 className="section-title info-head__title">{t.citeTitle}</h2>
          <p className="info-head__sub">{t.citeSub}</p>
        </div>
        <CopyButton className="cite__copy" getText={() => BIBTEX} />
      </div>
      <div className="card cite__card">
        <p className="cite__ref">
          {CITATION_AUTHORS} <em>{CITATION_JOURNAL}</em>
          {CITATION_TAIL}
        </p>
        <pre className="cite__bib">{BIBTEX}</pre>
      </div>
      <CitedBy />
    </section>
  );
}

const CITED_PREVIEW = 6;

/** Papers that cite this work: a card grid, one line each on how they use the map. */
function CitedBy() {
  const { t, lang } = useLang();
  const [all, setAll] = useState(false);
  const shown = all ? CITED_BY : CITED_BY.slice(0, CITED_PREVIEW);
  return (
    <div className="cited" id="citations">
      <div className="cited__head">
        <h3 className="cited__title">{t.citedTitle}</h3>
        <span className="cited__count">{t.citedCount.replace('{n}', CITED_BY.length)}</span>
      </div>
      <ul className="cited__grid">
        {shown.map((p) => (
          <li key={p.doi || p.url}>
            <a className="cited__card" href={p.url || `https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
              <span className="cited__meta">
                {p.who} {p.year} · <em>{p.journal}</em>
              </span>
              <span className="cited__paper">{p.title}</span>
              <span className="cited__use">{p.use[lang] || p.use.en}</span>
            </a>
          </li>
        ))}
      </ul>
      {CITED_BY.length > CITED_PREVIEW && (
        <button type="button" className="cited__more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? t.citedLess : t.citedAll.replace('{n}', CITED_BY.length)}
        </button>
      )}
    </div>
  );
}

/** One resource row: an external link (`href`), a file of the site to save (`download`) or a button opening a reading modal (`open`). */
function ResourceItem({ item }) {
  const { openModal } = useTools();
  const body = (
    <>
      <span className="res-item__main">
        <span className="res-item__name">{item.name}</span>
        <span className="res-item__fmt">{item.fmt}</span>
      </span>
      <span className="res-item__meta">
        {item.size ? `${item.size} · ` : ''}
        {item.open ? '→' : item.download ? '↓' : '↗'}
      </span>
    </>
  );
  return (
    <li>
      {item.open ? (
        <button type="button" className="res-item res-item--link" onClick={() => openModal(item.open)}>
          {body}
        </button>
      ) : item.download ? (
        <a className="res-item res-item--link" href={`${import.meta.env.BASE_URL}${item.download}`} download>
          {body}
        </a>
      ) : (
        <a className="res-item res-item--link" href={item.href} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      )}
    </li>
  );
}

/** Section 08, a full-width band: data downloads (incl. the reddening packages), documentation and the figure gallery. */
export function ResourcesBand() {
  const { t } = useLang();
  return (
    <div id="resources" className="resources">
      <div className="resources__inner">
        <div className="resources__kicker-row">
          <span className="resources__kicker">08 · {t.resKicker}</span>
          <span className="resources__rule" />
        </div>
        <h3 className="resources__title">{t.resTitle}</h3>
        <div className="resources__grid">
          {t.resources.map((r) => (
            <div key={r.title} className="res-card">
              <div className="res-card__head">
                <div className="res-card__title">{r.title}</div>
              </div>
              <p className="res-card__desc">{r.desc}</p>
              <ul className="res-card__items">
                {r.items.map((item) => (
                  <ResourceItem key={item.name} item={item} />
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="resources__note">{t.resNote}</div>
      </div>
    </div>
  );
}

/** Section 09 + footer. */
export function ContactAndFooter() {
  const { t } = useLang();
  return (
    <div className="container">
      <section id="contact" className="contact">
        <div className="kicker">09 · {t.contactTitle}</div>
        <h2 className="contact__title">{t.contactTitle}</h2>
        <div className="contact__list">
          {t.contacts.map((c) => (
            <a key={c.email} href={`mailto:${c.email}`} className="contact__chip">
              <span className="contact__who">
                <span className="contact__name">{c.name}</span>
                {c.role && <span className="contact__role">{c.role}</span>}
              </span>
              <span className="contact__email">{c.email}</span>
            </a>
          ))}
        </div>
      </section>
      <footer className="footer">
        <span>{t.footer}</span>
      </footer>
    </div>
  );
}
