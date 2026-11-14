"""Generate the jury material directly from a completed pipeline report."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

MISSING = "not available"


def ratio(number: object, digits: int = 2) -> str:
    return f"{number:.{digits}f}" if isinstance(number, (float, int)) else MISSING


def percent(number: object) -> str:
    return f"{number * 100:.1f}%" if isinstance(number, (float, int)) else MISSING


def quotient(numerator: object, denominator: object) -> float | None:
    if isinstance(numerator, (float, int)) and isinstance(denominator, (float, int)):
        return numerator / denominator if denominator else None
    return None


def facts(report: dict, manifest: dict) -> dict[str, str]:
    holdout = report.get("holdout", {})
    region = report.get("holdout_region", {})
    tile = report.get("holdout_tile", {})
    overlap = report.get("overlap", {})
    prospective = report.get("prospective", {})
    years = [entry for entry in report.get("overlap_by_year", []) if entry["role"] != "prospective"]
    span = manifest.get("range") or ["see manifest", "see manifest"]
    step_raw = report.get("step_ratio_raw")
    step_modis = report.get("step_ratio_modis")
    step_calibrated = report.get("step_ratio_harmonized")

    def extent(key: str) -> str:
        values = [entry[key] for entry in years if entry.get(key) is not None]
        return f"{min(values):.2f} and {max(values):.2f}" if values else MISSING

    return {
        "start": span[0],
        "end": span[1],
        "status": report.get("status", "unknown"),
        "step_raw": ratio(step_raw),
        "step_modis": ratio(step_modis),
        "step_calibrated": ratio(step_calibrated),
        "placebo": ratio(report.get("step_ratio_placebo")),
        "artefact": ratio(quotient(step_raw, step_modis), 1),
        "residual": ratio(quotient(step_calibrated, step_modis)),
        "overlap_raw": ratio(overlap.get("raw_to_modis")),
        "overlap_calibrated": ratio(overlap.get("harmonized_to_modis")),
        "holdout_raw": ratio(holdout.get("raw_to_modis")),
        "holdout_calibrated": ratio(holdout.get("harmonized_to_modis")),
        "holdout_pairs": f"{holdout.get('n', 0):,}",
        "coverage": percent(holdout.get("coverage_95")),
        "region_wape": percent(region.get("wape")),
        "tile_wape": percent(tile.get("wape")),
        "cell_wape": percent(holdout.get("wape")),
        "yearly_raw": extent("raw_to_modis"),
        "yearly_calibrated": extent("harmonized_to_modis"),
        "prospective_years": ", ".join(map(str, prospective.get("years", []))) or MISSING,
        "prospective_months": str(prospective.get("region", {}).get("n", 0)),
        "prospective_raw": ratio(prospective.get("cell", {}).get("raw_to_modis")),
        "prospective_calibrated": ratio(prospective.get("cell", {}).get("harmonized_to_modis")),
    }


SLIDES = """# Ala-Too Fire Calendar

## 1 · Is this month unusual — or did the satellite change?

**One area. A comparable fire-activity history.**

Ala-Too Fire Calendar helps emergency planners, land managers and researchers
compare monthly thermal activity across Kyrgyzstan and its neighbouring region.

NASA FIRMS archive coverage in this build: **{start} → {end}**.

## 2 · A better sensor can look like a worse fire season

MODIS and VIIRS observe at different spatial resolutions. Simply joining their
native detections can introduce a measurement discontinuity. That makes a
multi-decade baseline harder to interpret.

We compare paired observations instead of assuming every year-to-year increase
was caused by the sensor. Real climate and land-use changes still matter.

## 3 · Draw the question on the map

Draw a polygon or enter coordinates. Choose a month or a multi-year period.
The calendar shows hotspot-days on a common approximate 1 km grid. Choose a
month to compare it with historical years; export the same selection as CSV.

Missing observations are hatched. Observed zeros remain zeros. The source and
available date range are visible. A hotspot is not a confirmed wildfire or a
measurement of burned area.

