import { useEffect, useRef, useState } from "react";
import { DEFAULT_AOI, USE_MOCK } from "./api/config";
import { useAoiData } from "./api/useAoiData";
import { getHealth } from "./api/client";
import { initialSelection } from "./api/selection";
import Card from "./ui/Card";
import Footer from "./ui/Footer";
import AoiMap from "./components/AoiMap";
import CoordinateForm from "./components/CoordinateForm";
import AnomalyCard from "./components/AnomalyCard";
import StatusBadge from "./components/StatusBadge";
import ErrorBanner from "./components/ErrorBanner";
import WorkspaceTools from "./components/WorkspaceTools";
import HistoryView from "./components/views/HistoryView";
import MethodView from "./components/views/MethodView";
import ExportView from "./components/views/ExportView";

import { areaLabel, AREA_PRESETS } from "./api/areas";
import { useSectionNavigation } from "./ui/useSectionNavigation";

const now = new Date();
const CURRENT_MONTH = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

export default function App() {
  const [initial] = useState(() =>
    initialSelection(
      window.location.search,
      CURRENT_MONTH,
      window.location.hash,
    ),
  );
  const [aoi, setAoi] = useState(initial.aoi);
  const [mapExpanded, setMapExpanded] = useState(false);
  const areaToggle = useRef(null);
  const areaEditor = useRef(null);
  const monthInput = useRef(null);
  const viewTitle = useRef(null);
  const navigation = useSectionNavigation();
  const previousView = useRef(navigation.active);
  const [range, setRange] = useState(initial.range);
  const [month, setMonth] = useState(initial.month);
  const [palette, setPalette] = useState(initial.palette);
  const [revision, setRevision] = useState(0);
  const [availability, setAvailability] = useState(null);
  const [selectionWarning, setSelectionWarning] = useState(
    initial.selectionWarning,
  );
  useEffect(() => {
    if (!mapExpanded) return;
    areaEditor.current?.querySelector("button")?.focus({ preventScroll: true });
    areaEditor.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [mapExpanded]);
  useEffect(() => {
    if (previousView.current === navigation.active) return;
    previousView.current = navigation.active;
    const target =
      navigation.active === "explore" ? monthInput.current : viewTitle.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: "auto", block: "center" });
  }, [navigation.active]);
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
    navigation.select("explore");
    document.getElementById("explore")?.scrollIntoView({ behavior: "auto" });
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
  const restoreSelection = (selection) => {
    changeArea(selection.aoi);
    setRange(selection.range);
    setMonth(selection.month);
    setPalette(selection.palette);
    navigation.select(selection.view);
  };
  const loading = Object.values(d).some((state) => state.loading);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="header">
        <a
          className="brand"
          href="#explore"
          aria-label="Ala-Too Fire Atlas"
          onClick={(event) => {
            event.preventDefault();
            navigation.select("explore");
          }}
        >
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
          {[
            ["explore", "Map"],
            ["calendar", "History"],
            ["method", "Method"],
            ["export", "Export"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={navigation.active === id ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigation.select(id);
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main className="main" id="main" tabIndex={-1}>
        {navigation.active !== "explore" && (
          <h1 className="view-title" ref={viewTitle} tabIndex={-1}>
            {navigation.active === "calendar"
              ? "History"
              : navigation.active === "method"
                ? "Method"
                : "Export"}
          </h1>
        )}
        <ErrorBanner
          states={d}
          onRetry={() => setRevision((value) => value + 1)}
        />
        {selectionWarning && (
          <div className="selection-warning" role="status">
            <p>{selectionWarning}</p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setSelectionWarning(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        {USE_MOCK && (
          <p className="demo-notice">
            Fixture preview. The sample area is fixed; period filters work, but
            drawings do not change these example measurements.
          </p>
        )}

        <div
          className="workspace"
          id="explore"
          hidden={navigation.active !== "explore"}
        >
          <aside className="selection-panel" aria-label="Area and month">
            <div className="selection-panel__title">
              {navigation.active === "explore" && <h1>Fire activity</h1>}
              <p>Kyrgyzstan & neighbouring regions</p>
            </div>
            <label className="area-picker">
              <span>Area</span>
              <select
                value={areaLabel(aoi)}
                onChange={(event) => {
                  const preset = AREA_PRESETS.find(
                    (item) => item.name === event.target.value,
                  );
                  if (preset)
                    changeArea({ kind: "bbox", bbox: [...preset.bbox] });
                  else if (event.target.value === "Regional archive")
                    changeArea(DEFAULT_AOI);
                }}
              >
                <option value="Regional archive">Regional archive</option>
                {AREA_PRESETS.map((preset) => (
                  <option key={preset.name}>{preset.name}</option>
                ))}
                {![
                  "Regional archive",
                  ...AREA_PRESETS.map((preset) => preset.name),
                ].includes(areaLabel(aoi)) && <option>{areaLabel(aoi)}</option>}
              </select>
            </label>
            <div className="area-actions">
              <button
                ref={areaToggle}
                type="button"
                className="btn btn--ghost map-panel__toggle"
                aria-expanded={mapExpanded}
                aria-controls="area-editor"
                onClick={() => setMapExpanded((value) => !value)}
              >
                {mapExpanded ? "Close map" : "Edit on map"}
              </button>
              <details className="precision-controls">
                <summary>Coordinates</summary>
                <CoordinateForm aoi={aoi} onChange={changeArea} />
              </details>
            </div>
            <label className="month-picker">
              <span>Month</span>
              <input
                ref={monthInput}
                type="month"
                value={month}
                min={range.from}
                max={range.to}
                onChange={changeMonth}
              />
            </label>
            <Card
              title="Month assessment"
              hideTitle
              className="assessment__result"
              state={d.anomaly}
            >
              {d.anomaly.data && <AnomalyCard data={d.anomaly.data} />}
            </Card>
            <button
              type="button"
              className="history-link"
              onClick={() => navigation.select("calendar")}
            >
              View history <span aria-hidden="true">→</span>
            </button>
            <WorkspaceTools
              aoi={aoi}
              range={range}
              month={month}
              palette={palette}
              view={navigation.active}
              onRestore={restoreSelection}
            />
          </aside>
          <section
            className="map-panel"
            data-expanded={mapExpanded}
            aria-labelledby="area-title"
          >
            <h2 id="area-title" className="visually-hidden">
              {areaLabel(aoi)}
            </h2>
            <div className="map-panel__body" id="area-editor" ref={areaEditor}>
              <AoiMap
                aoi={aoi}
                onChange={changeArea}
                active={navigation.active === "explore"}
              />
            </div>
            <p className="map-caption">
              Area selection · hotspots are summarized, not plotted
            </p>
          </section>
        </div>

        <HistoryView
          active={navigation.active === "calendar"}
          aoi={aoi}
          range={range}
          month={month}
          palette={palette}
          palettes={palettes}
          states={d}
          availability={availability}
          currentMonth={CURRENT_MONTH}
          onRangeChange={changeRange}
          onPaletteChange={setPalette}
          onMonthSelect={compareMonth}
        />
        <MethodView active={navigation.active === "method"} states={d} />
        <ExportView
          active={navigation.active === "export"}
          aoi={aoi}
          range={range}
          month={month}
          states={d}
        />
      </main>
      <div className="source-line">
        <StatusBadge meta={meta} loading={loading} />
        {availability?.last_month && (
          <span>
            {availability.first_month} — {availability.last_month}
          </span>
        )}
      </div>
      <Footer
        firstMonth={availability?.first_month}
        lastMonth={availability?.last_month}
      />
    </div>
  );
}
