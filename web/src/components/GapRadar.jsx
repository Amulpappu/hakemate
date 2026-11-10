// Team Gap Radar: one spoke per skill category. Filled area = how many
// teammates cover it; orange dots = categories the team still needs.
export default function GapRadar({ rows, size = 300 }) {
  const n = rows.length;
  const cx = size / 2, cy = size / 2, R = size / 2 - 46;
  const max = Math.max(2, ...rows.map((r) => r.members));
  const pt = (i, v) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
  };
  const poly = rows.map((r, i) => pt(i, 0.08 + 0.92 * (r.members / max)).join(',')).join(' ');
  return (
    <svg viewBox={`-50 0 ${size + 100} ${size}`} className="radar" role="img"
      aria-label={rows.map((r) => `${r.category}: ${r.members} member${r.members === 1 ? '' : 's'}${r.needed && !r.members ? ', still needed' : ''}`).join('; ')}>
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} className="radar-ring" points={rows.map((_, i) => pt(i, k).join(',')).join(' ')} />
      ))}
      {rows.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar-spoke" />; })}
      <polygon points={poly} className="radar-area" />
      {rows.map((r, i) => {
        const [x, y] = pt(i, 1.2);
        const missing = r.needed && r.members === 0;
        return (
          <g key={r.category}>
            {missing && (() => { const [dx, dy] = pt(i, 1); return <circle cx={dx} cy={dy} r={6} className="radar-need" />; })()}
            <text x={x} y={y} textAnchor={x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle'} dominantBaseline="middle"
              className={missing ? 'radar-label need' : 'radar-label'}>{r.category}</text>
          </g>
        );
      })}
    </svg>
  );
}