## 4 · Resolution alignment, then calibration

1. Deduplicate NASA FIRMS observations and count unique 0.01° cell-days.
2. Aggregate to 0.25° reporting cells; retain coverage and original detections.
3. Fit robust log1p calibration by 2° tile and season with shrinkage.
4. Keep 2024-2025 out of coefficient fitting; evaluate paired observations.
   Holdout diagnostics informed a model revision, so this is internal validation
   rather than an untouched final benchmark.

Paired VIIRS/MODIS ratio over the overlap: **{overlap_raw} → {overlap_calibrated}**.

Held-out 2024-2025: paired ratio **{holdout_raw} → {holdout_calibrated}**, regional
monthly WAPE **{region_wape}**, 95% interval coverage **{coverage}** across
{holdout_pairs} cell-months.

## 5 · The 2012 test: ask MODIS itself

MODIS kept observing through 2012 and measured that season at **{step_modis}**
of its 2009-2011 level. The naive MODIS + VIIRS splice reports **{step_raw}**, a {artefact}×
sensor artefact. The calibrated series reports **{step_calibrated}**: the residual
{residual}× is published, not hidden. The 2010 placebo is {placebo}.

Year by year, raw VIIRS/MODIS ranges between {yearly_raw}. Calibrated, it stays
between {yearly_calibrated}. In {prospective_years}, never used for fitting or model
choices, it is **{prospective_raw} → {prospective_calibrated}** over
{prospective_months} fully observed months.

Error grows as the area shrinks: {region_wape} for the regional month,
{tile_wape} for a 2° tile, {cell_wape} for a single 0.25° cell. We do not rescale
results to meet a target.

## 6 · Built for reproducibility

FIRMS CSV → unique cell-days → partitioned Parquet → FastAPI → React / Leaflet /
Plotly. Heavy computation happens before a user query. Manifest hashes identify
the source archives and generated artifacts. Tests protect contracts, AOI
validation, coverage, calibration and CSV consistency.

The open workflow can be rerun for a larger region or refreshed with authorized
NRT access. A current archive does not imply live alerting.

## 7 · From isolated detections to an accountable baseline

**Use the map to ask a better question about fire activity.**

Team Stellar Baatyr · https://github.com/VakuumJava/FireBros

NASA FIRMS — MODIS/VIIRS active fire data. No NASA endorsement implied.
AI assistance was used for implementation and review. Scientific claims are
bounded by the generated report; independent expert review remains valuable.
"""

DEMO = """# Demo script · 90 seconds

Speak at a measured pace. Show the running app with a parquet badge. If the app
shows mock, state that clearly and do not present the following as a measured
result. Keep the report and manifest beside the app for questions.

| Time | Screen | Narration |
|---|---|---|
| 0-12 s | Map, source badge, coverage | “Is this month unusually active, or did our satellite become more sensitive? Ala-Too Fire Calendar puts fire activity in Kyrgyzstan and its neighbours into historical context.” |
| 12-27 s | Draw a small polygon; calendar updates | “Draw an area and choose a period. We count unique hotspot cell-days on a common grid, then show the monthly history. Hatched cells mean missing observations — never zero.” |
| 27-42 s | Select one observed calendar month | “Select a month to compare it with earlier years. The baseline includes its median, robust spread and percentile. When daily coverage supports a partial month, historical comparisons use the same day window.” |
| 42-63 s | Harmonization chart, “Year-to-year change” | “MODIS kept flying through 2012, so we can ask it directly. MODIS alone saw {step_modis}. The naive splice claims {step_raw} — a fake jump. Our calibrated series shows {step_calibrated}. The band is calibration uncertainty.” |
| 63-77 s | “Internal validation” | “The coefficients never saw 2024 and 2025. There the sensor ratio drops from {holdout_raw} to {holdout_calibrated}, and the regional monthly error is {region_wape}. {prospective_years} was never touched at all: {prospective_raw} becomes {prospective_calibrated}. Small areas are much noisier, and we say so.” |
| 77-90 s | Download CSV; open limitations | “Export the selected history or original detections. Source hashes make the build reproducible. These are thermal anomalies, not confirmed wildfires. Our contribution is a transparent, testable baseline.” |

