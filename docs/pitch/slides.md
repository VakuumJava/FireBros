# Ala-Too Fire Calendar

## 1 · Is this month unusual — or did the satellite change?

**One area. A comparable fire-activity history.**

Ala-Too Fire Calendar helps emergency planners, land managers and researchers
compare monthly thermal activity across Kyrgyzstan and its neighbouring region.

NASA FIRMS archive coverage in this build: **2000-11-01 → 2026-11-14**.

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

Paired VIIRS/MODIS ratio over the overlap: **3.83 → 1.05**.

Held-out 2024-2025: paired ratio **3.63 → 1.02**, regional
monthly WAPE **23.1%**, 95% interval coverage **98.7%** across
20,482 cell-months.

## 5 · The 2012 test: ask MODIS itself

MODIS kept observing through 2012 and measured that season at **0.58**
of its 2009-2011 level. The naive MODIS + VIIRS splice reports **2.78**, a 4.8×
sensor artefact. The calibrated series reports **0.78**: the residual
1.35× is published, not hidden. The 2010 placebo is 0.61.

Year by year, raw VIIRS/MODIS ranges between 3.36 and 4.95. Calibrated, it stays
between 0.92 and 1.29. In 2026, never used for fitting or model
choices, it is **4.61 → 1.25** over
4 fully observed months.

Error grows as the area shrinks: 23.1% for the regional month,
36.5% for a 2° tile, 91.3% for a single 0.25° cell. We do not rescale
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
