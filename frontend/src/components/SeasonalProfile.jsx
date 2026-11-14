import { useId, useMemo } from "react";
import { buildSeasonalProfile } from "../analysis/seasonality";
import { fmt, fmtCompact, MONTHS_SHORT, MONTHS_FULL, pad2 } from "../ui/format";
import "./seasonal.css";

export default function SeasonalProfile({
  data,
  selectedMonth,
  nrtMonths = [],
  onSelect,
}) {
  const titleId = useId();
  const selectedYear = Number(selectedMonth?.slice(0, 4));
  const profile = useMemo(
    () => buildSeasonalProfile(data, { selectedYear, nrtMonths }),
    [data, selectedYear, nrtMonths],
  );
  const plotted = profile.months;
  const y = (value) => 168 - (value / profile.maximum) * 156;
  return (
    <section className="seasonal" aria-labelledby={titleId}>
      <div className="seasonal__heading">
        <div>
          <h2 id={titleId}>Seasonal pattern</h2>
          <p>{selectedYear} against other years in the selected period</p>
        </div>
        <ul className="seasonal__legend" aria-label="Seasonal chart legend">
          <li>
            <span
              className="seasonal__key seasonal__key--median"
              aria-hidden="true"
            />
            Historical median
          </li>
          <li>
            <span
              className="seasonal__key seasonal__key--range"
              aria-hidden="true"
            />
            Middle 50%
          </li>
          <li>
            <span
              className="seasonal__key seasonal__key--selected"
              aria-hidden="true"
            />
            {selectedYear}
          </li>
        </ul>
      </div>
      {!profile.hasBaseline && (
        <p className="seasonal__notice">
          Choose a wider period to compare at least three complete years per
          month.
        </p>
      )}
      <div
        className="seasonal__plot"
        role="region"
        aria-label="Seasonal comparison chart"
        tabIndex={0}
      >
        <div className="seasonal__scale" aria-hidden="true">
          <span>{fmtCompact(profile.maximum)}</span>
          <span>0</span>
        </div>
        <div className="seasonal__chart">
          <svg
            width="600"
            height="180"
            viewBox="0 0 600 180"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Seasonal hotspot-days: historical median, middle 50 percent, and complete months in ${selectedYear}. Exact values follow in the table.`}
          >
            {[0, 0.5, 1].map((fraction) => (
              <line
                key={fraction}
                x1="0"
                x2="600"
                y1={y(profile.maximum * fraction)}
                y2={y(profile.maximum * fraction)}
                className="seasonal__grid"
              />
            ))}
            {plotted.map((point, index) => {
              const x = index * 50 + 25;
              return (
                <g key={point.month}>
                  {point.median !== null && (
                    <>
                      <line
                        x1={x}
                        x2={x}
                        y1={y(point.q3)}
                        y2={y(point.q1)}
                        className="seasonal__range"
                      />
                      <line
                        x1={x - 10}
                        x2={x + 10}
                        y1={y(point.median)}
                        y2={y(point.median)}
                        className="seasonal__median"
                      />
                    </>
                  )}
                  {point.selected !== null && !point.selectedPartial && (
                    <circle
                      cx={x}
                      cy={y(point.selected)}
                      r="4"
                      className="seasonal__selected"
                    />
                  )}
                </g>
              );
            })}
          </svg>
          <div className="seasonal__months">
            {plotted.map((point) =>
              onSelect ? (
                <button
                  key={point.month}
                  type="button"
                  onClick={() =>
                    onSelect(`${selectedYear}-${pad2(point.month)}`)
                  }
                  disabled={point.selected === null}
                  aria-label={`Compare ${MONTHS_FULL[point.month - 1]} ${selectedYear}${point.selectedPartial ? ", incomplete month" : ""}`}
                >
                  {MONTHS_SHORT[point.month - 1]}
                </button>
              ) : (
                <span key={point.month}>{MONTHS_SHORT[point.month - 1]}</span>
              ),
            )}
          </div>
        </div>
      </div>
      <p className="seasonal__footnote">
        Hotspot-days. Incomplete months and {selectedYear} are excluded from the
        baseline. Incomplete selected months are omitted from the chart.
      </p>
      <details className="seasonal__details">
        <summary>Monthly values</summary>
        <div className="seasonal__table-wrap">
          <table>
            <caption>
              Seasonal comparison in hotspot-days; at least {profile.minYears}{" "}
              complete baseline years per month
            </caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">{selectedYear}</th>
                <th scope="col">Median</th>
                <th scope="col">Middle 50%</th>
                <th scope="col">Years</th>
              </tr>
            </thead>
            <tbody>
              {plotted.map((point) => (
                <tr key={point.month}>
                  <th scope="row">{MONTHS_SHORT[point.month - 1]}</th>
                  <td>
                    {point.selected === null
                      ? "No data"
                      : `${point.selectedPartial ? "Partial: " : ""}${fmt(point.selected)}`}
                  </td>
                  <td>
                    {point.median === null
                      ? "Insufficient years"
                      : fmt(point.median)}
                  </td>
                  <td>
                    {point.median === null
                      ? "—"
                      : `${fmt(point.q1)}–${fmt(point.q3)}`}
                  </td>
                  <td>{point.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
