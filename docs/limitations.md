# Data and Method Limitations

**Ala-Too Fire Calendar** unifies satellite fire observations from 2000 to 2026 onto a single `hotspot_days_1km` scale across `bbox = [68.5, 38.4, 80.7, 43.7]`. To interpret the calendar, anomaly metrics, and time-series charts accurately, keep these six limitations in mind:

1. **Hotspot ≠ confirmed fire.** A satellite detection represents ~1 km² of thermal anomaly (including spring agricultural burning and industrial heat sources), not a confirmed wildfire.
2. **Clouds, smoke, and dust storms.** Dense cloud cover and thick smoke from large fires can mask nearby active burning, while dust storms and sun glint can occasionally produce false detections.
3. **Harmonization is an estimate, not a direct measurement.** VIIRS observations (from 2012 onward) are calibrated into MODIS 1 km equivalents using `2° × 2°` tile- and season-level regression. Charts after 2012 always display the `[lo, hi]` 95% uncertainty interval; prior to 2012, MODIS serves as the reference scale (`lo == hi == count`).
4. **Incomplete current month.** Anomalies are calculated strictly month-to-date using `days_observed`—historical years are truncated to the same day-of-month window (`days <= through_day`), preventing an artificial negative bias for an ongoing month.
5. **NRT data latency.** Near Real-Time (`MODIS_NRT`, `VIIRS_SNPP_NRT`) detections arrive with operational latency and are later refined when superseded by standard science-quality (`SP`) archives. Recent months are flagged as `nrt`.
6. **Observation gaps (`null` ≠ `0`).** In the year × month calendar, `0` indicates valid observations with zero detected hotspots, whereas `null` (rendered with a distinct pattern) indicates missing data for that period.

---

**Data attribution:**  
NASA FIRMS — MODIS/VIIRS active fire data (2000–2026).
