import { fmt } from '../ui/format';

const DIR = {
  above: { icon: '▲', text: 'выше нормы', color: 'var(--above)' },
  below: { icon: '▼', text: 'ниже нормы', color: 'var(--below)' },
  normal: { icon: '●', text: 'в пределах нормы', color: 'var(--normal)' },
};

function Bars({ series }) {
  const max = Math.max(...series.map((p) => p.count), 1);
  const w = 6, gap = 2, h = 40;
  return (
    <svg className="spark" viewBox={`0 0 ${series.length * (w + gap)} ${h}`} role="img"
      aria-label="Тот же месяц по годам; последний столбец — текущий год">
      {series.map((p, i) => {
        const bh = Math.max(1, (p.count / max) * h);
        return <rect key={p.year} x={i * (w + gap)} y={h - bh} width={w} height={bh}
          fill={i === series.length - 1 ? 'var(--accent)' : 'var(--muted)'}><title>{`${p.year}: ${fmt(p.count)}`}</title></rect>;
      })}
    </svg>
  );
}

/** data = ответ /aoi/anomaly */
export default function AnomalyCard({ data }) {
  const d = DIR[data.direction] || DIR.normal;
  const b = data.baseline;
  return (
    <div className="anomaly">
      <p className="anomaly__label" style={{ color: d.color }}><span aria-hidden="true">{d.icon}</span> {data.label}</p>
      <p className="anomaly__big">{fmt(data.observed)} <small>хотспот-дней, {data.month}</small></p>
      <dl className="stats">
        <div><dt>Медиана за годы</dt><dd>{fmt(b.median)}</dd></div>
        <div><dt>Робастная σ</dt><dd>{b.robust_sigma}</dd></div>
        <div><dt>z-оценка</dt><dd>{data.robust_z}</dd></div>
        <div><dt>Лет не выше</dt><dd>{Math.round(data.percentile * 100)}%</dd></div>
      </dl>
      {data.partial && <p className="note">Месяц неполный: сравнение «месяц-к-дате», до {data.through_day}-го числа ({b.window}). Данные могут дорасти.</p>}
      <Bars series={data.series} />
    </div>
  );
}
