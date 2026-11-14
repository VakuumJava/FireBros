from __future__ import annotations

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
           CASE WHEN COUNT(hotspot_days_modis) = 0 THEN NULL
                ELSE SUM(hotspot_days_modis) END AS modis,
           MAX(sensor) AS sensor,
           MAX(days_observed) AS days_observed
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
     LIMIT ?
"""


class ParquetStore:
    source = "parquet"

    def __init__(self, settings: Settings) -> None:
        self._cells_path = str(settings.cells_path)
        self._hotspots_glob = str(settings.hotspots_path())
        self._scan_limit = settings.polygon_scan_rows

    def records(self, aoi: Aoi, start: YearMonth, end: YearMonth) -> list[MonthlyRecord]:
        cells_filter, cells_params = _cell_filter(aoi)
        params: list[Any] = [
            self._cells_path,
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
                days_observed=int(row[8] or 0),
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

    @staticmethod
    def _query(sql: str, params: list[Any]) -> list[tuple]:
        try:
            with duckdb.connect() as connection:
                return connection.execute(sql, params).fetchall()
        except duckdb.Error as exc:
            raise DataUnavailable(f"parquet store is not readable: {exc}") from exc


def _cell_filter(aoi: Aoi) -> tuple[str, list[int]]:
    if aoi.polygon is None:
        rows = [cell.row for cell in aoi.cells]
        cols = [cell.col for cell in aoi.cells]
        condition = "grid_row BETWEEN ? AND ? AND grid_col BETWEEN ? AND ?"
        return condition, [min(rows), max(rows), min(cols), max(cols)]

    keys = sorted({cell.row * 1000 + cell.col for cell in aoi.cells})
    placeholders = ",".join("?" * len(keys))
    return f"(grid_row * 1000 + grid_col) IN ({placeholders})", keys
