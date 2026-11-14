from __future__ import annotations

import hashlib
import json
import os
from datetime import date
from pathlib import Path

REGION = (68.5, 38.4, 80.7, 43.7)
GRID_DEG = 0.25
FINE_DEG = 0.01
GRID_ROWS = 22
GRID_COLS = 49
NASA_BASE = "https://firms.modaps.eosdis.nasa.gov"
COUNTRIES = ("China", "Kazakhstan", "Kyrgyzstan", "Tajikistan", "Uzbekistan")
SENSORS = {"modis": "MODIS", "viirs-snpp": "VIIRS_SNPP", "viirs-jpss1": "VIIRS_NOAA20"}
SENSOR_START = {
    "MODIS": date(2000, 11, 1),
    "VIIRS_SNPP": date(2012, 1, 20),
    "VIIRS_NOAA20": date(2018, 4, 1),
}
HOTSPOT_COLUMNS = (
    "latitude",
    "longitude",
    "acq_date",
    "acq_time",
    "satellite",
    "instrument",
    "sensor_family",
    "confidence",
    "frp",
    "daynight",
    "grid_cell",
)
MONTHLY_COLUMNS = (
    "grid_row",
    "grid_col",
    "year",
    "month",
    "sensor",
    "hotspot_days",
    "hotspot_days_lo",
    "hotspot_days_hi",
    "hotspot_days_raw",
    "hotspot_days_modis",
    "days_observed",
    "n_detections",
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, sort_keys=True, indent=2, allow_nan=False) + "\n")
    os.replace(temporary, path)
