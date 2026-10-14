import { useEffect, useRef, useState } from 'react';
import { useInView, useReveal } from '../hooks/motion.js';
import { useLang } from '../i18n/LangContext.jsx';
import { useTools } from '../state/ToolsContext.jsx';
import { demoBus } from './galaxy/demoBus.js';
import SectionHeader from './SectionHeader.jsx';
import SkillPrompt from './ui/SkillPrompt.jsx';
import './FeatureCards.css';

const canHover = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);

// touch screens have no hover, so the two demos take turns: two lock-ons, then one batch
// sweep, each cut just before its loop would start over (periods in demoBus.js)
const TURNS = [
  { kind: 'query', ms: 7400 },
  { kind: 'batch', ms: 4800 },
];

/** One full-width hairline row that opens a tool; hovering it plays its demo in the galaxy. */
function FeatureRow({ kind, title, onOpen, enter, playing }) {
  return (
    <button
      type="button"
      className={`feature-row${playing ? ' is-playing' : ''}`}
      onClick={onOpen}
      onPointerEnter={(e) => e.pointerType !== 'touch' && demoBus.set(kind)}
      onPointerLeave={() => demoBus.clear(kind)}
      onFocus={(e) => e.currentTarget.matches(':focus-visible') && demoBus.set(kind)}
      onBlur={() => demoBus.clear(kind)}
    >
      <span className="feature-row__title">{title}</span>
      <span className="feature-row__enter">
        <span className="feature-row__enter-label">{enter}</span>
        <span className="feature-row__arrow" aria-hidden="true">
          →
        </span>
      </span>
    </button>
  );
}

export default function FeatureCards() {
  const { t } = useLang();
  const { openModal } = useTools();
  const reveal = useReveal();
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, '0px');
  const [hover] = useState(canHover);
  const [playing, setPlaying] = useState(demoBus.mode);

  useEffect(() => demoBus.subscribe(setPlaying), []);

  useEffect(() => {
    if (hover || !inView) return undefined;
    let i = 0;
    let timer = 0;
    const next = () => {
      const turn = TURNS[i++ % TURNS.length];
      demoBus.set(turn.kind);
      timer = setTimeout(next, turn.ms);
    };
    next();
    return () => {
      clearTimeout(timer);
      demoBus.set(null);
    };
  }, [hover, inView]);

  return (
    <section ref={sectionRef} id="features" className="features">
      <SectionHeader kicker="01" title={t.sec1Title} sub={t.sec1Sub} />
      <div ref={reveal} className="features__list">
        <FeatureRow
          kind="query"
          title={t.queryTitle}
          enter={t.featEnter}
          playing={playing === 'query'}
          onOpen={() => openModal('query')}
        />
        <FeatureRow
          kind="batch"
          title={t.batchTitle}
          enter={t.featEnter}
          playing={playing === 'batch'}
          onOpen={() => openModal('batch')}
        />
      </div>
      <SkillPrompt which={0} className="skill-prompt--cta" />
    </section>
  );
}
