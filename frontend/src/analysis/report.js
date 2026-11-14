const escape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const number = (value) =>
  Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: 3 })
    : "Unavailable";
const percent = (value) =>
  Number.isFinite(value) ? `${number(value * 100)}%` : "Unavailable";
const field = (label, value) =>
  `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const list = (values) =>
  Array.isArray(values) && values.length ? values.join(", ") : "None reported";
const sameCoordinates = (first, second) =>
  JSON.stringify(first) === JSON.stringify(second);

function validateSnapshot({
  aoi,
  range,
  month,
  anomaly,
  summary,
  harmonization,
}) {
  if (
    !monthPattern.test(month || "") ||
    !monthPattern.test(range?.from || "") ||
    !monthPattern.test(range?.to || "") ||
    range.from > month ||
    range.to < month
  )
    throw new Error("Choose a month inside the report period.");
  if (!summary?.meta || !summary.aoi || !summary.coverage || !anomaly?.baseline)
    throw new Error("Wait for the selected area and month to finish loading.");
  if (
    summary.aoi.id !== anomaly.aoi_id ||
    anomaly.month !== month ||
    summary.period?.from !== range.from ||
    summary.period?.to !== range.to
  )
    throw new Error(
      "The report data no longer matches this selection. Wait for the latest results.",
    );
  if (harmonization && harmonization.aoi_id !== summary.aoi.id)
    throw new Error("Calibration data does not match this area.");
  if (
    !["parquet", "mock"].includes(summary.meta.source) ||
    [anomaly, harmonization]
      .filter(Boolean)
      .some(
        (response) =>
          response.meta?.source !== summary.meta.source ||
          response.meta?.method_version !== summary.meta.method_version,
      )
  )
    throw new Error(
      "The report combines different data sources or method versions. Reload the selection.",
    );
  if (!["bbox", "polygon"].includes(aoi?.kind))
    throw new Error("Choose an area before creating a report.");
  if (
    (aoi.kind === "bbox" &&
      (!Array.isArray(aoi.bbox) || aoi.bbox.length !== 4)) ||
    (aoi.kind === "polygon" &&
      (!Array.isArray(aoi.polygon) ||
        aoi.polygon.length < 3 ||
        aoi.polygon.length > 100 ||
        aoi.polygon.some(
          (point) => !Array.isArray(point) || point.length !== 2,
        )))
  )
    throw new Error("The selected area has invalid geometry.");
  const coordinates = aoi.kind === "bbox" ? aoi.bbox : aoi.polygon?.flat();
  if (
    !Array.isArray(coordinates) ||
    !coordinates.length ||
    coordinates.some((coordinate) => !Number.isFinite(coordinate))
  )
    throw new Error("The selected area contains invalid coordinates.");
  if (
    aoi.kind !== summary.aoi.kind ||
    !sameCoordinates(
      aoi.kind === "bbox" ? aoi.bbox : aoi.polygon,
      aoi.kind === "bbox" ? summary.aoi.bbox : summary.aoi.polygon,
    )
  )
    throw new Error(
      "Area details are still updating. Wait for the selected area to finish loading.",
    );
  for (const value of [
    anomaly.observed,
    anomaly.baseline.median,
    anomaly.baseline.robust_sigma,
  ])
    if (!Number.isFinite(value) || value < 0)
      throw new Error(
        "The selected month does not have enough valid measurements for a report.",
      );
  if (
    !Number.isSafeInteger(anomaly.observed) ||
    !Number.isInteger(anomaly.baseline.n_years) ||
    anomaly.baseline.n_years < 1 ||
    (anomaly.percentile != null &&
      (!Number.isFinite(anomaly.percentile) ||
        anomaly.percentile < 0 ||
        anomaly.percentile > 1)) ||
    (anomaly.robust_z != null && !Number.isFinite(anomaly.robust_z)) ||
    typeof anomaly.partial !== "boolean" ||
    (anomaly.partial &&
      (!Number.isInteger(anomaly.through_day) ||
        anomaly.through_day < 1 ||
        anomaly.through_day > 31))
  )
    throw new Error("The selected month has invalid comparison statistics.");
}

const reportCss = `
:root { color-scheme: light; --paper: #ffffff; --ink: #222629; --muted: #515b61; --rule: #c9cfd3; --accent: #7b4722; }
* { box-sizing: border-box; }
body { margin: 0; padding: 48px 24px; background: var(--paper); color: var(--ink); font: 16px/1.55 system-ui, sans-serif; }
main { max-width: 880px; margin: auto; }
header { padding-bottom: 24px; border-bottom: 2px solid var(--ink); }
h1 { margin: 0 0 8px; font-size: 30px; font-weight: 650; line-height: 1.2; }
h2 { font-size: 19px; margin: 32px 0 12px; }
p { margin: 8px 0; }
.subtitle, .note, dt { color: var(--muted); }
.reading { display: block; margin-top: 24px; font-size: 44px; font-weight: 650; line-height: 1.15; font-variant-numeric: tabular-nums; }
.reading small { font-size: 16px; font-weight: 400; }
dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 16px 0; gap: 14px 32px; }
dl > div { min-width: 0; }
dt { font-size: 14px; }
dd { margin: 2px 0 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.note { padding: 12px 0; border-block: 1px solid var(--rule); }
.warning { color: var(--accent); font-weight: 550; }
pre { padding: 16px; border: 1px solid var(--rule); white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; }
li + li { margin-top: 8px; }
footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 13px; }
@media (max-width: 520px) { body { padding: 24px 16px; } dl { grid-template-columns: 1fr; } }
@media print { @page { margin: 18mm; } body { padding: 0; font-size: 11pt; } h1 { font-size: 22pt; } h2 { break-after: avoid; } dl, pre, .note { break-inside: avoid; } }
`;

export function buildEvidenceReport(snapshot) {
  validateSnapshot(snapshot);
  const { aoi, range, month, anomaly, summary, harmonization } = snapshot;
  const generatedAt = snapshot.generatedAt ?? new Date().toISOString();
  const source = summary.meta.source;
  const mock = source === "mock";
  const validation = harmonization?.validation;
  const geometry =
    aoi.kind === "polygon"
      ? { type: "Polygon", coordinates: [[...aoi.polygon, aoi.polygon[0]]] }
      : {
          type: "Polygon",
          coordinates: [
            [
              [aoi.bbox[0], aoi.bbox[1]],
              [aoi.bbox[2], aoi.bbox[1]],
              [aoi.bbox[2], aoi.bbox[3]],
              [aoi.bbox[0], aoi.bbox[3]],
              [aoi.bbox[0], aoi.bbox[1]],
            ],
          ],
        };
  const comparison = anomaly.partial
    ? `Incomplete month: all comparison years use days through ${anomaly.through_day}. Source data may still grow.`
    : "Complete-month comparison.";
  const calibration = harmonization
    ? `<section><h2>Calibration evidence</h2><dl>
