from __future__ import annotations

import numpy as np
import pandas as pd

from .config import GRID_COLS, GRID_ROWS
from .grid import cell_days

LONG_COLUMNS = [
    "grid_row",
    "grid_col",
    "year",
    "month",
    "sensor",
    "hotspot_days",
    "days_observed",
    "n_detections",
]


def aggregate(detections: pd.DataFrame, coverage: pd.DataFrame) -> pd.DataFrame:
    detections = detections.merge(
        coverage[["sensor_family", "acq_date"]], on=["sensor_family", "acq_date"], how="inner"
    )
    unique = cell_days(detections)
    coverage = coverage.assign(year=coverage.acq_date.dt.year, month=coverage.acq_date.dt.month)
    counts = _monthly_counts(unique, "hotspot_days")
    raw = _monthly_counts(detections, "n_detections")
    months = coverage.groupby(["sensor_family", "year", "month"], as_index=False).agg(
        days_observed=("acq_date", "nunique")
    )
    cells = pd.DataFrame(
        {
            "grid_row": np.repeat(np.arange(GRID_ROWS), GRID_COLS),
            "grid_col": np.tile(np.arange(GRID_COLS), GRID_ROWS),
        }
    )
    result = months.merge(cells, how="cross")
    keys = ["sensor_family", "year", "month", "grid_row", "grid_col"]
    result = result.merge(counts, on=keys, how="left").merge(raw, on=keys, how="left")
    for column in ["hotspot_days", "n_detections"]:
        result[column] = result[column].fillna(0).astype("int64")
    return (
        result.rename(columns={"sensor_family": "sensor"})[LONG_COLUMNS]
        .sort_values(["year", "month", "grid_row", "grid_col", "sensor"])
        .reset_index(drop=True)
    )


def _monthly_counts(frame, name):
    frame = frame.assign(year=frame.acq_date.dt.year, month=frame.acq_date.dt.month)
    keys = ["sensor_family", "year", "month", "grid_row", "grid_col"]
    return frame.groupby(keys, as_index=False).size().rename(columns={"size": name})


def cumulative_year(detections: pd.DataFrame, coverage: pd.DataFrame, year: int) -> pd.DataFrame:
    detections = detections.loc[detections.acq_date.dt.year.eq(year)]
    detections = detections.merge(
        coverage[["sensor_family", "acq_date"]], on=["sensor_family", "acq_date"], how="inner"
    )
    unique = cell_days(detections)
    coverage = coverage.loc[coverage.acq_date.dt.year.eq(year)].copy()
    coverage["month"] = coverage.acq_date.dt.month
    parts = []
    for (sensor, month), observed in coverage.groupby(["sensor_family", "month"]):
        days = pd.Timestamp(year, month, 1).days_in_month
        rows = np.repeat(np.arange(GRID_ROWS), GRID_COLS)
        cols = np.tile(np.arange(GRID_COLS), GRID_ROWS)
        hot = np.zeros((days, GRID_ROWS * GRID_COLS), dtype="int64")
        raw = np.zeros_like(hot)
        for frame, target in ((unique, hot), (detections, raw)):
            selected = frame.loc[frame.sensor_family.eq(sensor) & frame.acq_date.dt.month.eq(month)]
            if not selected.empty:
                np.add.at(
                    target,
                    (
                        selected.acq_date.dt.day.to_numpy() - 1,
                        selected.grid_row.to_numpy() * GRID_COLS + selected.grid_col.to_numpy(),
                    ),
                    1,
                )
        known = np.zeros(days, dtype="int64")
        known[observed.acq_date.dt.day.unique() - 1] = 1
        observed_prefix = np.cumsum(known)
        hot, raw = np.cumsum(hot, axis=0), np.cumsum(raw, axis=0)
        prefixes = np.flatnonzero(observed_prefix > 0)
        parts.append(
            pd.DataFrame(
                {
                    "grid_row": np.tile(rows, len(prefixes)),
                    "grid_col": np.tile(cols, len(prefixes)),
                    "year": year,
                    "month": month,
                    "sensor": sensor,
                    "through_day": np.repeat(prefixes + 1, len(rows)),
                    "hotspot_days": hot[prefixes].reshape(-1),
                    "days_observed": np.repeat(observed_prefix[prefixes], len(rows)),
                    "n_detections": raw[prefixes].reshape(-1),
                }
            )
        )
    return (
        pd.concat(parts, ignore_index=True)
        if parts
        else pd.DataFrame(columns=[*LONG_COLUMNS, "through_day"])
    )
