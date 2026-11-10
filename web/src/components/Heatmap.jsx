// GitHub-style contribution graph built from XP earned per day.
export default function Heatmap({ days }) {
  const map = new Map(days.map((d) => [d.day, Number(d.points)]));
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 7 * 26 - start.getDay()); // 26 weeks, aligned to Sunday
  const cells = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toLocaleDateString('en-CA');
    cells.push({ key, v: map.get(key) || 0, label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) });
  }
  const level = (v) => (v === 0 ? 0 : v < 10 ? 1 : v < 30 ? 2 : v < 60 ? 3 : 4);
  const total = cells.reduce((a, c) => a + c.v, 0);
  return (
    <figure className="heatmap">
      <div className="heatmap-grid">
        {cells.map((c) => <span key={c.key} className={`hm hm-${level(c.v)}`} title={`${c.label}: ${c.v} XP`} />)}
      </div>
      <figcaption>{total} XP earned in the last 6 months</figcaption>
    </figure>
  );
}
