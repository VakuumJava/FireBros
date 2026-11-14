from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from .config import (
    COUNTRIES,
    FINE_DEG,
    GRID_COLS,
    GRID_DEG,
    GRID_ROWS,
    REGION,
    SENSOR_START,
    file_sha256,
)

REQUIRED_COLUMNS = {
    "latitude",
    "longitude",
    "acq_date",
    "acq_time",
    "satellite",
    "instrument",
    "confidence",
    "frp",
    "daynight",
}
DEDUP_COLUMNS = ["sensor_family", "latitude", "longitude", "acq_date", "acq_time"]


def normalize(frame: pd.DataFrame, sensor: str | None = None) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS.difference(frame.columns)
    if missing:
        raise ValueError(f"FIRMS input missing columns: {', '.join(sorted(missing))}")
    frame = frame.copy()
    for column in ("latitude", "longitude", "frp"):
        frame[column] = pd.to_numeric(frame[column], errors="raise")
        if not np.isfinite(frame[column]).all():
            raise ValueError(f"Non-finite FIRMS {column}")
    if not frame.latitude.between(-90, 90).all() or not frame.longitude.between(-180, 180).all():
        raise ValueError("FIRMS coordinate outside valid geographic range")
    frame["acq_date"] = pd.to_datetime(
        frame.acq_date, format="%Y-%m-%d", errors="raise"
    ).dt.normalize()
    time = frame.acq_time.astype("string").str.replace(r"\.0$", "", regex=True).str.zfill(4)
    if not time.str.fullmatch(r"\d{4}").fillna(False).all():
        raise ValueError("FIRMS acquisition time must be HHMM in UTC")
    valid_time = time.str[:2].astype(int).between(0, 23) & time.str[2:].astype(int).between(0, 59)
    if not valid_time.all():
        raise ValueError("FIRMS acquisition time must be HHMM in UTC")
    frame["acq_time"] = time
    frame["instrument"] = frame.instrument.astype(str).str.upper()
    frame["satellite"] = frame.satellite.astype(str)
    if sensor is not None:
        frame["sensor_family"] = sensor
    else:
        frame["sensor_family"] = np.where(frame.instrument.eq("MODIS"), "MODIS", "VIIRS_SNPP")
        frame.loc[frame.satellite.str.upper().isin(["N20", "NOAA-20", "1"]), "sensor_family"] = (
            "VIIRS_NOAA20"
        )
        frame.loc[frame.satellite.str.upper().isin(["N21", "NOAA-21", "2"]), "sensor_family"] = (
            "VIIRS_NOAA21"
        )
    if not frame.instrument.isin(["MODIS", "VIIRS"]).all():
        raise ValueError("Only MODIS and VIIRS detections are supported")
    frame["confidence"] = frame.confidence.astype(str)
    frame["daynight"] = frame.daynight.astype(str).str.upper()
    if not frame.daynight.isin(["D", "N"]).all():
        raise ValueError("FIRMS daynight must be D or N")
    west, south, east, north = REGION
    frame = frame.loc[
        frame.longitude.between(west, east) & frame.latitude.between(south, north)
    ].copy()
    if (frame.frp < 0).any():
        raise ValueError("Regional FIRMS FRP must be non-negative")
    fine_col = np.floor((frame.longitude.to_numpy() - west + 1e-9) / FINE_DEG).astype("int32")
    fine_row = np.floor((frame.latitude.to_numpy() - south + 1e-9) / FINE_DEG).astype("int32")
    fine_col = np.minimum(fine_col, round((east - west) / FINE_DEG) - 1)
    fine_row = np.minimum(fine_row, round((north - south) / FINE_DEG) - 1)
    frame["fine_row"] = fine_row
    frame["fine_col"] = fine_col
    frame["grid_row"] = np.minimum(fine_row // round(GRID_DEG / FINE_DEG), GRID_ROWS - 1)
    frame["grid_col"] = np.minimum(fine_col // round(GRID_DEG / FINE_DEG), GRID_COLS - 1)
    frame["grid_cell"] = frame.grid_row.astype(str) + ":" + frame.grid_col.astype(str)
    return frame


def load_inputs(paths: list[Path], start: date, end: date, assume_complete: bool = False):
    frames, coverage_parts, inputs, science_coverage = [], [], [], []
    country_groups: dict[tuple[str, str, str], list[dict]] = {}
    for path in sorted(paths):
        metadata_path = path.with_suffix(".json")
        metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
        if (
            metadata.get("coverage_start")
            and metadata.get("coverage_end")
            and (
                date.fromisoformat(metadata["coverage_end"]) < start
                or date.fromisoformat(metadata["coverage_start"]) > end
            )
        ):
            continue
        digest = file_sha256(path)
        if metadata.get("sha256") and metadata["sha256"] != digest:
            raise ValueError(f"Raw input checksum mismatch: {path.name}")
        inputs.append(
            {
                "path": str(path),
                "sha256": digest,
                "source": metadata.get("source", "local FIRMS CSV"),
            }
        )
        if metadata_path.exists():
            inputs.append(
                {
                    "path": str(metadata_path),
                    "sha256": file_sha256(metadata_path),
                    "source": "FIRMS source coverage and acquisition metadata",
                }
            )
        parts = []
        for chunk in pd.read_csv(
            path, chunksize=100_000, dtype={"acq_time": "string", "confidence": "string"}
        ):
            regional = normalize(chunk, metadata.get("sensor"))
            regional = regional.loc[
                regional.acq_date.between(pd.Timestamp(start), pd.Timestamp(end))
            ]
            if not regional.empty:
                parts.append(regional)
        frame = pd.concat(parts, ignore_index=True) if parts else None
        if frame is not None:
            product = metadata.get("product", "")
            frame["_quality"] = 0 if product.endswith("_NRT") else 1
            frames.append(frame)
        if metadata.get("coverage_start") and metadata.get("coverage_end"):
            if not metadata.get("product", "").endswith("_NRT"):
                science_coverage.append(
                    _coverage(
                        metadata["sensor"],
                        metadata["coverage_start"],
                        metadata["coverage_end"],
                        start,
                        end,
                    )
                )
            if metadata.get("country"):
                key = (metadata["sensor"], metadata["coverage_start"], metadata["coverage_end"])
                country_groups.setdefault(key, []).append(metadata)
            else:
                coverage_parts.append(
                    _coverage(
                        metadata["sensor"],
                        metadata["coverage_start"],
                        metadata["coverage_end"],
                        start,
                        end,
                    )
                )
        elif frame is not None:
            for sensor, group in frame.groupby("sensor_family"):
                if assume_complete:
                    coverage_parts.append(
                        _coverage(
                            sensor, max(start, SENSOR_START.get(sensor, start)), end, start, end
                        )
                    )
                else:
                    coverage_parts.append(group[["sensor_family", "acq_date"]].drop_duplicates())
    for (sensor, first, last), metadata in country_groups.items():
        if {item["country"] for item in metadata} != set(COUNTRIES):
            raise ValueError(f"Incomplete annual country group for {sensor} {first}")
        coverage_parts.append(_coverage(sensor, first, last, start, end))
    if not coverage_parts:
        raise ValueError("No input coverage in the requested period")
    coverage = (
        pd.concat(coverage_parts, ignore_index=True)
        .drop_duplicates()
        .sort_values(["sensor_family", "acq_date"])
        .reset_index(drop=True)
    )
    roots = {
        parent
        for path in paths
        for parent in path.parents
        if (parent / "missing_data.json").is_file()
    }
    for root in sorted(roots):
        missing_path = root / "missing_data.json"
        missing = pd.DataFrame(json.loads(missing_path.read_text())["missing"])
        if not missing.empty:
            missing["acq_date"] = pd.to_datetime(missing.acq_date)
            missing = missing[["sensor_family", "acq_date"]].drop_duplicates().assign(_missing=True)
            coverage = coverage.merge(missing, on=["sensor_family", "acq_date"], how="left")
            coverage = coverage.loc[coverage._missing.isna()].drop(columns="_missing")
        inputs.append(
            {
                "path": str(missing_path),
                "sha256": file_sha256(missing_path),
                "source": "NASA FIRMS missing-data catalog",
            }
        )
    if frames:
        detections = pd.concat(frames, ignore_index=True)
        if science_coverage:
            science = (
                pd.concat(science_coverage, ignore_index=True)
                .drop_duplicates()
                .assign(_science=True)
            )
            detections = detections.merge(science, on=["sensor_family", "acq_date"], how="left")
            detections = detections.loc[
                ~((detections._quality == 0) & detections._science.fillna(False).astype(bool))
            ].drop(columns="_science")
        detections = (
            detections.sort_values("_quality", kind="stable")
            .drop_duplicates(DEDUP_COLUMNS, keep="last")
            .drop(columns="_quality")
            .sort_values(DEDUP_COLUMNS)
            .reset_index(drop=True)
        )
    else:
        detections = normalize(pd.DataFrame(columns=sorted(REQUIRED_COLUMNS)))
    return detections, coverage, inputs


def _coverage(sensor, first, last, start, end):
    first, last = (
        max(pd.Timestamp(first), pd.Timestamp(start)),
        min(pd.Timestamp(last), pd.Timestamp(end)),
    )
    return pd.DataFrame({"sensor_family": sensor, "acq_date": pd.date_range(first, last)})


def cell_days(detections: pd.DataFrame) -> pd.DataFrame:
    keys = ["sensor_family", "acq_date", "fine_row", "fine_col"]
    return (
        detections.drop_duplicates(keys)[[*keys, "grid_row", "grid_col"]]
        .sort_values(keys)
        .reset_index(drop=True)
    )
