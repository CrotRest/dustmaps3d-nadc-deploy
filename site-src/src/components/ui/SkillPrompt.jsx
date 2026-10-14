import { useCopy } from '../../hooks/useCopy.js';
import { useLang } from '../../i18n/LangContext.jsx';
import { skillPrompt } from '../../lib/skills.js';
import './SkillPrompt.css';

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.5 3.5v-.8c0-.7-.5-1.2-1.2-1.2H3.2c-.7 0-1.2.5-1.2 1.2v6.1c0 .7.5 1.2 1.2 1.2h.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** One-line ghost code box with a copy icon: copies the prompt that has an AI install a skill from GitHub. */
export default function SkillPrompt({ which, className = '' }) {
  const { t } = useLang();
  const [copied, copy] = useCopy();
  const { full, short } = skillPrompt(t, which);
  return (
    <div className={`skill-prompt ${className}`}>
      <code className="skill-prompt__text" title={full}>
        <span className="skill-prompt__caret" aria-hidden="true">
          ›
        </span>
        {short}
      </code>
      <button type="button" className={`skill-prompt__copy${copied ? ' is-done' : ''}`} aria-label={t.skillCopy} title={copied ? t.copied : t.skillCopy} onClick={() => copy(full)}>
        {copied ? '✓' : <CopyIcon />}
      </button>
    </div>
  );
}
