import { useCopy } from '../../hooks/useCopy.js';
import { useLang } from '../../i18n/LangContext.jsx';

/** Button whose label flips to "Copied ✓" for a moment after copying `getText()`. */
export default function CopyButton({ getText, className }) {
  const { t } = useLang();
  const [copied, copy] = useCopy();
  return (
    <button type="button" className={className} onClick={() => copy(getText())}>
      {copied ? t.copied : t.copy}
    </button>
  );
}
