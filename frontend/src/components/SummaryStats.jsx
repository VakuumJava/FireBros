import { fmt, MONTHS_FULL } from '../ui/format';

export default function SummaryStats({ data }) {
  const { aoi, totals, coverage } = data;
  return (
    <dl className="stats">
      <div><dt>AOI area</dt><dd>{fmt(Math.round(aoi.area_km2))} km2</dd></div>
      <div><dt>Cell coverage</dt><dd>{Math.round(aoi.coverage_fraction * 100)}%</dd></div>
      <div><dt>Total hotspot-days</dt><dd>{fmt(totals.hotspot_days)}</dd></div>
      <div><dt>Peak</dt><dd>{totals.peak_year}, {MONTHS_FULL[totals.peak_month - 1]}</dd></div>
      <div><dt>Monthly mean</dt><dd>{fmt(totals.mean_month)}</dd></div>
      {coverage.gaps.length > 0 && <div className="stats__warn"><dt>Data gaps</dt><dd>{coverage.gaps.join(', ')}</dd></div>}
      {coverage.nrt_months.length > 0 && <div className="stats__warn"><dt>NRT (may still grow)</dt><dd>{coverage.nrt_months.join(', ')}</dd></div>}
    </dl>
  );
}
