import { fmt, MONTHS_RU_FULL } from '../ui/format';

export default function SummaryStats({ data }) {
  const { aoi, totals, coverage } = data;
  return (
    <dl className="stats">
      <div><dt>Площадь AOI</dt><dd>{fmt(Math.round(aoi.area_km2))} км²</dd></div>
      <div><dt>Покрытие ячеек</dt><dd>{Math.round(aoi.coverage_fraction * 100)}%</dd></div>
      <div><dt>Всего хотспот-дней</dt><dd>{fmt(totals.hotspot_days)}</dd></div>
      <div><dt>Пик</dt><dd>{totals.peak_year}, {MONTHS_RU_FULL[totals.peak_month - 1]}</dd></div>
      <div><dt>Среднее за месяц</dt><dd>{fmt(totals.mean_month)}</dd></div>
      {coverage.gaps.length > 0 && <div className="stats__warn"><dt>Пробелы в данных</dt><dd>{coverage.gaps.join(', ')}</dd></div>}
      {coverage.nrt_months.length > 0 && <div className="stats__warn"><dt>NRT (могут дорасти)</dt><dd>{coverage.nrt_months.join(', ')}</dd></div>}
    </dl>
  );
}
