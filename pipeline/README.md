# FIRMS preprocessing

The pipeline reads NASA FIRMS detections, deduplicates native detections, counts
unique 0.01° cell-days and writes 0.25° monthly products in the API contract.
Scientific calibration and its held-out evaluation are separate modules. All
outputs include a manifest with SHA-256 hashes of every input and output.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r pipeline/requirements.txt
PYTHONPATH=pipeline python -m firebros.build --download archive
```

`--download archive` uses NASA's public annual country CSVs for China,
Kazakhstan, Kyrgyzstan, Tajikistan and Uzbekistan, the five countries intersecting
the analysis bounding box. No API key is required. Incomplete current calendar
years are not treated as complete annual archives. Raw files are kept intact;
normalization filters them to the bounding box in chunks.

For the full history including current-year data, set `FIRMS_MAP_KEY` in the
process environment and run `--download all`: annual archives and current-year
API windows are fetched, then the full archive is calibrated in one build.
Use `--download api --start 2026-01-01 --download-only` to refresh current-year
inputs separately, followed by a build with the full history date range. The API driver queries published product
availability and fetches both standard and near-real-time products in windows
of at most five days. Keys are absent from logs, manifests, and filenames.
Retries are bounded and science downloads are resumable using verified checksums.
Near-real-time windows are always refreshed because their contents can change.
The public FIRMS missing-data table is snapshotted and listed outage days are
excluded from analysis coverage, while original detections remain in CSV exports.

Local exports can be placed under `data/raw/` and built without downloading.
Without sidecar coverage metadata, only dates that contain detections are known.
`--assume-complete` explicitly asserts that local exports cover every requested
calendar day. Use it only for complete regional exports, including zero-fire days.
Never infer observation availability from the absence of fires.

```bash
PYTHONPATH=pipeline python -m firebros.build --start 2000-11-01 --end 2025-12-31
PYTHONPATH=pipeline python -m pytest pipeline/tests
```

Outputs in `data/processed/`:

- `cells_monthly.parquet`: unified cell/month counts and prediction intervals.
- `cells_cumulative.parquet`: the same counts for each day-of-month prefix,
  used for exact windows by the anomaly endpoint. Prefix calibration uses the
  monthly model, so partial-month calibration has additional model uncertainty.
- `sensor_monthly.parquet`, `calibration.parquet`: reproducibility and review.
- `coverage.parquet`: covered source dates, distinct from cloud-free coverage.
- `hotspots/{year}.parquet`: original deduplicated detections for CSV exports.
- `harmonization_report.json`: measured hold-out metrics and diagnostic gates.
- `manifest.json`: acquisition dates, hashes, provenance and method version.

Annual source catalog: https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt

NASA download documentation: https://firms.modaps.eosdis.nasa.gov/download/

NASA Area API: https://firms.modaps.eosdis.nasa.gov/api/area/

Identical inputs and dependency versions produce identical Parquet bytes; build
metadata timestamps and duration intentionally differ. Publish the completed
processed directory as one deployment snapshot. Restart API workers after
replacing a snapshot; never rebuild files underneath live workers.
