import { useEffect, useState } from "react";
import { fmt, MONTHS_FULL } from "../ui/format";
import "./insights.css";

export default function TopPeriods({ data, onSelect }) {
  const [kind, setKind] = useState("months");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [data, kind]);
  const periods = data[kind];
  const maximum = Math.max(...periods.map((period) => period.count), 1);
  const shown = expanded ? periods : periods.slice(0, 5);

  return (
    <div className="atlas-ranking">
      <div
        className="atlas-ranking__tabs"
        role="group"
        aria-label="Rank periods by"
      >
        <button
          type="button"
          aria-pressed={kind === "months"}
          onClick={() => setKind("months")}
        >
          Months
        </button>
        <button
          type="button"
          aria-pressed={kind === "years"}
          onClick={() => setKind("years")}
        >
          Years
        </button>
      </div>
      {!periods.length && (
        <p className="atlas-message">No observed {kind} in this selection.</p>
      )}
      <ol
        className="atlas-ranking__list"
        aria-label={`Highest activity ${kind}`}
      >
        {shown.map((period) => {
          const label =
            kind === "months"
              ? `${MONTHS_FULL[period.month - 1]} ${period.year}`
              : String(period.year);
          const content = (
            <>
              <span className="atlas-ranking__rank" aria-hidden="true">
                {period.rank}
              </span>
              <span className="atlas-ranking__period">
                {label}
                <span className="atlas-ranking__track" aria-hidden="true">
                  <span
                    style={{ width: `${(period.count / maximum) * 100}%` }}
                  />
                </span>
              </span>
              <strong>{fmt(period.count)}</strong>
            </>
          );
          return (
            <li key={`${period.year}-${period.month || 0}`}>
              {kind === "months" && onSelect ? (
                <button
                  type="button"
                  className="atlas-ranking__row"
                  onClick={() =>
                    onSelect(
                      `${period.year}-${String(period.month).padStart(2, "0")}`,
                    )
                  }
                  aria-label={`Compare ${label}: ${fmt(period.count)} hotspot-days`}
                >
                  {content}
                </button>
              ) : (
                <div className="atlas-ranking__row">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      {periods.length > 5 && (
        <button
          type="button"
          className="atlas-text-button atlas-ranking__more"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show first five" : `Show all ${periods.length} ${kind}`}
        </button>
      )}
      {!!periods.length && (
        <p className="atlas-ranking__unit">
          Hotspot-days · selected area and date range
        </p>
      )}
    </div>
  );
}
