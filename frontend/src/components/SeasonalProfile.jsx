import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildSeasonalProfile } from "../analysis/seasonality";
import { makeSeasonalChart } from "../analysis/seasonalChart";
import { fmt, fmtCompact, MONTHS_SHORT, MONTHS_FULL, pad2 } from "../ui/format";
import "./seasonal.css";

export default function SeasonalProfile({
  data,
  selectedMonth,
  nrtMonths = [],
  onSelect,
}) {
  const titleId = useId();
  const noteId = useId();
  const container = useRef(null);
  const [width, setWidth] = useState(840);
  const [inspected, setInspected] = useState(
    Number(selectedMonth?.slice(5, 7)) - 1,
  );
  const [hovered, setHovered] = useState(null);
  const selectedYear = Number(selectedMonth?.slice(0, 4));
  const profile = useMemo(
    () => buildSeasonalProfile(data, { selectedYear, nrtMonths }),
    [data, selectedYear, nrtMonths],
  );
  const chart = useMemo(
    () => makeSeasonalChart(profile.months, width, width < 600 ? 250 : 300),
    [profile, width],
  );
  const activeIndex = Math.max(0, Math.min(11, hovered ?? inspected));
  const point = profile.months[activeIndex];
  const activeX = chart.x(activeIndex);
  const activeMonth = `${selectedYear}-${pad2(point.month)}`;

  useEffect(() => {
    setInspected(Number(selectedMonth?.slice(5, 7)) - 1);
    setHovered(null);
  }, [selectedMonth, data]);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const resize = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0)
        setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, []);

  const inspectPointer = (event, persist = false) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * chart.width;
    const index = Math.round(((x - chart.plot.left) / chart.plot.width) * 11);
    const next = Math.max(0, Math.min(11, index));
    setHovered(next);
    if (persist) setInspected(next);
  };

  return (
    <section className="seasonal" aria-labelledby={titleId}>
      <div className="seasonal__heading">
        <div>
          <h2 id={titleId}>Seasonal pattern</h2>
          <p>Monthly activity in {selectedYear} and the historical baseline</p>
        </div>
        <ul className="seasonal__legend" aria-label="Seasonal chart legend">
          <li>
            <span
              className="seasonal__key seasonal__key--selected"
              aria-hidden="true"
            />
            {selectedYear}
          </li>
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
        </ul>
      </div>
      {!profile.hasBaseline && (
        <p className="seasonal__notice">
          Choose a wider period for at least three complete baseline years per
          month.
        </p>
      )}
      <div className="seasonal__plot" ref={container}>
        <span className="seasonal__unit">Hotspot-days</span>
        <svg
          width={chart.width}
          height={chart.height}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label={`Monthly activity in ${selectedYear}, historical median and middle 50 percent. Select a month below for exact values.`}
          aria-describedby={noteId}
          onPointerMove={(event) => inspectPointer(event)}
          onPointerDown={(event) => inspectPointer(event, true)}
          onPointerLeave={() => setHovered(null)}
        >
          {chart.ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={chart.plot.left}
                x2={chart.plot.right}
                y1={tick.y}
                y2={tick.y}
                className="seasonal__grid"
              />
              <text
                x={chart.plot.left - 12}
                y={tick.y}
                dy="0.35em"
                textAnchor="end"
                className="seasonal__axis"
              >
                {fmtCompact(tick.value)}
              </text>
            </g>
          ))}
          <path d={chart.bandPath} className="seasonal__band" />
          <path d={chart.medianPath} className="seasonal__median" />
          <path d={chart.selectedPath} className="seasonal__line" />
          <line
            x1={activeX}
            x2={activeX}
            y1={chart.plot.top}
            y2={chart.plot.bottom}
            className="seasonal__cursor"
          />
          {profile.months.map((month, index) => (
            <g key={month.month}>
              {month.median !== null &&
                profile.months[index - 1]?.median == null &&
                profile.months[index + 1]?.median == null && (
                  <line
                    x1={chart.x(index) - 5}
                    x2={chart.x(index) + 5}
                    y1={chart.y(month.median)}
                    y2={chart.y(month.median)}
                    className="seasonal__median"
                  />
                )}
              {month.selected !== null && !month.selectedPartial && (
                <circle
                  cx={chart.x(index)}
                  cy={chart.y(month.selected)}
                  r={index === activeIndex ? 5 : 3}
                  className="seasonal__point"
                >
                  <title>
                    {MONTHS_FULL[index]} {selectedYear}: {fmt(month.selected)}{" "}
                    hotspot-days
                  </title>
                </circle>
              )}
              {(width >= 520 || index % 2 === 0) && (
                <text
                  x={chart.x(index)}
                  y={chart.plot.bottom + 26}
                  textAnchor="middle"
                  className="seasonal__axis"
                >
                  {MONTHS_SHORT[index]}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="seasonal__inspection">
        <label className="seasonal__month">
          <span className="visually-hidden">Inspect month</span>
          <select
            value={activeIndex}
            onChange={(event) => {
              setInspected(Number(event.target.value));
              setHovered(null);
            }}
          >
            {MONTHS_FULL.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <dl className="seasonal__values">
          <div>
            <dt>{selectedYear}</dt>
            <dd>
              {point.selected === null
                ? "No data"
                : point.selectedPartial
                  ? `${fmt(point.selected)} · partial`
                  : fmt(point.selected)}
            </dd>
          </div>
          <div>
            <dt>Median</dt>
            <dd>
              {point.median === null ? "Insufficient years" : fmt(point.median)}
            </dd>
          </div>
          <div>
            <dt>Middle 50%</dt>
            <dd>
              {point.median === null
                ? "Unavailable"
                : `${fmt(point.q1)}–${fmt(point.q3)}`}
            </dd>
          </div>
        </dl>
        {onSelect && (
          <button
            type="button"
            className="seasonal__compare"
            disabled={point.selected === null}
            onClick={() => onSelect(activeMonth)}
          >
            Compare month <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
      <p className="seasonal__footnote" id={noteId}>
        Baseline excludes {selectedYear} and incomplete months. Gaps in the line
        mean no complete observation.
      </p>
      <details className="seasonal__details">
        <summary>Monthly values</summary>
        <div className="seasonal__table-wrap">
          <table>
            <caption>
              Hotspot-days; at least {profile.minYears} complete baseline years
              per month
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
              {profile.months.map((month) => (
                <tr key={month.month}>
                  <th scope="row">{MONTHS_SHORT[month.month - 1]}</th>
                  <td>
                    {month.selected === null
                      ? "No data"
                      : `${month.selectedPartial ? "Partial: " : ""}${fmt(month.selected)}`}
                  </td>
                  <td>
                    {month.median === null
                      ? "Insufficient years"
                      : fmt(month.median)}
                  </td>
                  <td>
                    {month.median === null
                      ? "—"
                      : `${fmt(month.q1)}–${fmt(month.q3)}`}
                  </td>
                  <td>{month.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
