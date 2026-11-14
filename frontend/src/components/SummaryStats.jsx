import { fmt, MONTHS_FULL } from "../ui/format";
import "./insights.css";

export default function SummaryStats({ data }) {
  const { aoi, totals, coverage } = data;
  const peak =
    totals.peak_year == null
      ? "No observations"
      : `${MONTHS_FULL[totals.peak_month - 1]} ${totals.peak_year}`;
  return (
    <div className="atlas-summary">
      <dl className="atlas-summary__facts">
        <div>
          <dt>AOI area</dt>
          <dd>
            {fmt(Math.round(aoi.area_km2))}
            <span>km²</span>
          </dd>
        </div>
        <div>
          <dt>Selected cells within bounds</dt>
          <dd>
            {Math.round(aoi.coverage_fraction * 100)}
            <span>%</span>
          </dd>
        </div>
        <div>
          <dt>Total hotspot-days</dt>
          <dd>{fmt(totals.hotspot_days)}</dd>
        </div>
        <div>
          <dt>Monthly mean</dt>
          <dd>{fmt(totals.mean_month)}</dd>
        </div>
      </dl>
      <p className="atlas-summary__peak">
        <span>Most active month</span>
        <strong>{peak}</strong>
      </p>
      {(coverage.gaps.length > 0 || coverage.nrt_months.length > 0) && (
        <details className="atlas-summary__coverage">
          <summary>
            Coverage notes
            {coverage.gaps.length ? ` · ${coverage.gaps.length} gaps` : ""}
            {coverage.nrt_months.length
              ? ` · ${coverage.nrt_months.length} partial months`
              : ""}
          </summary>
          {coverage.gaps.length > 0 && (
            <p>
              <strong>Missing months</strong>
              <span>{coverage.gaps.join(", ")}</span>
            </p>
          )}
          {coverage.nrt_months.length > 0 && (
            <p>
              <strong>Partial source coverage</strong>
              <span>{coverage.nrt_months.join(", ")}</span>
            </p>
          )}
        </details>
      )}
    </div>
  );
}
