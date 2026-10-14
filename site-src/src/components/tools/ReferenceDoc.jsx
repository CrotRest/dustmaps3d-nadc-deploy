import CopyButton from '../ui/CopyButton.jsx';
import RichText from '../ui/RichText.jsx';
import './reference.css';

/** Render reference-page blocks (format documented in i18n/reference.js). */
export default function ReferenceDoc({ blocks, renderToolbox }) {
  return (
    <div className="ref-doc">
      {blocks.map((block, i) => {
        const [type, a, b] = block;
        switch (type) {
          case 'h2':
            return (
              <h3 key={i} className="ref-doc__h2">
                <RichText text={a} />
              </h3>
            );
          case 'h3':
            return (
              <h4 key={i} className="ref-doc__h3">
                <RichText text={a} />
              </h4>
            );
          case 'p':
            return (
              <p key={i} className="ref-doc__p">
                <RichText text={a} />
              </p>
            );
          case 'note':
            return (
              <div key={i} className="ref-doc__note">
                {b && <div className="ref-doc__note-title">{b}</div>}
                <RichText text={a} />
              </div>
            );
          case 'formula':
            return (
              <div key={i} className="ref-doc__formula">
                <RichText text={a} />
              </div>
            );
          case 'code':
            return (
              <div key={i} className="ref-doc__code">
                <CopyButton className="ref-doc__copy btn-chip" getText={() => a} />
                <pre>{a}</pre>
              </div>
            );
          case 'ul':
          case 'ol': {
            const List = type;
            return (
              <List key={i} className="ref-doc__list">
                {a.map((item) => (
                  <li key={item}>
                    <RichText text={item} />
                  </li>
                ))}
              </List>
            );
          }
          case 'table':
            return (
              <div key={i} className="ref-doc__table-wrap">
                <table className="ref-doc__table">
                  <thead>
                    <tr>
                      {a.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.map((row) => (
                      <tr key={row[0]}>
                        {row.map((c, j) => (
                          <td key={j}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'toolbox':
            return <div key={i}>{renderToolbox?.(a)}</div>;
          default:
            return null;
        }
      })}
    </div>
  );
}
