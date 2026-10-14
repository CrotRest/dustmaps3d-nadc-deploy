import { useCallback, useEffect, useRef, useState } from 'react';

async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for http:// previews and older browsers.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

/** Copy text and expose a short-lived "copied" flag for the button label. */
export function useCopy(duration = 1400) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(
    async (text) => {
      try {
        await writeClipboard(text);
      } catch {
        // Clipboard can be blocked (permissions, iframes); still give feedback like the design.
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), duration);
    },
    [duration],
  );
  return [copied, copy];
}
