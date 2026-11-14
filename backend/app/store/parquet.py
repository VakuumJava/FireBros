from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import duckdb

from ..columns import HOTSPOT_COLUMNS
from ..config import Settings
from ..errors import DataUnavailable, TooManyRows
from ..geo import Aoi, point_in_polygon
from ..periods import YearMonth, month_bounds
from .base import MonthlyRecord

RECORDS_SQL = """
    SELECT year,
           month,
           SUM(hotspot_days) AS count,
           SUM(hotspot_days_lo) AS lo,
           SUM(hotspot_days_hi) AS hi,
           SUM(hotspot_days_raw) AS raw,
           CASE WHEN COUNT(hotspot_days_modis) != COUNT(*) THEN NULL
                ELSE SUM(hotspot_days_modis) END AS modis,
           MAX(sensor) AS sensor,
           MIN(days_observed) AS days_observed,
           COUNT(*) AS cells_present
      FROM read_parquet(?)
     WHERE {cells}
       AND year * 100 + month BETWEEN ? AND ?
     GROUP BY year, month
     ORDER BY year, month
"""

HOTSPOTS_SQL = """
    SELECT latitude, longitude, acq_date, acq_time, satellite, instrument,
           sensor_family, confidence, frp, daynight, grid_cell
      FROM read_parquet(?)
     WHERE latitude BETWEEN ? AND ?
       AND longitude BETWEEN ? AND ?
       AND acq_date BETWEEN ? AND ?
     ORDER BY acq_date, acq_time, latitude, longitude, sensor_family
     LIMIT ?
"""


class ParquetStore:
    source = "parquet"

    def __init__(self, settings: Settings) -> None:
        self._root = f"{settings.data_dir.resolve()}{os.sep}"
        self._cells_path = str(settings.cells_path)
        self._hotspots_glob = str(settings.hotspots_path())
        self._scan_limit = settings.polygon_scan_rows
        self._cumulative_path = settings.data_dir / "cells_cumulative.parquet"
        self._manifest_path = settings.data_dir / "manifest.json"
        if settings.require_data:
            self._verify_snapshot(settings.data_dir)

    def _verify_snapshot(self, root: Path) -> None:
        try:
            manifest = json.loads(self._manifest_path.read_text())
            outputs = manifest["outputs"]
            if "cells_monthly.parquet" not in outputs:
                raise ValueError("monthly product is not in the manifest")
            for relative, expected in outputs.items():
                path = (root / relative).resolve()
                if not path.is_relative_to(root.resolve()):
                    raise ValueError("output is outside the snapshot")
                with path.open("rb") as stream:
                    digest = hashlib.file_digest(stream, "sha256").hexdigest()
                if digest != expected:
                    raise ValueError("checksum mismatch")
        except (OSError, KeyError, ValueError, TypeError):
            raise DataUnavailable(
                "dataset snapshot is missing or fails integrity verification"
            ) from None

    def describe(self) -> dict[str, object]:
        rows = self._query(
            "SELECT MIN(year * 100 + month), MAX(year * 100 + month), COUNT(*) "
            "FROM read_parquet(?) WHERE days_observed > 0",
            [self._cells_path],
        )
        first, last, count = rows[0]
        result = {
            "first_month": _year_month(first),
            "last_month": _year_month(last),
            "monthly_rows": count,
            "exact_prefixes": self._cumulative_path.is_file(),
        }
        if self._manifest_path.is_file():
            try:
                manifest = json.loads(self._manifest_path.read_text())
                result["built_at"] = manifest.get("created_at") or manifest.get("generated_at")
                result["method_version"] = manifest.get("method_version")
            except (OSError, ValueError):
                raise DataUnavailable("dataset manifest is invalid") from None
        return result

    def prefix_records(
        self, aoi: Aoi, start: YearMonth, end: YearMonth, through_day: int
    ) -> list[MonthlyRecord]:
        if not self._cumulative_path.is_file():
            raise DataUnavailable("exact month-to-date aggregates are not installed")
        return self._records(aoi, start, end, self._cumulative_path, through_day)

    def records(self, aoi: Aoi, start: YearMonth, end: YearMonth) -> list[MonthlyRecord]:
        return self._records(aoi, start, end, Path(self._cells_path))

    def _records(
        self,
        aoi: Aoi,
        start: YearMonth,
        end: YearMonth,
        path: Path,
        through_day: int | None = None,
    ) -> list[MonthlyRecord]:
        cells_filter, cells_params = _cell_filter(aoi)
        if through_day is not None:
            cells_filter += " AND through_day = ?"
            cells_params.append(through_day)
        params: list[Any] = [
            str(path),
            *cells_params,
            start[0] * 100 + start[1],
            end[0] * 100 + end[1],
        ]
        rows = self._query(RECORDS_SQL.format(cells=cells_filter), params)
        return [
            MonthlyRecord(
                year=row[0],
                month=row[1],
                count=int(row[2] or 0),
                lo=int(row[3] or 0),
                hi=int(row[4] or 0),
                raw=int(row[5] or 0),
                modis=None if row[6] is None else int(row[6]),
                sensor=str(row[7]),
                days_observed=int(row[8] or 0) if row[9] == len(aoi.cells) else 0,
            )
            for row in rows
        ]

    def hotspots(
        self,
        aoi: Aoi,
        start: YearMonth,
        end: YearMonth,
        limit: int,
    ) -> list[dict[str, object]]:
        west, south, east, north = aoi.bbox
        first_day, _ = month_bounds(*start)
        _, last_day = month_bounds(*end)
        scan_limit = min(limit, self._scan_limit) if aoi.polygon else limit

        params: list[Any] = [
            self._hotspots_glob,
            south,
            north,
            west,
            east,
            first_day,
            last_day,
            scan_limit + 1,
        ]
        rows = self._query(HOTSPOTS_SQL, params)

        if len(rows) > scan_limit:
            raise TooManyRows("too many hotspots to scan; narrow the AOI or the period")

        points = [dict(zip(HOTSPOT_COLUMNS, row, strict=True)) for row in rows]
        if aoi.polygon is not None:
            points = [
                point
                for point in points
                if point_in_polygon(
                    float(point["longitude"]), float(point["latitude"]), aoi.polygon
                )
            ]
        if len(points) > limit:
            raise TooManyRows("more hotspots than the export limit; narrow the AOI")
        return points

    def _query(self, sql: str, params: list[Any]) -> list[tuple]:
        try:
            with duckdb.connect(config={"threads": 2, "memory_limit": "128MB"}) as connection:
                connection.execute("SET allowed_directories = ?", [[self._root]])
                connection.execute("SET enable_external_access = false")
                connection.execute("SET lock_configuration = true")
                return connection.execute(sql, params).fetchall()
        except duckdb.Error as exc:
            raise DataUnavailable("data store is unavailable; contact the operator") from exc


def _cell_filter(aoi: Aoi) -> tuple[str, list[int]]:
    if aoi.polygon is None:
        rows = [cell.row for cell in aoi.cells]
        cols = [cell.col for cell in aoi.cells]
        condition = "grid_row BETWEEN ? AND ? AND grid_col BETWEEN ? AND ?"
        return condition, [min(rows), max(rows), min(cols), max(cols)]

    keys = sorted({cell.row * 1000 + cell.col for cell in aoi.cells})
    placeholders = ",".join("?" * len(keys))
    return f"(grid_row * 1000 + grid_col) IN ({placeholders})", keys


def _year_month(value: int | None) -> str | None:
    return f"{value // 100:04d}-{value % 100:02d}" if value is not None else None