Measured archive coverage: {start} → {end}. Report status: {status}.
If a metric is unavailable, omit its spoken number and explain the missing
coverage; never substitute a fixture metric.
"""

SUBMISSION = """# Submission draft

## Project summary

Ala-Too Fire Calendar is an open-source geospatial application for comparing
monthly thermal activity across Kyrgyzstan and its neighbouring region. Users
define an area on a map, inspect a harmonized historical calendar, compare a
selected month with its historical baseline, and export reproducible CSV data.

## What is different

The project addresses a measurement problem: finer-resolution satellite sensors
can increase detection counts without an equivalent increase in fire activity.
It aligns observations to unique 0.01° cell-days, aggregates them into 0.25°
reporting cells, and calibrates VIIRS to a MODIS-equivalent scale with robust
seasonal and spatial regression. Coverage remains explicit throughout.

## Evidence

MODIS kept observing through the 2012 sensor transition, so it provides the
reference for the temporal test. Against 2009-2011, MODIS alone saw
**{step_modis}**. The naive splice reports **{step_raw}**; the calibrated series
reports **{step_calibrated}**, reducing the sensor artefact from {artefact}× to {residual}×.

Paired VIIRS/MODIS ratio: **{overlap_raw} → {overlap_calibrated}** over the overlap
and **{holdout_raw} → {holdout_calibrated}** on held-out 2024-2025. Regional monthly
WAPE on the holdout is **{region_wape}**; cell-level error remains high (WAPE
**{cell_wape}**). Prospective {prospective_years}, unused for fitting or model
revision: **{prospective_raw} → {prospective_calibrated}** over {prospective_months}
fully observed months.

Results are generated from `harmonization_report.json`; input and output hashes
are recorded in the build manifest. Archive coverage: {start} → {end}.

## Relevance and limitations

Holdout diagnostics informed the model revision. Final coefficients exclude the
held-out years, but reported metrics are internal validation, not an untouched
benchmark. Local prediction errors remain material even when aggregate bias
is low. Prospective years continue the independent check before operational use.

Emergency planners, researchers, and land managers can assess whether a month
is unusual relative to the available historical record for their own area.
Thermal anomalies are not confirmed fires. Clouds, viewing geometry, land
cover, and sensor behaviour affect detection. Calibration intervals do not
capture all uncertainty. Reporting cells approximate polygon boundaries; the
interface explains these limits and visibly distinguishes missing data.

## Implementation and reproducibility

Python ingestion, deterministic Parquet artifacts, robust calibration and
held-out validation feed a FastAPI service. React, Leaflet and Plotly provide
the map, calendar and analysis. The repository includes contracts, automated
tests, deployment configuration, manifests, and commands for rebuilding data.

## Team and attribution

Team Stellar Baatyr. Repository: https://github.com/VakuumJava/FireBros

NASA FIRMS — MODIS/VIIRS active fire data. Map data © OpenStreetMap contributors.
AI assistance supported engineering and review; generated metrics were not
replaced by invented figures. The team should review this submission and add
its member names and the final public deployment URL before submitting it.
"""


def generate(report: dict, manifest: dict, output: Path) -> None:
    values = facts(report, manifest)
    output.mkdir(parents=True, exist_ok=True)
    for name, template in (
        ("slides.md", SLIDES),
        ("demo-script.md", DEMO),
        ("submission.md", SUBMISSION),
    ):
        (output / name).write_text(template.format(**values), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent)
    args = parser.parse_args()
    generate(
        json.loads(args.report.read_text()), json.loads(args.manifest.read_text()), args.output
    )


if __name__ == "__main__":
    main()
