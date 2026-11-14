from dataclasses import replace

import duckdb
import pytest
from app.errors import DataUnavailable
from app.geo import GeoError, describe_aoi, parse_polygon
from app.main import create_app
from app.service import anomaly
from app.store import store_for
from app.store.base import MonthlyRecord
from app.store.parquet import ParquetStore
from fastapi.testclient import TestClient


class PrefixStore:
    source = "parquet"

    def records(self, aoi, start, end):
        return [
            MonthlyRecord(2023, 11, 200, 200, 200, 200, None, "MODIS", 30),
            MonthlyRecord(2024, 11, 200, 200, 200, 200, None, "MODIS", 30),
            MonthlyRecord(2025, 11, 90, 80, 100, 160, 80, "VIIRS_SNPP", 14),
        ]

    def prefix_records(self, aoi, start, end, through_day):
        assert through_day == 14
        return [
            MonthlyRecord(2023, 11, 10, 10, 10, 10, None, "MODIS", 14),
            MonthlyRecord(2024, 11, 30, 30, 30, 30, None, "MODIS", 14),
            MonthlyRecord(2025, 11, 90, 80, 100, 160, 80, "VIIRS_SNPP", 14),
        ]


def test_partial_anomaly_uses_actual_prefix_counts():
    result = anomaly(describe_aoi((68.5, 38.4, 69, 38.65)), (2025, 11), PrefixStore())
    assert result.baseline.median == 20
    assert [p.count for p in result.series] == [10, 30, 90]
    assert result.baseline.window == "same month, days <= 14"


def test_partial_anomaly_refuses_missing_prefix_artifact():
    store = PrefixStore()
    store.prefix_records = None
    with pytest.raises(DataUnavailable):
        anomaly(describe_aoi((68.5, 38.4, 69, 38.65)), (2025, 11), store)


@pytest.mark.parametrize(
    "polygon",
    [
        "68.5,38.4;69,39;68.5,39;69,38.4",
        "68.5,38.4;69,38.4;70,38.4",
        "68.5,38.4;69,39;69,39;68.5,39",
    ],
)
def test_invalid_polygon_geometry_rejected(polygon):
    with pytest.raises(GeoError):
        parse_polygon(polygon)


def test_thin_polygon_crossing_cell_is_included():
    shape = parse_polygon("68.501,38.5;69.249,38.505;69.249,38.51;68.501,38.505")
    aoi = describe_aoi((68.501, 38.5, 69.249, 38.51), shape)
    assert {(c.row, c.col) for c in aoi.cells} == {(0, 0), (0, 1), (0, 2)}


def test_missing_dataset_refused_when_required(settings):
    with pytest.raises(DataUnavailable):
        store_for(replace(settings, require_data=True))


def test_production_rejects_missing_or_tampered_manifest(settings):
    settings.cells_path.write_bytes(b"not a parquet")
    with pytest.raises(DataUnavailable, match="integrity"):
        ParquetStore(replace(settings, require_data=True))


def test_store_errors_do_not_disclose_paths(settings):
    with pytest.raises(DataUnavailable) as error:
        ParquetStore(settings).records(describe_aoi((68.5, 38.4, 69, 38.65)), (2020, 1), (2020, 1))
    assert str(settings.data_dir) not in str(error.value)
    assert "SELECT" not in str(error.value)


def test_api_security_headers(client):
    response = client.get("/api/v1/meta/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["cache-control"] == "no-store"
    policy = response.headers["content-security-policy"]
    assert "script-src 'self'" in policy
    assert "frame-ancestors 'none'" in policy
    assert "unsafe-eval" not in policy


def test_rejections_carry_security_headers(client):
    response = client.get("/api/v1/aoi/summary?unused=" + "a" * 24_001)
    assert response.status_code == 414
    assert "content-security-policy" in response.headers


def test_static_assets_are_cached_by_fingerprint(tmp_path, monkeypatch, settings):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>atlas</title>")
    (tmp_path / "assets" / "index-3f2a.js").write_text("export {};")
    monkeypatch.setenv("FIREBROS_STATIC_DIR", str(tmp_path))
    with TestClient(create_app(settings)) as static_client:
        page = static_client.get("/")
        asset = static_client.get("/assets/index-3f2a.js")
    assert page.headers["cache-control"] == "no-cache"
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert "content-security-policy" in page.headers


def test_interactive_docs_are_disabled_but_schema_is_published(client):
    assert client.get("/docs").status_code == 404
    assert client.get("/api/v1/openapi.json").status_code == 200


def test_parquet_queries_cannot_read_outside_the_snapshot(settings):
    store = ParquetStore(settings)
    with pytest.raises(DataUnavailable):
        store._query("SELECT * FROM read_csv(?)", ["/etc/passwd"])


def test_oversized_query_rejected(client):
    assert client.get("/api/v1/aoi/summary?unused=" + "a" * 24_001).status_code == 414


def test_csv_formula_neutralized_after_whitespace():
    from app.export import render_csv

    output = render_csv([{"value": "  =HYPERLINK(1)"}], ["value"]).decode("utf-8-sig")
    assert "'  =HYPERLINK(1)" in output


def test_partial_cell_coverage_does_not_report_complete_month(tmp_path, settings):
    with duckdb.connect() as connection:
        connection.execute(
            """
            COPY (SELECT 0 AS grid_row, 0 AS grid_col, 2020 AS year, 1 AS month,
            'MODIS' AS sensor, 3 AS hotspot_days, 3 AS hotspot_days_lo,
            3 AS hotspot_days_hi, 3 AS hotspot_days_raw, NULL::INTEGER AS hotspot_days_modis,
            31 AS days_observed) TO ? (FORMAT PARQUET)
        """,
            [str(tmp_path / "cells_monthly.parquet")],
        )
    store = ParquetStore(settings)
    result = store.records(describe_aoi((68.5, 38.4, 69, 38.65)), (2020, 1), (2020, 1))
    assert result[0].days_observed == 0
