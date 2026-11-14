import { fmt } from '../ui/format';

const DIR = {
  above: { icon: '\u25B2', text: 'above normal', color: 'var(--above)' },
  below: { icon: '\u25BC', text: 'below normal', color: 'var(--below)' },
  normal: { icon: '\u25CF', text: 'within normal range', color: 'var(--normal)' },
};

// Built here instead of using data.label, so the UI language never depends on the backend text.
const headline = (data, d) =>
  data.direction === 'normal' ? d.text : `${Math.abs(data.robust_z).toFixed(1)}\u03C3 ${d.text}`;

function Bars({ series }) {
  const max = Math.max(...series.map((p) => p.count), 1);
  const w = 6, gap = 2, h = 40;
  return (
    <svg className="spark" viewBox={`0 0 ${series.length * (w + gap)} ${h}`} role="img"
      aria-label="The same month across years; the last bar is the current year">
      {series.map((p, i) => {
        const bh = Math.max(1, (p.count / max) * h);
        return <rect key={p.year} x={i * (w + gap)} y={h - bh} width={w} height={bh}
          fill={i === series.length - 1 ? 'var(--accent)' : 'var(--muted)'}><title>{`${p.year}: ${fmt(p.count)}`}</title></rect>;
      })}
    </svg>
  );
}

/** data = response of /aoi/anomaly */
export default function AnomalyCard({ data }) {
  const d = DIR[data.direction] || DIR.normal;
  const b = data.baseline;
  return (
    <div className="anomaly">
      <p className="anomaly__label" style={{ color: d.color }}><span aria-hidden="true">{d.icon}</span> {headline(data, d)}</p>
      <p className="anomaly__big">{fmt(data.observed)} <small>hotspot-days, {data.month}</small></p>
      <dl className="stats">
        <div><dt>Median over the years</dt><dd>{fmt(b.median)}</dd></div>
        <div><dt>Robust sigma</dt><dd>{b.robust_sigma}</dd></div>
        <div><dt>z-score</dt><dd>{data.robust_z}</dd></div>
        <div><dt>Years not higher</dt><dd>{Math.round(data.percentile * 100)}%</dd></div>
      </dl>
      {data.partial && <p className="note">Incomplete month: compared month-to-date, through day {data.through_day} ({b.window}). Data may still grow.</p>}
      <Bars series={data.series} />
    </div>
  );
}
