import { useEffect, useId, useMemo, useRef, useState } from "react";
import { colorAt, rgbAt, textOn, gradientCss } from "../ui/palettes";
import { MONTHS_SHORT, MONTHS_FULL, fmt, fmtCompact, pad2 } from "../ui/format";
import "./calendar.css";

export default function CalendarHeatmap({
  data,
  palette = "viridis",
  nrtMonths = [],
  selectedMonth,
  onSelect,
  compact = false,
  active = true,
}) {
  const { years, values, max, unit } = data;
  const nrt = useMemo(() => new Set(nrtMonths), [nrtMonths]);
  const selectedYear = Number(selectedMonth?.slice(0, 4));
  const selectedColumn = Number(selectedMonth?.slice(5, 7)) - 1;
  const selectedRow = years.indexOf(selectedYear);
  const selected =
    selectedRow >= 0 && selectedColumn >= 0 && selectedColumn < 12
      ? { r: selectedRow, c: selectedColumn }
      : null;
  const cells = useRef({});
  const viewport = useRef(null);
  const helpId = useId();
  const viewportId = useId();
  const [focus, setFocus] = useState(
    selected || { r: Math.max(0, years.length - 1), c: 0 },
  );
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null);
  const [showValues, setShowValues] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const revealCell = (cell, center = false) => {
    const container = viewport.current;
    if (!container || !cell?.getBoundingClientRect) return;
    const frame = container.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    const top = rect.top - frame.top;
    const bottom = rect.bottom - frame.top;
    if (center) {
      container.scrollTop += top - (container.clientHeight - rect.height) / 2;
    } else if (top < 40) {
      container.scrollTop += top - 40;
    } else if (bottom > container.clientHeight) {
      container.scrollTop += bottom - container.clientHeight;
    }
    const left = rect.left - frame.left;
    const right = rect.right - frame.left;
    if (left < 48) container.scrollLeft += left - 48;
    else if (right > container.clientWidth)
      container.scrollLeft += right - container.clientWidth;
  };

  useEffect(() => {
    if (
      active &&
      selectedRow >= 0 &&
      selectedColumn >= 0 &&
      selectedColumn < 12
    )
      revealCell(cells.current[`${selectedRow}-${selectedColumn}`], true);
  }, [active, selectedMonth, selectedRow, selectedColumn, expanded]);

  const fr = Math.min(focus.r, years.length - 1);
  const preview = hovered || focused;
  const describe = (cell) => {
    if (!cell || !years[cell.r] || !values[cell.r]) return null;
    const value = values[cell.r][cell.c];
    const key = `${years[cell.r]}-${pad2(cell.c + 1)}`;
    return {
      date: `${MONTHS_FULL[cell.c]} ${years[cell.r]}`,
      value: value == null ? "No data" : `${fmt(value)} hotspot-days`,
      partial: nrt.has(key),
    };
  };
  const selectedDetail = describe(selected);
  const previewDetail = describe(preview);

  const move = (r, c) => {
    const nr = Math.max(0, Math.min(years.length - 1, r));
    const nc = Math.max(0, Math.min(11, c));
    setFocus({ r: nr, c: nc });
    const cell = cells.current[`${nr}-${nc}`];
    cell?.focus({ preventScroll: true });
    revealCell(cell);
  };
  const select = (r, c) => {
    if (values[r][c] != null) {
      setFocus({ r, c });
      onSelect?.(`${years[r]}-${pad2(c + 1)}`);
    }
  };
  const onKey = (e, r, c) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(r, c);
      return;
    }
    const delta = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    }[e.key];
    if (delta) {
      e.preventDefault();
      move(r + delta[0], c + delta[1]);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      move(r, e.key === "Home" ? 0 : 11);
    }
  };

  return (
    <div
      className={`cal${compact ? " cal--compact" : ""}${showValues ? " cal--values" : ""}${expanded ? " cal--expanded" : ""}`}
    >
      <div className="cal__toolbar">
        <div className="cal__selection" aria-live="polite" aria-atomic="true">
          <span className="cal__eyebrow">Selected month</span>
          {selectedDetail ? (
            <p className="cal__selected-value">
              <strong>{selectedDetail.date}</strong>
              <span>{selectedDetail.value}</span>
              {selectedDetail.partial && (
                <span className="cal__partial-label">Partial coverage</span>
              )}
              {values[selected.r][selected.c] != null && (
                <a className="cal__assessment-link" href="#explore">
                  View month assessment ↑
                </a>
              )}
            </p>
          ) : (
            <p className="cal__selected-value">
              {years.length
                ? "Choose a month to compare with history"
                : "No observed months in this selection"}
            </p>
          )}
        </div>
        <button
          className="cal__values-toggle"
          type="button"
          aria-pressed={showValues}
          onClick={() => setShowValues((shown) => !shown)}
          disabled={!years.length}
        >
          <svg
            viewBox="0 0 18 18"
            width="18"
            height="18"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M3 5h12M3 9h12M3 13h12M7 3v12M11 3v12" />
          </svg>
          {showValues ? "Hide values" : "Show values"}
        </button>
      </div>
      <div className="cal__guide">
        <p id={helpId}>
          Select a month · Arrow keys to move · Enter to compare
        </p>
        <p className="cal__readout">
          {previewDetail ? (
            <>
              <strong>{previewDetail.date}</strong> · {previewDetail.value}
              {previewDetail.partial ? " · Partial coverage" : ""}
            </>
          ) : (
            <span>{years.length} years in this view</span>
          )}
        </p>
      </div>
      <div
        ref={viewport}
        id={viewportId}
        className="cal__scroll"
        role="region"
        aria-label="Monthly activity grid; scroll to explore all years and months"
      >
        <div
          className="cal__grid"
          role="grid"
          aria-label={`Activity calendar, ${unit}`}
          aria-describedby={helpId}
          aria-rowcount={years.length + 1}
          aria-colcount={13}
        >
          <div className="cal__row cal__row--head" role="row">
            <span className="cal__colhead" role="columnheader">
              Year
            </span>
            {MONTHS_SHORT.map((month, column) => (
              <span
                key={month}
                role="columnheader"
                className={`cal__colhead${selected && selected.c === column ? " is-selected" : ""}`}
              >
                {month}
              </span>
            ))}
          </div>
          {years.map((year, r) => (
            <div
              className={`cal__row${r > 0 && year % 10 === 0 ? " cal__row--decade" : ""}`}
              role="row"
              key={year}
            >
              <span
                role="rowheader"
                className={`cal__rowhead${selected && selected.r === r ? " is-selected" : ""}`}
              >
                {year}
              </span>
              {values[r].map((value, c) => {
                const key = `${year}-${pad2(c + 1)}`;
                const isNrt = nrt.has(key);
                const rgb =
                  value === null
                    ? null
                    : rgbAt(palette, max > 0 ? value / max : 0);
                return (
                  <button
                    type="button"
                    key={c}
                    role="gridcell"
                    ref={(node) => {
                      cells.current[`${r}-${c}`] = node;
                    }}
                    tabIndex={r === fr && c === focus.c ? 0 : -1}
                    className={`cal__cell${value === null ? " cal__cell--null" : ""}${isNrt ? " cal__cell--nrt" : ""}`}
                    style={
                      rgb
                        ? {
                            background: `rgb(${rgb.join(",")})`,
                            color: textOn(rgb),
                          }
                        : undefined
                    }
                    aria-selected={selectedMonth === key}
                    aria-disabled={value === null}
                    aria-label={`${year}, ${MONTHS_FULL[c]}: ${value === null ? "no data" : `${fmt(value)} hotspot-days`}${isNrt ? ", partial source coverage" : ""}`}
                    onClick={() => select(r, c)}
                    onKeyDown={(event) => onKey(event, r, c)}
                    onFocus={() => {
                      setFocus({ r, c });
                      setFocused({ r, c });
                    }}
                    onBlur={() => setFocused(null)}
                    onMouseEnter={() => setHovered({ r, c })}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {value === null ? null : (
                      <span className="cal__value" aria-hidden="true">
                        {fmtCompact(value)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {years.length > 8 && (
        <div className="cal__archive-controls">
          <p>
            {years[0]}–{years.at(-1)} · {years.length} years
            {expanded ? "" : " · scroll to explore"}
          </p>
          <button
            type="button"
            className="cal__archive-toggle"
            aria-expanded={expanded}
            aria-controls={viewportId}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Collapse archive" : "Show full archive"}
          </button>
        </div>
      )}
      <div className="legend cal__legend">
        <div className="legend__scale">
          <p className="legend__cap">
            {unit === "hotspot_days_1km" ? "Hotspot-days, 1 km" : unit}
          </p>
          <span
            className="legend__bar"
            style={{ background: gradientCss(palette) }}
          />
          <div className="legend__ticks">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <span key={t}>{fmt(Math.round(max * t))}</span>
            ))}
          </div>
        </div>
        <div className="legend__keys">
          <span className="legend__key">
            <span
              className="cal__cell cal__cell--null legend__swatch"
              aria-hidden="true"
            />
            no data (not zero)
          </span>
          <span className="legend__key">
            <span
              className="cal__cell cal__cell--nrt legend__swatch"
              style={{ background: colorAt(palette, 0.5) }}
              aria-hidden="true"
            />
            partial source coverage
          </span>
        </div>
      </div>
    </div>
  );
}
