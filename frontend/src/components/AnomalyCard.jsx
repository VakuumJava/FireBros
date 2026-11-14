import { fmt } from "../ui/format";
import "./insights.css";

const STATUS = {
  above: "above normal",
  below: "below normal",
  normal: "within normal range",
};

function headline(data) {
  if (data.baseline.robust_sigma === 0) {
    if (data.observed === data.baseline.median)
      return "Equal to a constant historical baseline";
    return `${data.observed > data.baseline.median ? "Above" : "Below"} a constant historical baseline; standardized score unavailable`;
  }
  if (!Number.isFinite(data.robust_z))
    return "Insufficient baseline for a standardized anomaly";
  return data.direction === "normal"
    ? STATUS.normal
    : `${Math.abs(data.robust_z).toFixed(1)}σ ${STATUS[data.direction] || STATUS.normal}`;
}

function ordinal(value) {
  const rounded = Math.round(value);
  const suffix =
    rounded % 100 >= 11 && rounded % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[rounded % 10] || "th";
  return `${rounded}${suffix}`;
}

function History({ series, year }) {
  if (!series.length) return null;
  const maximum = Math.max(...series.map((point) => point.count), 1);
  const step = 12;
  return (
    <div className="atlas-history">
      <div className="atlas-history__caption">
        <span>The same month across years</span>
        <span>Selected year highlighted</span>
      </div>
      <svg
        width="100%"
        height="60"
        viewBox={`0 0 ${series.length * step} 88`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Monthly historical counts; ${year} is highlighted`}
      >
        {series.map((point, index) => (
          <rect
            key={point.year}
            x={index * step + 1}
            y={80 - (72 * point.count) / maximum}
            width="8"
            height={(72 * point.count) / maximum}
            className={
              point.year === year
                ? "atlas-history__selected"
                : "atlas-history__bar"
            }
          >
            <title>{`${point.year}: ${fmt(point.count)} hotspot-days`}</title>
          </rect>
        ))}
        <line
          x1="0"
          y1="81"
          x2={series.length * step}
          y2="81"
          className="atlas-history__axis"
        />
      </svg>
      <div className="atlas-history__years">
        <span>{series[0].year}</span>
        <span>{series.at(-1).year}</span>
      </div>
    </div>
  );
}

export default function AnomalyCard({ data }) {
  const baseline = data.baseline;
  const percentile = Number.isFinite(data.percentile)
    ? Math.min(100, Math.max(0, data.percentile * 100))
    : null;
  return (
    <div className={`atlas-anomaly atlas-anomaly--${data.direction}`}>
      <div className="atlas-anomaly__reading">
        <strong>{fmt(data.observed)}</strong>
        <span>hotspot-days</span>
      </div>
      <p className="atlas-anomaly__verdict">{headline(data)}</p>
      <dl className="atlas-baseline">
        <div>
          <dt>Historical median</dt>
          <dd>{fmt(baseline.median)}</dd>
        </div>
        <div>
          <dt>Robust sigma</dt>
          <dd>{fmt(baseline.robust_sigma)}</dd>
        </div>
        <div>
          <dt>Baseline years</dt>
          <dd>{fmt(baseline.n_years)}</dd>
        </div>
        <div>
          <dt>Standardized score</dt>
          <dd>
            {baseline.robust_sigma === 0 ? "Unavailable" : fmt(data.robust_z)}
          </dd>
        </div>
      </dl>
      <div className="atlas-percentile">
        <div className="atlas-percentile__heading">
          <span>Position in the historical record</span>
          <strong>
            {percentile === null
              ? "Unavailable"
              : `${ordinal(percentile)} percentile`}
          </strong>
        </div>
        <div
          className="atlas-percentile__track"
          role="img"
          aria-label={
            percentile === null
              ? "Historical percentile unavailable"
              : `${Math.round(percentile)} percent of baseline years had no higher count`
          }
        >
          {percentile !== null && (
            <span
              className="atlas-percentile__marker"
              style={{ left: `${percentile}%` }}
            />
          )}
        </div>
        <div className="atlas-percentile__scale">
          <span>Lowest</span>
          <span>Median</span>
          <span>Highest</span>
        </div>
      </div>
      <History series={data.series} year={Number(data.month.slice(0, 4))} />
      <p
        className={`atlas-window ${data.partial ? "atlas-window--partial" : ""}`}
      >
        {data.partial
          ? `Incomplete month: compared month-to-date through day ${data.through_day}. `
          : "Comparison window: "}
        {baseline.window}.{data.partial ? " Source data may still grow." : ""}
      </p>
    </div>
  );
}
