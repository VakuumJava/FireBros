import React, { useState } from "react";
import "./legacy-shell.css";
import { PALETTE_NAMES } from "./palettes.js";
import { DataSourceBadge } from "./DataSourceBadge.jsx";
import { AttributionFooter } from "./AttributionFooter.jsx";
import { LimitationsView } from "./LimitationsView.jsx";

function SlotPlaceholder({ slotName, description }) {
  return (
    <div className="alatoo-slot-placeholder" data-slot={slotName}>
      <span className="alatoo-slot-placeholder__name">{slotName}</span>
      <p className="alatoo-slot-placeholder__desc">{description}</p>
    </div>
  );
}

/**
 * Main accessible page shell for Ala-Too Fire Calendar (Team Stellar Baatyr).
 * Provides header controls, four named layout slots for P4 visualization modules,
 * mandatory NASA FIRMS attribution footer, and the 6-point Limitations modal.
 */
export function AppShell({
  palette = "viridis",
  onPaletteChange,
  onExportCsv,
  exportDisabled = false,
  exportLoading = false,
  dataSource = "mock",
  unit = "hotspot_days_1km",
  methodVersion = "harmonize-v1",
  mapSlot = null,
  anomalyCardSlot = null,
  calendarSlot = null,
  validationChartSlot = null,
  isLimitationsOpen,
  onOpenLimitations,
  onCloseLimitations,
}) {
  const [internalLimitsOpen, setInternalLimitsOpen] = useState(false);

  const limitsOpen =
    typeof isLimitationsOpen === "boolean"
      ? isLimitationsOpen
      : internalLimitsOpen;

  const handleOpenLimits = () => {
    if (onOpenLimitations) {
      onOpenLimitations();
    } else {
      setInternalLimitsOpen(true);
    }
  };

  const handleCloseLimits = () => {
    if (onCloseLimitations) {
      onCloseLimitations();
    } else {
      setInternalLimitsOpen(false);
    }
  };

  const activePalette = PALETTE_NAMES.includes(palette) ? palette : "viridis";

  return (
    <div className="alatoo-shell">
      <header className="alatoo-header">
        <div className="alatoo-header__inner">
          <div className="alatoo-brand">
            <div className="alatoo-brand__title-row">
              <h1 className="alatoo-brand__title">Ala-Too Fire Calendar</h1>
              <span
                className="alatoo-unit-chip"
                title="Canonical measurement unit"
              >
                {unit}
              </span>
              <DataSourceBadge source={dataSource} />
            </div>
            <p className="alatoo-brand__subtitle">
              Team Stellar Baatyr &middot; Harmonized MODIS/VIIRS Fire Activity
              (2000&ndash;2026) &middot; bbox [68.5, 38.4, 80.7, 43.7]
            </p>
          </div>

          <div className="alatoo-header__controls">
            <div
              className="alatoo-segmented"
              role="group"
              aria-label="Heatmap colorblind-safe palette"
            >
              {PALETTE_NAMES.map((name) => {
                const isSelected = activePalette === name;
                const label = name === "viridis" ? "Viridis" : "Cividis";
                return (
                  <button
                    key={name}
                    type="button"
                    className="alatoo-segmented__btn"
                    aria-pressed={isSelected}
                    onClick={() => onPaletteChange && onPaletteChange(name)}
                  >
                    <span className="alatoo-swatch" aria-hidden="true">
                      <span
                        className={`alatoo-swatch__stop alatoo-swatch--${name}-0`}
                      />
                      <span
                        className={`alatoo-swatch__stop alatoo-swatch--${name}-1`}
                      />
                      <span
                        className={`alatoo-swatch__stop alatoo-swatch--${name}-2`}
                      />
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="alatoo-btn alatoo-btn--secondary"
              onClick={handleOpenLimits}
            >
              Limitations (6)
            </button>

            <button
              type="button"
              className="alatoo-btn alatoo-btn--primary"
              onClick={onExportCsv}
              disabled={exportDisabled || exportLoading || !onExportCsv}
            >
              {exportLoading ? "Exporting CSV..." : "Export CSV"}
            </button>
          </div>
        </div>
      </header>

      <main className="alatoo-main">
        <div className="alatoo-grid">
          <section
            className="alatoo-panel alatoo-panel--map"
            aria-labelledby="panel-title-map"
          >
            <div className="alatoo-panel__header">
              <h2 id="panel-title-map" className="alatoo-panel__title">
                Area of Interest (AOI)
              </h2>
              <span className="alatoo-panel__meta">
                EPSG:4326 &middot; 0.25&deg; grid
              </span>
            </div>
            <div className="alatoo-panel__body">
              {mapSlot || (
                <SlotPlaceholder
                  slotName="mapSlot"
                  description="Interactive Leaflet map with AOI polygon/bbox selector and manual lat/lon bounds."
                />
              )}
            </div>
          </section>

          <section
            className="alatoo-panel alatoo-panel--anomaly"
            aria-labelledby="panel-title-anomaly"
          >
            <div className="alatoo-panel__header">
              <h2 id="panel-title-anomaly" className="alatoo-panel__title">
                Current Month Anomaly &amp; Top Periods
              </h2>
              <span className="alatoo-panel__meta">
                Month-to-date (MAD &sigma;)
              </span>
            </div>
            <div className="alatoo-panel__body">
              {anomalyCardSlot || (
                <SlotPlaceholder
                  slotName="anomalyCardSlot"
                  description="Robust median/MAD anomaly card, percentile rank, and top fire months/years."
                />
              )}
            </div>
          </section>

          <section
            className="alatoo-panel alatoo-panel--calendar"
            aria-labelledby="panel-title-calendar"
          >
            <div className="alatoo-panel__header">
              <h2 id="panel-title-calendar" className="alatoo-panel__title">
                Year &times; Month Fire Calendar (2000&ndash;2026)
              </h2>
              <span className="alatoo-panel__meta">
                {unit} &middot; {activePalette}
              </span>
            </div>
            <div className="alatoo-panel__body">
              {calendarSlot || (
                <SlotPlaceholder
                  slotName="calendarSlot"
                  description="27-year x 12-month heatmap using viridis/cividis and hatched null cells."
                />
              )}
            </div>
          </section>

          <section
            className="alatoo-panel alatoo-panel--validation"
            aria-labelledby="panel-title-validation"
          >
            <div className="alatoo-panel__header">
              <h2 id="panel-title-validation" className="alatoo-panel__title">
                MODIS / VIIRS Harmonization &amp; Validation
              </h2>
              <span className="alatoo-panel__meta">
                2012 knot &middot; 95% CI
              </span>
            </div>
            <div className="alatoo-panel__body">
              {validationChartSlot || (
                <SlotPlaceholder
                  slotName="validationChartSlot"
                  description="Pre/post-2012 harmonized time series with [lo, hi] uncertainty band and step_ratio."
                />
              )}
            </div>
          </section>
        </div>
      </main>

      <AttributionFooter
        onOpenLimitations={handleOpenLimits}
        methodVersion={methodVersion}
      />

      <LimitationsView isOpen={limitsOpen} onClose={handleCloseLimits} />
    </div>
  );
}
