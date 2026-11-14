# Data and method limitations

The calendar describes satellite thermal detections in a fixed region: 68.5–80.7°E, 38.4–43.7°N. Read the actual available dates from the interface or dataset manifest.

1. **A hotspot is not a confirmed wildfire.** Agriculture, industrial heat and other sources can produce detections. The grid metric is not burned area, a count of separate incidents or an emergency alert.
2. **The grid is angular.** A 0.01° cell is approximately 1.11 km north–south but only about 0.8–0.9 km east–west in this region. `hotspot_days_1km` is the established metric name, not a claim that every cell has an area of one square kilometre.
3. **Archive coverage is not clear-sky coverage.** `days_observed` counts dates covered by downloaded source archives. Clouds, smoke, missed overpasses and sensor outages can still hide fires. An archive day with no detection cannot prove absence of fire. Missing archives are distinct from zero detections.
4. **AOIs use coarse analysis cells.** The API includes every 0.25° cell intersecting the polygon with positive area. Counts can therefore include detections outside the exact AOI. Tiny polygons still return a coarse cell. Raw CSV uses the actual polygon for point filtering, so raw rows cannot be equated to the harmonized count.
5. **Calibration is an estimate.** Robust log1p regression is trained on overlapping MODIS and SNPP observations by tile and season with shrinkage. The band combines approximate coefficient and residual uncertainty; it is not a guarantee of 95% coverage. Summed cell bounds are not independently validated AOI confidence intervals. MODIS bounds equal the observation because no cross-sensor transformation is applied, not because MODIS is error-free.
6. **Time is not an experimental control.** Real fires vary between years. The 2012 temporal step and a 2010 placebo are descriptive diagnostics, not causal proof that sensor bias disappeared. Check the same-period sensor ratios, hold-out error and interval coverage too. No metric is rescaled to meet a desired pitch number.
7. **Partial months require exact prefixes.** Historical detections are accumulated through the same day. The API refuses unavailable prefix coverage. Partial VIIRS windows use their actual cumulative detection fraction of the available month and its fixed calibrated allocation. This adds temporal and spatial allocation uncertainty, which the current interval does not separately model. Leap years and incomplete coverage reduce the usable baseline.
8. **Recent feeds can change.** NRT data have latency and can be revised by science-quality products. Overlapping exact records prefer SP. A fully covered NRT month need not appear in the API's legacy `nrt_months` field, which currently lists partial months only.
9. **Hold-out and regional limits.** The fixed 2024–2025 hold-out is never used for coefficient fitting. Results do not establish accuracy outside this region, for added NOAA sensors, or in future environmental conditions. Low-activity cell MAPE can be unstable; zero-reference pairs are excluded from MAPE and counted separately in the pipeline report.

NASA FIRMS — MODIS/VIIRS active fire data. [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) provides the source observations; NASA does not endorse this application. Source definitions: [FIRMS data API](https://firms.modaps.eosdis.nasa.gov/api/area/) and [availability API](https://firms.modaps.eosdis.nasa.gov/api/data_availability/).

For the current build, the cell-level positive-reference hold-out MAPE is about
78%. Aggregate scale agreement does not make a small AOI accurate. The 2024–2025
hold-out was excluded from fitting, but its diagnostic results informed the
revision from v1 to v2. Treat it as a development evaluation, not an untouched
final benchmark. This release is a research demonstration and requires further
prospective validation before operational fire-response decisions.
