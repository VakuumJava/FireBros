import { useEffect, useRef, useState } from "react";
import { withMonthlyGaps } from "../api/series";
import { chartColors } from "../ui/chartTheme";
import { fmt, fmtPct, fmtRatio, pad2 } from "../ui/format";
import "./harmonization.css";

export default function HarmonizationChart({ data }) {
  const element = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let alive = true;
    let plotly;
    let observer;
    const node = element.current;
    if (!data.series.length) return;
    setStatus("loading");
    const draw = async () => {
      try {
        const module = await import("plotly.js-dist-min");
        if (!alive) return;
        plotly = module.default;
        const T = chartColors(node);
        const series = withMonthlyGaps(data.series);
        const pointMode = data.series.length === 1 ? "lines+markers" : "lines";
        const x = series.map(
          (point) => `${point.year}-${pad2(point.month)}-01`,
        );
        const traces = [
          {
            x,
            y: series.map((point) => point.hi),
            mode: "lines",
            line: { width: 0 },
            hoverinfo: "skip",
            showlegend: false,
          },
          {
            x,
            y: series.map((point) => point.lo),
            mode: "lines",
            line: { width: 0 },
            fill: "tonexty",
            fillcolor: T.band,
            name: "95% interval",
            hoverinfo: "skip",
          },
          {
            x,
            y: series.map((point) => point.raw),
            mode: pointMode,
            name: "Native sensor count",
            line: { color: T.raw, width: 1.5, dash: "dot" },
            hovertemplate: "%{x|%Y-%m}: %{y}<extra>raw</extra>",
          },
          {
            x,
            y: series.map((point) => point.harmonized),
            mode: pointMode,
            name: "MODIS-equivalent",
            line: { color: T.harmonized, width: 2 },
            hovertemplate: "%{x|%Y-%m}: %{y}<extra>harmonized</extra>",
          },
          {
            x,
            y: series.map((point) =>
              point.sensor === "MODIS" ? null : point.modis_truth,
            ),
            mode: "markers",
            name: "Observed MODIS",
            marker: { color: T.truth, size: 4 },
            hovertemplate: "%{x|%Y-%m}: %{y}<extra>MODIS</extra>",
          },
        ].map((trace) => ({ type: "scatter", connectgaps: false, ...trace }));
        const knot = `${data.knot_year}-01-01`;
        const showKnot = knot >= x[0] && knot <= x.at(-1);
        const layout = {
          autosize: true,
          margin: { l: 56, r: 12, t: 32, b: 44 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: {
            color: T.text,
            size: 13,
            family: "IBM Plex Sans UIMix, sans-serif",
          },
          showlegend: false,
          xaxis: { type: "date", gridcolor: T.grid },
          yaxis: {
            gridcolor: T.grid,
            rangemode: "tozero",
          },
          shapes: showKnot
            ? [
                {
                  type: "line",
                  x0: knot,
                  x1: knot,
                  yref: "paper",
                  y0: 0,
                  y1: 1,
                  line: { color: T.knot, dash: "dash", width: 1 },
                },
              ]
            : [],
          annotations: showKnot
            ? [
                {
                  x: knot,
                  yref: "paper",
                  y: 1,
                  text: `${data.knot_year} · VIIRS`,
                  showarrow: false,
                  xanchor: "left",
                  font: { size: 12, color: T.text },
                },
              ]
            : [],
        };
        await plotly.react(node, traces, layout, {
          displaylogo: false,
          responsive: true,
          scrollZoom: false,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
        });
        if (!alive) {
          plotly.purge(node);
          return;
        }
        observer = new ResizeObserver(() => {
          if (node.isConnected) plotly.Plots.resize(node);
        });
        observer.observe(node);
        setStatus("ready");
      } catch {
        if (alive) setStatus("error");
      }
    };
    draw();
    return () => {
      alive = false;
      observer?.disconnect();
      if (plotly) plotly.purge(node);
    };
  }, [data]);

  const { jump, validation } = data;
  const measured = data.meta?.source !== "mock";
  return (
    <div className="harm sensor-review">
      {!data.series.length && (
        <p className="note">No observed months in this selection.</p>
      )}
      {data.series.length > 0 && (
        <>
          <ul className="sensor-review__legend" aria-label="Chart series">
            <li>
              <span
                className="sensor-review__key sensor-review__key--raw"
                aria-hidden="true"
              />
              Native sensor count
            </li>
            <li>
              <span
                className="sensor-review__key sensor-review__key--estimate"
                aria-hidden="true"
              />
              MODIS-equivalent estimate
            </li>
            <li>
              <span
                className="sensor-review__key sensor-review__key--observed"
                aria-hidden="true"
              />
              Observed MODIS
            </li>
            <li>
              <span
                className="sensor-review__key sensor-review__key--interval"
                aria-hidden="true"
              />
              95% calibration interval
            </li>
          </ul>
          <div className="sensor-review__plot-heading">
            <span>Hotspot-days per month</span>
            <span role="status">
              {status === "loading" ? "Loading chart…" : ""}
            </span>
          </div>
        </>
      )}
      {status === "error" && (
        <p className="card__msg card__msg--error" role="alert">
          The chart could not load. Monthly values remain available in the
          calendar and CSV export.
        </p>
      )}
      <div
        ref={element}
        className="harm__chart"
        hidden={!data.series.length}
        role="img"
        aria-label="Monthly native sensor counts, MODIS-equivalent estimates with uncertainty, and observed MODIS counts. Values are available in the monthly CSV."
      />
      {measured ? (
        <div className="sensor-review__diagnostics">
          <section
            className="sensor-review__group"
            aria-labelledby="temporal-diagnostic-title"
          >
            <h3 id="temporal-diagnostic-title">Year-to-year change</h3>
            <p className="sensor-review__context">
              Ratios across the {data.knot_year} sensor transition
            </p>
            <dl className="sensor-review__metrics">
              <div>
                <dt>Raw counts</dt>
                <dd>{fmtRatio(jump.step_ratio_raw)}</dd>
              </div>
              <div>
                <dt>Calibrated</dt>
                <dd>{fmtRatio(jump.step_ratio_harmonized)}</dd>
              </div>
              <div className="sensor-review__reference">
                <dt>MODIS alone</dt>
                <dd>{fmtRatio(jump.step_ratio_modis)}</dd>
              </div>
              <div>
                <dt>Control year (placebo)</dt>
                <dd>{fmtRatio(jump.step_ratio_placebo)}</dd>
              </div>
            </dl>
            <p className="sensor-review__context">
              MODIS kept observing through {data.knot_year}, so the calibrated
              ratio should follow MODIS alone, not 1.0. The rest is real change
              in fire activity.
            </p>
          </section>
          <section
            className="sensor-review__group"
            aria-labelledby="validation-diagnostic-title"
          >
            <h3 id="validation-diagnostic-title">Internal validation</h3>
            <p className="sensor-review__context">
              {validation.holdout_years.join("–") || "Years unavailable"} ·{" "}
              {fmt(validation.n)} paired months in this area
            </p>
            <dl className="sensor-review__metrics">
              <div>
                <dt>Weighted error (WAPE)</dt>
                <dd>{fmtPct(validation.wape)}</dd>
              </div>
              <div>
                <dt>Monthly MAPE</dt>
                <dd>{fmtPct(validation.mape)}</dd>
              </div>
              <div>
                <dt>RMSE (log)</dt>
                <dd>{fmt(validation.rmse_log)}</dd>
              </div>
              <div>
                <dt>Bias</dt>
                <dd>{fmt(validation.bias)}</dd>
              </div>
            </dl>
            <p className="sensor-review__context">
              Model revision used these diagnostics. This is not an untouched
              benchmark.
            </p>
          </section>
        </div>
      ) : (
        <p className="note">
          Illustrative fixture series. These curves do not establish calibration
          quality; measured validation requires the satellite archive.
        </p>
      )}
      <details className="sensor-review__notes">
        <summary>How to interpret the comparison</summary>
        <p>
          Harmonization estimates a common measurement scale. The interval
          represents calibration uncertainty; it does not cover cloud-related
          omissions or every source of measurement error.
        </p>
        <p>
          Validation is internal: holdout diagnostics informed the model
          revision. Coefficients exclude those years, but this is not an
          untouched benchmark.
        </p>
        {measured && <p>{jump.definition}</p>}
      </details>
    </div>
  );
}
