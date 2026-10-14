import { useTools } from '../../state/ToolsContext.jsx';

// Inline markup used by the reference pages (i18n/reference.js):
// [label](url) · [label](#open:modal) · `code` · **bold** · x_{sub} · x^{sup}
const TOKEN = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|_\{([^}]+)\}|\^\{([^}]+)\}/g;

/** Split `text` into React nodes; exported for tests. */
export function parseRich(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[1] != null) out.push({ type: 'link', text: m[1], href: m[2] });
    else if (m[3] != null) out.push({ type: 'code', text: m[3] });
    else if (m[4] != null) out.push({ type: 'bold', text: m[4] });
    else if (m[5] != null) out.push({ type: 'sub', text: m[5] });
    else out.push({ type: 'sup', text: m[6] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

export default function RichText({ text }) {
  const { openModal } = useTools();
  return parseRich(text).map((n, i) => {
    switch (n.type) {
      case 'link':
        if (n.href.startsWith('#open:')) {
          return (
            <button key={i} type="button" className="rich-link" onClick={() => openModal(n.href.slice(6))}>
              {n.text}
            </button>
          );
        }
        return n.href.startsWith('mailto:') ? (
          <a key={i} className="rich-link" href={n.href}>
            {n.text}
          </a>
        ) : (
          <a key={i} className="rich-link" href={n.href} target="_blank" rel="noopener noreferrer">
            {n.text}
          </a>
        );
      case 'code':
        return (
          <code key={i} className="rich-code">
            {n.text}
          </code>
        );
      case 'bold':
        return <strong key={i}>{n.text}</strong>;
      case 'sub':
        return <sub key={i}>{n.text}</sub>;
      case 'sup':
        return <sup key={i}>{n.text}</sup>;
      default:
        return n.text;
    }
  });
}
