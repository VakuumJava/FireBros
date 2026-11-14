# Demo script · 90 seconds

Speak at a measured pace. Show the running app with a parquet badge. If the app
shows mock, state that clearly and do not present the following as a measured
result. Keep the report and manifest beside the app for questions.

| Time | Screen | Narration |
|---|---|---|
| 0-12 s | Map, source badge, coverage | “Is this month unusually active, or did our satellite become more sensitive? Ala-Too Fire Calendar puts fire activity in Kyrgyzstan and its neighbours into historical context.” |
| 12-27 s | Draw a small polygon; calendar updates | “Draw an area and choose a period. We count unique hotspot cell-days on a common grid, then show the monthly history. Hatched cells mean missing observations — never zero.” |
| 27-42 s | Select one observed calendar month | “Select a month to compare it with earlier years. The baseline includes its median, robust spread and percentile. When daily coverage supports a partial month, historical comparisons use the same day window.” |
| 42-63 s | Harmonization chart, “Year-to-year change” | “MODIS kept flying through 2012, so we can ask it directly. MODIS alone saw 0.58. The naive splice claims 2.78 — a fake jump. Our calibrated series shows 0.78. The band is calibration uncertainty.” |
| 63-77 s | “Internal validation” | “The coefficients never saw 2024 and 2025. There the sensor ratio drops from 3.63 to 1.02, and the regional monthly error is 23.1%. 2026 was never touched at all: 4.61 becomes 1.25. Small areas are much noisier, and we say so.” |
| 77-90 s | Download CSV; open limitations | “Export the selected history or original detections. Source hashes make the build reproducible. These are thermal anomalies, not confirmed wildfires. Our contribution is a transparent, testable baseline.” |

Measured archive coverage: 2000-11-01 → 2026-11-14. Report status: evaluated.
If a metric is unavailable, omit its spoken number and explain the missing
coverage; never substitute a fixture metric.
