/** Pill-style segmented control (single choice). */
export default function Segmented({ options, value, onChange, className = '', label }) {
  return (
    <div className={`seg ${className}`} role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className={`seg__btn${on ? ' is-on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
