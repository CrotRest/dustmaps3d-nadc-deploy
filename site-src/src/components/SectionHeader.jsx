import { useReveal } from '../hooks/motion.js';

export default function SectionHeader({ kicker, title, sub }) {
  const reveal = useReveal();
  return (
    <div ref={reveal} className="section-head">
      <div className="kicker">{kicker}</div>
      <h2 className="section-title">{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
    </div>
  );
}
