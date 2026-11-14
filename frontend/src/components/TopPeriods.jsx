import { fmt, MONTHS_RU_FULL } from '../ui/format';

/** data = ответ /aoi/top */
export default function TopPeriods({ data }) {
  const max = Math.max(...data.months.map((m) => m.count), 1);
  return (
    <div className="top">
      <h3 className="top__h">Месяцы</h3>
      <ol className="top__list">
        {data.months.map((m) => (
          <li key={m.rank}>
            <span>{MONTHS_RU_FULL[m.month - 1]} {m.year}</span>
            <span className="top__bar" style={{ width: `${(m.count / max) * 100}%` }} aria-hidden="true" />
            <b>{fmt(m.count)}</b>
          </li>
        ))}
      </ol>
      <h3 className="top__h">Годы</h3>
      <ol className="top__list">
        {data.years.map((y) => <li key={y.rank}><span>{y.year}</span><b>{fmt(y.count)}</b></li>)}
      </ol>
    </div>
  );
}
