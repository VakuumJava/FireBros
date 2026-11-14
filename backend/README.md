# Backend

FastAPI service that turns precomputed monthly cell aggregates into the five
AOI responses the frontend needs. No database, no runtime aggregation over raw
detections: a request sums Parquet cells.

## Run

```bash
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements-dev.txt   # Windows
# .venv/bin/pip install -r backend/requirements-dev.txt    # Linux/macOS

.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

Without `data/processed/cells_monthly.parquet` the service starts on fixtures
and reports `"source": "mock"` in every payload and in `/api/v1/meta/health`.
That is a deliberate state, not a failure: the UI is developed against it.

## Test

```bash
.venv/Scripts/python -m pytest
.venv/Scripts/python -m ruff check .
.venv/Scripts/python -m ruff format --check .
```

Contract tests validate every response against `contracts/*.schema.json`, so a
field drifting out of the frozen contract fails CI, not the demo.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `FIREBROS_DATA_DIR` | `data/processed` | where `cells_monthly.parquet` and `hotspots/` live |
| `FIREBROS_CONTRACTS_DIR` | `contracts` | fixtures for mock mode |
| `FIREBROS_CORS` | `http://localhost:5173,http://127.0.0.1:5173` | comma-separated allowlist, never `*` with credentials |
| `FIREBROS_CSV_MAX_ROWS` | `100000` | hard cap on the hotspot export |
| `FIREBROS_POLYGON_SCAN_ROWS` | `100000` | rows scanned before a polygon export is refused |
| `FIREBROS_MAX_SPAN_MONTHS` | `400` | widest accepted `from`/`to` window |

No secret is read here. `FIRMS_MAP_KEY` belongs to the pipeline only.

## Storage contract this service expects

`cells_monthly.parquet`, one row per (cell, month):

| Column | Type | Meaning |
|---|---|---|
| `grid_row`, `grid_col` | int | 0.25 deg cell index from the region's south-west corner |
| `year`, `month` | int | observation month |
| `sensor` | str | sensor behind the unified series: `MODIS`, `VIIRS_SNPP`, ... |
| `hotspot_days` | int | harmonized count in MODIS scale, the product unit |
| `hotspot_days_lo`, `hotspot_days_hi` | int | 95% band; equal to `hotspot_days` for MODIS |
| `hotspot_days_raw` | int | sensor-native count, drives the before/after chart |
| `hotspot_days_modis` | int, null | native MODIS count when the month has one; the validation truth |
| `days_observed` | int | days of the month present in the data |
| `n_detections` | int | raw detections, diagnostics only |

`hotspots/*.parquet`, partitioned by year, columns:
`latitude`, `longitude`, `acq_date`, `acq_time`, `satellite`, `instrument`,
`sensor_family`, `confidence`, `frp`, `daynight`, `grid_cell`.

Anything else in those files is ignored. Renaming a column here means renaming
it in the pipeline in the same PR.

## Layout

```
app/
  main.py        application factory, CORS, error mapping
  config.py      settings from environment, frozen
  geo.py         region, grid cells, AOI parsing, polygon geometry
  periods.py     YYYY-MM arithmetic
  models.py      response models mirroring contracts/
  service.py     summary / calendar / anomaly / top / harmonization
  stats.py       median, MAD, robust z, step ratio, error metrics
  export.py      CSV rendering with BOM and formula-injection guard
  store/         mock (fixtures) and parquet (DuckDB) implementations
  routers/       thin HTTP layer
```

The routers never compute anything: parsing and HTTP codes live there, the
maths lives in `service.py`, and data access lives behind `Store`.
## Production integrity

`FIREBROS_REQUIRE_DATA=true` returns 503 if the dataset is absent. `FIREBROS_MAX_CONCURRENT_QUERIES` defaults to 8 (Compose uses 8). DuckDB is limited to 128MB per query; the container also caps aggregate memory. An empty `FIREBROS_CORS` disables CORS. `FIREBROS_STATIC_DIR` serves the built frontend from the API origin.

`cells_cumulative.parquet` contains the monthly storage columns plus `through_day`; it supports exact observed prefixes. A partial anomaly without this artifact returns 503, never a prorated historical estimate. All selected cells must have coverage before a month is presented as observed. Health exposes available first/last months, not server filesystem paths. CSV includes `X-Data-Source` and `X-Method-Version`. `/aoi/top` optionally accepts the same `from`/`to` filters.

Build into a separate directory and restart workers against the complete snapshot. Never replace live Parquet files individually.

With `FIREBROS_REQUIRE_DATA=true`, the store verifies manifest SHA-256 hashes once before serving the snapshot. A checksum mismatch produces 503. These checks detect corruption; they do not authenticate artifacts produced by an untrusted operator.