${field("Diagnostic years", list(validation?.holdout_years))}
${field("Paired months", number(validation?.n))}
${field("Weighted absolute error (WAPE)", percent(validation?.wape))}
${field("Monthly MAPE", percent(validation?.mape))}
${field("Raw transition ratio", number(harmonization.jump?.step_ratio_raw))}
${field("Calibrated transition ratio", number(harmonization.jump?.step_ratio_harmonized))}
${field("Observed MODIS transition ratio", number(harmonization.jump?.step_ratio_modis))}
${field("Control-year ratio", number(harmonization.jump?.step_ratio_placebo))}
</dl><p class="note">${mock ? "Illustrative fixture metrics do not establish calibration quality." : "Validation is internal: holdout diagnostics informed the model revision. It is not an untouched benchmark. Transition ratios contain real interannual variability; one is not a guaranteed target."}</p></section>`
    : '<p class="note">Calibration metrics were not available when this report was created.</p>';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>${escape(month)} fire activity report · Ala-Too Fire Atlas</title><style>${reportCss}</style></head>
<body><main><header><h1>Fire activity report</h1><p class="subtitle">Ala-Too Fire Atlas · ${escape(month)} · ${escape(range.from)} to ${escape(range.to)}</p>
${mock ? '<p class="warning">DEMO DATA — this report uses illustrative fixtures, not satellite measurements.</p>' : ""}</header>
<section><h2>Selected month</h2><strong class="reading">${number(anomaly.observed)} <small>hotspot-days</small></strong>
<p>${escape(anomaly.label || "Historical comparison")}</p><p class="note">${escape(comparison)} ${escape(anomaly.baseline.window)}</p>
<dl>${field("Historical median", number(anomaly.baseline.median))}${field("Robust sigma", number(anomaly.baseline.robust_sigma))}${field("Baseline years", number(anomaly.baseline.n_years))}${field("Historical percentile", percent(anomaly.percentile))}${field("Standardized score", anomaly.baseline.robust_sigma === 0 ? "Unavailable: constant baseline" : number(anomaly.robust_z))}</dl></section>
<section><h2>Area and data coverage</h2><dl>
${field("Area identifier", summary.aoi.id)}${field("Selected area", `${number(summary.aoi.area_km2)} km²`)}${field("Grid cells selected", number(summary.aoi.cells_inside))}${field("Months available / requested", `${number(summary.coverage.months_present)} / ${number(summary.coverage.months_expected)}`)}${field("Missing months", list(summary.coverage.gaps))}${field("Partial source coverage", list(summary.coverage.nrt_months))}
</dl><p>Selection geometry, longitude/latitude in EPSG:4326:</p><pre>${escape(JSON.stringify(geometry, null, 2))}</pre></section>
${calibration}
<section><h2>Interpretation and limitations</h2><ul>
<li>A hotspot is a satellite thermal anomaly, not a confirmed wildfire, an incident count or burned area.</li>
<li>Counts sum unique 0.01° cells with a detection over days. Post-2012 estimates are on the MODIS measurement scale.</li>
<li>Reporting uses whole 0.25° cells intersecting the selected area. Small areas are sensitive to grid boundaries.</li>
<li>Source coverage means available download days, not guaranteed cloud-free satellite observation. Missing data is not zero.</li>
<li>Calibration intervals do not include every measurement error. Local estimates can be substantially less accurate than regional totals.</li>
<li>This research tool does not provide real-time alerts, fire forecasts or validated operational guidance.</li>
</ul></section>
<footer><dl>${field("Source", source)}${field("Method version", summary.meta.method_version)}${field("Data response generated", summary.meta.generated_at)}${field("Report created", generatedAt)}${field("Unit", summary.meta.unit)}</dl><p>NASA FIRMS · MODIS / VIIRS active fire observations. NASA does not certify this application. This file is a snapshot; reopening it does not refresh the data.</p></footer></main></body></html>`;
  return { html, filename: `ala-too-fire-report-${month}.html` };
}

export function downloadEvidenceReport(snapshot) {
  const report = buildEvidenceReport(snapshot);
  const url = URL.createObjectURL(
    new Blob([report.html], { type: "text/html;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = report.filename;
  try {
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return report.filename;
}
