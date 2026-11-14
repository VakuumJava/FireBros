import { useEffect, useRef, useState } from "react";
import { DEFAULT_AOI, USE_MOCK } from "./api/config";
import { useAoiData } from "./api/useAoiData";
import { getHealth } from "./api/client";
import { initialSelection } from "./api/selection";
import Card from "./ui/Card";
import Footer from "./ui/Footer";
import AoiMap from "./components/AoiMap";
import CoordinateForm from "./components/CoordinateForm";
import PeriodSelect from "./components/PeriodSelect";
import CalendarHeatmap from "./components/CalendarHeatmap";
import PaletteSwitch from "./components/PaletteSwitch";
import AnomalyCard from "./components/AnomalyCard";
import TopPeriods from "./components/TopPeriods";
import HarmonizationChart from "./components/HarmonizationChart";
import SummaryStats from "./components/SummaryStats";
import ExportPanel from "./components/ExportPanel";
import StatusBadge from "./components/StatusBadge";
import ErrorBanner from "./components/ErrorBanner";
import { fmt } from "./ui/format";
import { areaLabel } from "./api/areas";

const now = new Date();
const CURRENT_MONTH = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

export default function App() {
  const [aoi, setAoi] = useState(DEFAULT_AOI);
  const [mapExpanded, setMapExpanded] = useState(false);
  const areaToggle = useRef(null);
  const [initial] = useState(() =>
    initialSelection(window.location.search, CURRENT_MONTH),
  );
  const [range, setRange] = useState(initial.range);
  const [month, setMonth] = useState(initial.month);
  const [palette, setPalette] = useState("viridis");
  const [revision, setRevision] = useState(0);
  const [availability, setAvailability] = useState(null);
  useEffect(() => {
    if (USE_MOCK) return;
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((health) => {
        if (controller.signal.aborted) return;
        setAvailability(health);
        if (
          /^\d{4}-\d{2}$/.test(health.last_month) &&
          health.last_month <= CURRENT_MONTH &&
          !initial.explicitRange
        ) {
          setRange((previous) =>
            previous.to === CURRENT_MONTH
              ? { from: previous.from, to: health.last_month }
              : previous,
          );
          setMonth((previous) =>
            previous === CURRENT_MONTH ? health.last_month : previous,
          );
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const d = useAoiData(aoi, range, month, revision);
  const meta = Object.values(d).find((state) => state.data?.meta)?.data.meta;
  const palettes = d.calendar.data?.palettes || ["viridis", "cividis"];
  const changeRange = (next) => {
    setRange(next);
    setMonth((value) =>
      value < next.from || value > next.to ? next.to : value,
    );
  };
  const compareMonth = (value) => {
    setMonth(value);
    document.getElementById("explore")?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  const changeArea = (next) => {
    setAoi(next);
    if (mapExpanded) areaToggle.current?.focus();
    setMapExpanded(false);
  };
  const changeMonth = (event) => {
    const value = event.target.value;
    if (value >= range.from && value <= range.to) setMonth(value);
  };
  const loading = Object.values(d).some((state) => state.loading);

  return (
    <div className="app">
      <a className="skip-link" href="#explore">
        Skip to fire activity
      </a>
      <header className="header">
        <a className="brand" href="#explore" aria-label="Ala-Too Fire Atlas">
          <svg
            className="brand__mark"
            width="30"
            height="30"
            viewBox="0 0 34 34"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M3 27 13 7l6 12 4-7 8 15H3Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="m9 16 4 3 4-3M19 20l4 3 4-3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <span>
            Ala-Too <strong>Fire Atlas</strong>
          </span>
        </a>
        <nav className="header__nav" aria-label="Main navigation">
          <a href="#explore">Explore</a>
          <a href="#calendar">History</a>
          <a href="#method">Method</a>
          <a href="#export">Export</a>
        </nav>
      </header>
      <main className="main" id="explore" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <h1>Fire activity in context</h1>
            <p>Kyrgyzstan and neighbouring regions · MODIS / VIIRS</p>
          </div>
          <div className="archive-status">
            <span>
              {availability?.first_month || "2000"} —{" "}
              {availability?.last_month || "present"}
            </span>
            <StatusBadge meta={meta} loading={loading} />
          </div>
        </div>
        <ErrorBanner
          states={d}
          onRetry={() => setRevision((value) => value + 1)}
        />
        {USE_MOCK && (
          <p className="demo-notice">
            Fixture preview. The sample area is fixed; period filters work, but
            drawings do not change these example measurements.
          </p>
        )}

        <div className="workspace">
          <section
            className="map-panel"
            data-expanded={mapExpanded}
            aria-labelledby="area-title"
          >
            <div className="map-panel__heading">
              <div>
                <span className="field-label">Selected area</span>
                <h2 id="area-title">{areaLabel(aoi)}</h2>
              </div>
              <button
                ref={areaToggle}
                type="button"
                className="btn btn--ghost map-panel__toggle"
                aria-expanded={mapExpanded}
                aria-controls="area-editor"
                onClick={() => setMapExpanded((value) => !value)}
              >
                {mapExpanded ? "Done" : "Change area"}
              </button>
              <span className="map-panel__area">
                {d.summary.data
                  ? `${fmt(Math.round(d.summary.data.aoi.area_km2))} km²`
                  : "Area selection"}
              </span>
            </div>
            <div className="map-panel__body" id="area-editor">
              <AoiMap aoi={aoi} onChange={changeArea} />
              <details className="precision-controls">
                <summary>
                  Coordinate bounds <span aria-hidden="true">+</span>
                </summary>
                <CoordinateForm aoi={aoi} onChange={changeArea} />
              </details>
            </div>
          </section>
          <section
            className="assessment"
            aria-label="Selected month assessment"
          >
            <div className="assessment__heading">
              <div>
                <span className="field-label">Monthly comparison</span>
                <h2>Against the historical record</h2>
              </div>
              <label className="month-picker">
                <span className="visually-hidden">Compare month</span>
                <input
                  type="month"
                  value={month}
                  min={range.from}
                  max={range.to}
                  onChange={changeMonth}
                />
              </label>
            </div>
            <Card
              title="Selected month"
              hideTitle
              className="assessment__result"
              state={d.anomaly}
            >
              {d.anomaly.data && <AnomalyCard data={d.anomaly.data} />}
            </Card>
            <p className="assessment__footnote">
              A hotspot is a satellite thermal anomaly, not a confirmed
              wildfire.
            </p>
          </section>
        </div>

        <section
          className="history"
          id="calendar"
          aria-labelledby="history-title"
        >
          <div className="section-heading">
            <div>
              <h2 id="history-title">Activity history</h2>
              <p>Monthly hotspot-days on the MODIS reference scale</p>
            </div>
            <PaletteSwitch
              palettes={palettes}
              value={palette}
              onChange={setPalette}
            />
          </div>
          <div className="history__controls">
            <PeriodSelect
              range={range}
              currentMonth={availability?.last_month || CURRENT_MONTH}
              onChange={changeRange}
            />
            <p>Choose a month in the calendar to update the comparison.</p>
          </div>
          <div className="history__grid">
            <Card
              title="Activity calendar"
              hideTitle
              className="calendar-panel"
              state={d.calendar}
            >
              {d.calendar.data && (
                <CalendarHeatmap
                  data={d.calendar.data}
                  palette={palette}
                  nrtMonths={d.summary.data?.coverage.nrt_months}
                  selectedMonth={month}
                  onSelect={setMonth}
                />
              )}
            </Card>
            <Card
              title="Most active periods"
              className="ranking-panel"
              hint="Within this area and date range"
              state={d.top}
            >
              {d.top.data && (
                <TopPeriods data={d.top.data} onSelect={compareMonth} />
              )}
            </Card>
          </div>
        </section>

        <section className="method" id="method" aria-labelledby="method-title">
          <div className="section-heading">
            <div>
              <h2 id="method-title">Sensor calibration</h2>
              <p>VIIRS is calibrated against overlapping MODIS observations.</p>
            </div>
          </div>
          <Card
            title="Sensor comparison"
            hideTitle
            className="method__chart"
            state={d.harmonization}
          >
            {d.harmonization.data && (
              <HarmonizationChart data={d.harmonization.data} />
            )}
          </Card>
        </section>

        <section
          className="export-section"
          id="export"
          aria-labelledby="export-title"
        >
          <div className="section-heading">
            <div>
              <h2 id="export-title">Export this selection</h2>
              <p>
                {areaLabel(aoi)} · {range.from} — {range.to}
              </p>
            </div>
          </div>
          <div className="export-section__grid">
            <Card
              title="Selection summary"
              state={d.summary}
              className="summary-panel"
            >
              {d.summary.data && <SummaryStats data={d.summary.data} />}
            </Card>
            <Card title="CSV download" className="export-panel">
              <ExportPanel aoi={aoi} range={range} source={meta?.source} />
            </Card>
          </div>
        </section>
      </main>
      <Footer
        firstMonth={availability?.first_month}
        lastMonth={availability?.last_month}
      />
    </div>
  );
}
