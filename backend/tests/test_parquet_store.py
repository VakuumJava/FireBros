from __future__ import annotations

from pathlib import Path

import duckdb
import pytest
from app.config import Settings
from app.errors import TooManyRows
from app.geo import describe_aoi, parse_polygon, polygon_bbox
from app.main import create_app
from app.store import clear_store_cache
from app.store.parquet import ParquetStore
from fastapi.testclient import TestClient

CELL_DDL = """
    CREATE TABLE cells (
        grid_row INTEGER,
        grid_col INTEGER,
        year INTEGER,
        month INTEGER,
        sensor VARCHAR,
        hotspot_days INTEGER,
        hotspot_days_lo INTEGER,
        hotspot_days_hi INTEGER,
        hotspot_days_raw INTEGER,
        hotspot_days_modis INTEGER,
        days_observed INTEGER
    )
"""

HOTSPOT_DDL = """
    CREATE TABLE hotspots (
        latitude DOUBLE,
        longitude DOUBLE,
        acq_date VARCHAR,
        acq_time VARCHAR,
        satellite VARCHAR,
        instrument VARCHAR,
        sensor_family VARCHAR,
        confidence VARCHAR,
        frp DOUBLE,
        daynight VARCHAR,
        grid_cell VARCHAR
    )
"""

CELL_ROWS = [
    (0, 0, 2012, 1, "VIIRS_SNPP", 100, 80, 120, 180, 110, 31),
    (0, 1, 2012, 1, "VIIRS_SNPP", 150, 120, 180, 270, 165, 31),
    (0, 2, 2012, 1, "VIIRS_SNPP", 999, 900, 1100, 1800, 1000, 31),
]

HOTSPOT_ROWS = [
    (38.55, 68.60, "2012-01-04", "0715", "N", "VIIRS", "VIIRS_SNPP", "h", 12.4, "D", "38.55_68.60"),
    (38.58, 68.64, "2012-01-05", "1130", "N", "VIIRS", "VIIRS_SNPP", "n", 3.1, "D", "38.58_68.64"),
    (38.50, 68.72, "2012-01-06", "0700", "N", "VIIRS", "VIIRS_SNPP", "l", 1.2, "D", "38.50_68.72"),
    (38.10, 68.60, "2012-01-07", "0700", "N", "VIIRS", "VIIRS_SNPP", "l", 0.9, "D", "38.10_68.60"),
]


def _copy(connection: duckdb.DuckDBPyConnection, table: str, rows: list[tuple], path: Path) -> None:
    connection.executemany(f"INSERT INTO {table} VALUES ({','.join('?' * len(rows[0]))})", rows)
    connection.execute(f"COPY {table} TO '{path.as_posix()}' (FORMAT PARQUET)")


@pytest.fixture()
def data_dir(tmp_path: Path) -> Path:
    hot_dir = tmp_path / "hotspots"
    hot_dir.mkdir()
    with duckdb.connect() as connection:
        connection.execute(CELL_DDL)
        _copy(connection, "cells", CELL_ROWS, tmp_path / "cells_monthly.parquet")
        connection.execute(HOTSPOT_DDL)
        _copy(connection, "hotspots", HOTSPOT_ROWS, hot_dir / "part.parquet")
    return tmp_path


@pytest.fixture()
def parquet_settings(data_dir: Path) -> Settings:
    clear_store_cache()
    return Settings(
        data_dir=data_dir,
        contracts_dir=Path(__file__).resolve().parents[2] / "contracts",
        cors_origins=(),
        csv_max_rows=5_000,
        polygon_scan_rows=20_000,
        max_span_months=400,
        holdout_years=(2024, 2025),
    )


@pytest.fixture()
def parquet_client(parquet_settings: Settings) -> TestClient:
    return TestClient(create_app(parquet_settings))


def test_records_sum_only_cells_inside_the_aoi(parquet_settings):
    store = ParquetStore(parquet_settings)
    aoi = describe_aoi((68.5, 38.4, 69.0, 38.65))

    records = store.records(aoi, (2012, 1), (2012, 1))

    assert len(records) == 1
    assert records[0].count == 250
    assert records[0].raw == 450
    assert records[0].modis == 275
    assert records[0].days_observed == 31


def test_polygon_aoi_uses_the_cell_list(parquet_settings):
    polygon = parse_polygon("68.50,38.40;68.75,38.40;68.75,38.65;68.50,38.65")
    store = ParquetStore(parquet_settings)
    aoi = describe_aoi(polygon_bbox(polygon), polygon)

    records = store.records(aoi, (2012, 1), (2012, 1))

    assert records[0].count == 100


def test_hotspots_are_filtered_by_polygon(parquet_settings):
    store = ParquetStore(parquet_settings)
    box = describe_aoi((68.5, 38.4, 69.0, 38.65))
    polygon = parse_polygon("68.50,38.40;68.66,38.40;68.66,38.65;68.50,38.65")
    shaped = describe_aoi(polygon_bbox(polygon), polygon)

    assert len(store.hotspots(box, (2012, 1), (2012, 1), 100)) == 3
    assert len(store.hotspots(shaped, (2012, 1), (2012, 1), 100)) == 2


def test_hotspot_limit_is_enforced(parquet_settings):
    store = ParquetStore(parquet_settings)
    aoi = describe_aoi((68.5, 38.4, 69.0, 38.65))

    with pytest.raises(TooManyRows):
        store.hotspots(aoi, (2012, 1), (2012, 1), 1)


def test_api_serves_parquet_instead_of_mock(parquet_client):
    health = parquet_client.get("/api/v1/meta/health").json()
    assert health["source"] == "parquet"
    assert health["data_ready"] is True

    summary = parquet_client.get(
        "/api/v1/aoi/summary",
        params={"bbox": "68.5,38.4,69.0,38.65", "from": "2012-01", "to": "2012-01"},
    ).json()

    assert summary["series"][0]["count"] == 250
    assert summary["series"][0]["sensor"] == "VIIRS_SNPP"
