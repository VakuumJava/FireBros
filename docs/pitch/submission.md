# Submission draft

## Project summary

Ala-Too Fire Calendar is an open-source geospatial application for comparing
monthly thermal activity across Kyrgyzstan and its neighbouring region. Users
define an area on a map, inspect a harmonized historical calendar, compare a
selected month with its historical baseline, and export reproducible CSV data. Saved areas, shareable analysis links, WGS84
GeoJSON exchange, seasonal comparisons and self-contained reports support a
repeatable research workflow.

## What is different

The project addresses a measurement problem: finer-resolution satellite sensors
can increase detection counts without an equivalent increase in fire activity.
It aligns observations to unique 0.01° cell-days, aggregates them into 0.25°
reporting cells, and calibrates VIIRS to a MODIS-equivalent scale with robust
seasonal and spatial regression. Coverage remains explicit throughout.

## Evidence

MODIS kept observing through the 2012 sensor transition, so it provides the
reference for the temporal test. Against 2009-2011, MODIS alone saw
**0.58**. The naive splice reports **2.78**; the calibrated series
reports **0.78**, reducing the sensor artefact from 4.8× to 1.35×.

Paired VIIRS/MODIS ratio: **3.83 → 1.05** over the overlap
and **3.63 → 1.02** on held-out 2024-2025. Regional monthly
WAPE on the holdout is **23.1%**; cell-level error remains high (WAPE
**91.3%**). Prospective 2026, unused for fitting or model
revision: **4.61 → 1.25** over 4
fully observed months.

Results are generated from `harmonization_report.json`; input and output hashes
are recorded in the build manifest. Archive coverage: 2000-11-01 → 2026-11-14.

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
replaced by invented figures. Live application: https://nasa.vakuum.cc. The team should review this submission
and add its member names before submitting it.
