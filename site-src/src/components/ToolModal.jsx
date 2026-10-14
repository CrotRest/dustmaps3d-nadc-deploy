import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../i18n/LangContext.jsx';
import { useTools } from '../state/ToolsContext.jsx';
import QueryTool from './tools/QueryTool.jsx';
import PlotTool from './tools/PlotTool.jsx';
import BatchTool from './tools/BatchTool.jsx';
import BubbleTool from './tools/BubbleTool.jsx';
import UtilitiesTool from './tools/UtilitiesTool.jsx';
import ReddeningPanel from './tools/ReddeningPanel.jsx';
import DocsPanel from './tools/DocsPanel.jsx';
import GalleryPanel from './tools/GalleryPanel.jsx';
import './ToolModal.css';

const TOOLS = {
  query: QueryTool,
  plot: PlotTool,
  batch: BatchTool,
  bcp: BubbleTool,
  tools: UtilitiesTool,
  reddening: ReddeningPanel,
  docs: DocsPanel,
  gallery: GalleryPanel,
};
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The tool's how-to, shown as a popover under the header's 「使用说明」 button. */
function HowTo({ doc, id }) {
  const { t } = useLang();
  return (
    <div id={id} className="howto" role="region" aria-label={t.docHeading}>
      <div className="howto__heading">{t.docHeading}</div>
      <p className="howto__intro">{doc.intro}</p>
      <ol className="howto__steps">
        {doc.steps.map(([title, desc], i) => (
          <li key={title}>
            <span className="howto__n">{i + 1}</span>
            <div className="howto__text">
              <strong>{title}</strong> — {desc}
            </div>
          </li>
        ))}
      </ol>
      {doc.caveats.length > 0 && (
        <div className="howto__caveats">
          <div className="howto__caveat-heading">{t.caveatHeading}</div>
          <ul>
            {doc.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ToolModal() {
  const { t, docs } = useLang();
  const { state, closeModal } = useTools();
  const { modal } = state;
  const open = modal != null;
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const pressedOnOverlay = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(false);
  helpOpenRef.current = helpOpen;

  // Scroll lock, Escape, focus handling — once per open/close cycle.
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        // the how-to popover closes first, then the tool
        if (helpOpenRef.current) setHelpOpen(false);
        else closeModal();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, closeModal]);

  // A tool handing off to another (e.g. sky map → query) starts at the top, how-to closed.
  useEffect(() => {
    if (overlayRef.current) overlayRef.current.scrollTop = 0;
    setHelpOpen(false);
  }, [modal]);

  if (!open) return null;
  const Tool = TOOLS[modal];
  const title = {
    query: t.queryTitle,
    plot: t.plotTitle,
    batch: t.batchTitle,
    bcp: t.bcpTitle,
    tools: t.toolsTitle,
    reddening: t.redTitle,
    docs: t.docsTitle,
    gallery: t.galleryTitle,
  }[modal];
  const doc = docs[modal];

  return createPortal(
    <div
      ref={overlayRef}
      className="modal-overlay"
      onMouseDown={(e) => {
        pressedOnOverlay.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedOnOverlay.current && e.target === e.currentTarget) closeModal();
      }}
    >
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}>
        <div className="modal__header">
          <div className="modal__heading">
            <span className="modal__dot" aria-hidden="true" />
            <h2 id="modal-title" className="modal__title">
              {title}
            </h2>
          </div>
          <div className="modal__actions">
            {doc && (
              <button
                type="button"
                className={`modal__help${helpOpen ? ' is-open' : ''}`}
                aria-expanded={helpOpen}
                aria-controls="modal-howto"
                onClick={() => setHelpOpen((v) => !v)}
              >
                {t.docToggle}
                <span className="modal__help-icon" aria-hidden="true">
                  ?
                </span>
              </button>
            )}
            <button type="button" className="modal__close" aria-label={t.close} onClick={closeModal}>
              ×
            </button>
          </div>
        </div>
        {doc && helpOpen && (
          <>
            <div className="howto-scrim" onClick={() => setHelpOpen(false)} aria-hidden="true" />
            <HowTo doc={doc} id="modal-howto" />
          </>
        )}
        <div className={`modal__body modal__body--${modal}`}>
          <Tool />
        </div>
      </div>
    </div>,
    document.body,
  );
}
