from __future__ import annotations

import hashlib
import json
import random
from dataclasses import replace
from datetime import date
from pathlib import Path

from ..errors import DataUnavailable, TooManyRows
from ..geo import Aoi, point_in_polygon
from ..periods import YearMonth, days_in_month
from .base import MonthlyRecord

ROWS_PER_100_HOTSPOTS = 2
MAX_PLACEMENT_ATTEMPTS = 8


class MockStore:
    source = "mock"

    def __init__(self, contracts_dir: Path) -> None:
        fixtures = contracts_dir / "fixtures"
        try:
            summary = json.loads((fixtures / "aoi-summary.json").read_text(encoding="utf-8"))
            harmonization = json.loads(
                (fixtures / "aoi-harmonization.json").read_text(encoding="utf-8")
            )
        except FileNotFoundError as exc:
            raise DataUnavailable(f"mock fixtures not found under {fixtures}") from exc

        self._records = _merge(summary, harmonization)

    def records(self, aoi: Aoi, start: YearMonth, end: YearMonth) -> list[MonthlyRecord]:
        share = aoi.area_share
        return [
            _scale(record, share)
            for record in self._records
            if start <= (record.year, record.month) <= end
        ]

    def prefix_records(
        self, aoi: Aoi, start: YearMonth, end: YearMonth, through_day: int
    ) -> list[MonthlyRecord]:
        return [
            replace(
                record,
                count=round(record.count * through_day / record.days_observed),
                days_observed=through_day,
            )
            for record in self.records(aoi, start, end)
            if record.days_observed >= through_day
        ]

    def hotspots(
        self,
        aoi: Aoi,
        start: YearMonth,
        end: YearMonth,
        limit: int,
    ) -> list[dict[str, object]]:
        share = aoi.area_share
        rows: list[dict[str, object]] = []

        for record in self._records:
            if not start <= (record.year, record.month) <= end:
                continue
            count = round(record.count * share)
            if count <= 0:
                continue
            wanted = max(1, round(count * ROWS_PER_100_HOTSPOTS / 100))
            for index in range(wanted):
                if len(rows) >= limit:
                    raise TooManyRows("more hotspots than the export limit; narrow the AOI")
                row = _hotspot(record, index, aoi)
                if row is not None:
                    rows.append(row)
        return rows


def _merge(summary: dict, harmonization: dict) -> list[MonthlyRecord]:
    observed = {(row["year"], row["month"]): row for row in summary["series"]}
    merged: dict[tuple[int, int], MonthlyRecord] = {}

    for row in harmonization["series"]:
        key = (row["year"], row["month"])
        base = observed.get(key)
        if base is None:
            continue
        merged[key] = MonthlyRecord(
            year=row["year"],
            month=row["month"],
            count=row["harmonized"],
            lo=row["lo"],
            hi=row["hi"],
            raw=row["raw"],
            modis=row["raw"] if row["sensor"] == "MODIS" else row.get("modis_truth"),
            sensor=row["sensor"],
            days_observed=base["days_observed"],
        )
    return [merged[key] for key in sorted(merged)]


def _scale(record: MonthlyRecord, share: float) -> MonthlyRecord:
    if share >= 1:
        return record

    count = round(record.count * share)
    return MonthlyRecord(
        year=record.year,
        month=record.month,
        count=count,
        lo=min(count, round(record.lo * share)),
        hi=max(count, round(record.hi * share)),
        raw=round(record.raw * share),
        modis=None if record.modis is None else round(record.modis * share),
        sensor=record.sensor,
        days_observed=record.days_observed,
    )


def _rng(*parts: object) -> random.Random:
    digest = hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()
    return random.Random(int(digest[:16], 16))


def _hotspot(record: MonthlyRecord, index: int, aoi: Aoi) -> dict[str, object] | None:
    rng = _rng(aoi.id, record.year, record.month, index)
    west, south, east, north = aoi.bbox

    lon = lat = 0.0
    for _ in range(MAX_PLACEMENT_ATTEMPTS):
        lon = rng.uniform(west, east)
        lat = rng.uniform(south, north)
        if aoi.polygon is None or point_in_polygon(lon, lat, aoi.polygon):
            break
    else:
        return None

    day = rng.randint(1, days_in_month(record.year, record.month))
    viirs = record.sensor != "MODIS"
    return {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "acq_date": date(record.year, record.month, day).isoformat(),
        "acq_time": f"{rng.randrange(24):02d}{rng.randrange(60):02d}",
        "satellite": "N" if viirs else rng.choice("TA"),
        "instrument": "VIIRS" if viirs else "MODIS",
        "sensor_family": record.sensor,
        "confidence": rng.choice(("l", "n", "h")) if viirs else rng.randint(30, 100),
        "frp": round(rng.uniform(0.4, 45.0), 1),
        "daynight": rng.choice(("D", "D", "D", "N")),
        "grid_cell": f"{lat:.2f}_{lon:.2f}",
    }
