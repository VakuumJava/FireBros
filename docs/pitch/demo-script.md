# Demo Script (90 Seconds)

**Pre-recording checklist:**
- Open `Ala-Too Fire Calendar` with the footer attribution `NASA FIRMS — MODIS/VIIRS active fire data (2000–2026)` clearly visible.
- Verify the active data source badge (`parquet` or `mock`).

---

### 0:00–0:15 | The Problem & Regional Map
- **On-screen:** Landing view showing the interactive map of Kyrgyzstan and the surrounding belt (`bbox = [68.5, 38.4, 80.7, 43.7]`).
- **Voiceover:** "Satellite fire records break in 2012: switching from 1 km MODIS to 375 m VIIRS creates an artificial jump that makes fire activity look nearly twice as high. Ala-Too Fire Calendar aligns 27 years of observations onto a single `hotspot_days_1km` scale."

### 0:15–0:35 | AOI Selection & Year × Month Calendar
- **On-screen:** Draw a bounding box or polygon on the map (or enter `lat/lon` coordinates) to load the 2000–2026 matrix. Toggle the palette from `viridis` to `cividis`, then hover over a `null` cell and a `0` cell.
- **Voiceover:** "Draw any Area of Interest, and the API aggregates precomputed 0.25° grid cells in milliseconds. The calendar uses color-blind safe `viridis` and `cividis` palettes, while missing data (`null`) is rendered with a distinct pattern so it is never mistaken for zero."

### 0:35–0:55 | Month-to-Date Anomaly
- **On-screen:** Focus on the current-month anomaly card (e.g., `2026-11` with `days_observed: 14`).
- **Voiceover:** "Because the current month isn't finished yet, comparing it to full historical months would bias the anomaly downward. Instead, we truncate every past year to the exact same 14-day window and compute the deviation using a robust median and MAD."

### 0:55–1:15 | Before/After 2012 Harmonization & Validation
- **On-screen:** Open the harmonization chart, highlighting how the `raw` and `harmonized` curves diverge after 2012 along with the `[lo, hi]` confidence band.
- **Voiceover:** "Here is our core result: 0.01° deduplication and 2° × 2° tile-level calibration reduce the 2012 step jump from `[step_ratio_raw]` down to `[step_ratio_harmonized]`, while our placebo control year stays stable. Pre-2012 MODIS is shown as the reference baseline, and post-2012 estimates carry a 95% confidence band."

### 1:15–1:30 | CSV Export & Honest Limitations
- **On-screen:** Click the CSV download button (`kind=monthly` or `kind=hotspots`), then open the Limitations page.
- **Voiceover:** "Researchers can export either the monthly series or raw detections to CSV in one click. And on our Limitations page, we stay transparent: a hotspot is a 1 km² thermal anomaly, not a confirmed wildfire. Thank you!"
