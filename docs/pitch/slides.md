# Pitch Deck: Ala-Too Fire Calendar (7 Slides · NASA Space Apps Challenge 2026)

## Slide 1 — Title and summary (Relevance)
- **Project:** Ala-Too Fire Calendar
- **Team:** Team FireBros
- **Challenge:** [Selected NASA Challenge Name]
- **One-sentence value proposition:** A web application that delivers a continuous, scientifically calibrated 2000–2026 thermal-anomaly time series for any user-drawn Area of Interest in Kyrgyzstan and its neighboring belt, eliminating the artificial 2012 sensor jump between MODIS and VIIRS.

---

## Slide 2 — Problem (Impact)
- **The artificial 2012 jump:** When NASA FIRMS archives are concatenated directly, transitioning from **MODIS** (1 km resolution, since 2000) to **VIIRS** (375 m resolution, since 2012) creates a sharp, false surge in hotspot counts driven by finer spatial resolution rather than real fire activity.
- **Why it matters:** Multi-decade trend analysis breaks down, and current-season anomaly baselines become unreliable.
- **Regional scope:** `bbox = [68.5, 38.4, 80.7, 43.7]` (all of Kyrgyzstan plus the neighboring belt of UZ, KZ, TJ, and Xinjiang; ~600,000 km², 1,078 grid cells at `0.25°`).
- **Who is affected:** Emergency response agencies, forestry and agricultural managers (spring crop-residue burning and summer mountain fires), and climate/land-use researchers.

---

## Slide 3 — Solution (Creativity)
- **Unified metric across the entire product:** `hotspot_days_1km`—the daily sum of unique 1 km grid cells with at least one detection, used consistently across the calendar, anomaly card, charts, and CSV exports.
- **Fair month-to-date anomaly:** An ongoing month is compared against historical years truncated to the exact same `days_observed` window (`days <= through_day`) using robust statistics—median and `1.4826 × MAD`.
- **Transparent uncertainty:** Post-2012 calibrated values always display the `[lo, hi]` 95% confidence band alongside pre-2012 reference MODIS counts.
- **Accessible visualization:** The year × month calendar uses color-blind safe sequential palettes (`viridis` / `cividis`) and visually separates `null` (missing data) from `0` (observed with zero hotspots).

---

## Slide 4 — How it works (Validity)
- **Datasets:** NASA FIRMS active fire products—MODIS (2000–present), VIIRS (2012–present), and Near Real-Time (`NRT`) feeds (https://firms.modaps.eosdis.nasa.gov).
- **Harmonization pipeline:**
  1. **Resolution alignment:** Raw detections are snapped to a sensor-independent `0.01°` (~1.1 km) grid and deduplicated by `(cell, date)` prior to regression.
  2. **Overlap calibration (2012–2025):** Tile-level (`2° × 2°`, 21 tiles) and seasonal robust regression `log1p(MODIS) = a + b · log1p(VIIRS)` with shrinkage toward the global fit when `n` is small.
- **Tech stack:** Precomputed `0.25°` monthly aggregates in **Apache Parquet** → millisecond **FastAPI** spatial queries → interactive **React + Leaflet + Plotly** frontend.
- **Validation metrics (from `docs/method.md`, 2024–2025 hold-out):**
  - `step_ratio_raw`: **[INSERT FROM docs/method.md]**
  - `step_ratio_harmonized`: **[INSERT FROM docs/method.md]** (target: `0.95–1.05`)
  - `step_ratio_placebo`: **[INSERT FROM docs/method.md]**
  - `RMSE_log`: **[INSERT FROM docs/method.md]**
  - `MAPE`: **[INSERT FROM docs/method.md]**
- **AI usage disclosure:** AI assistants were used to accelerate boilerplate coding, code review, and documentation formatting; all mathematical formulations, API contracts, and validation checks remain human-verified.

---

## Slide 5 — Demo (Presentation)
- **Visual / Video:** [INSERT UI screenshot or 30-second demo video with English subtitles: draw AOI on map → year × month calendar → month-to-date anomaly → before/after 2012 harmonization chart → CSV export]
- **GitHub repository:** https://github.com/VakuumJava/FireBros
- **Live demo:** [Public unauthenticated demo link]

---

## Slide 6 — Impact and next steps (Impact + Relevance)
- **Practical value across 27 years of observations (2000–2026):**
  - **Emergency services:** Rapid assessment of current fire-season anomalies against a consistent 26-year baseline without sensor-transition artifacts.
  - **Agriculture & forestry:** Monitoring spring agricultural burning and summer mountain fire risk for any custom polygon or administrative region.
  - **Researchers:** Reproducible CSV exports (`kind=monthly` and `kind=hotspots`) with standardized units and metadata.
- **Post-hackathon roadmap:**
  - Automated scheduled NRT ingestion pipeline for continuous daily updates.
  - Threshold-based anomaly alerts for subscribed Areas of Interest.
  - Integration of ERA5 meteorological reanalysis (temperature, wind, soil moisture) and regional expansion beyond Central Asia.

---

## Slide 7 — Team and references (Required fields)
- **Team FireBros (Roles P1–P5):**
  - **P1:** Integration, API contract, code review, deployment
  - **P2:** Data engineering (FIRMS ingestion, `0.01°` deduplication, Parquet aggregates, CSV store)
  - **P3:** Science & validation (harmonization, tile-level calibration, uncertainty intervals, hold-out metrics)
  - **P4:** Frontend engineering (Leaflet map, AOI drawing, calendar heatmap, Plotly charts)
  - **P5:** Design, accessibility, limitations documentation, pitch & demo
- **Required data attribution:** NASA FIRMS — MODIS/VIIRS active fire data (2000–2026).
- **Open-source stack:** FastAPI, Apache Parquet / PyArrow, React, Leaflet / Leaflet.draw, Plotly.
- **Honest limitations disclosure:** A hotspot (1 km² thermal anomaly) ≠ a confirmed fire; clouds, smoke, and dust storms can mask or mimic detections; NRT feeds carry operational latency before archival refinement.
- **AI usage disclosure:** AI tools were used strictly as development aids for scaffolding, refactoring, and documentation; all scientific methods, figures from `docs/method.md`, and final deliverables were reviewed and validated by the team.
