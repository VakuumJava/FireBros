from __future__ import annotations

MONTHLY_HEADER = [
    "year",
    "month",
    "count",
    "lo",
    "hi",
    "sensor",
    "harmonized",
    "days_observed",
    "days_in_month",
]

HOTSPOT_HEADER = [
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
]


def test_monthly_export_has_bom_and_contract_columns(client):
    response = client.get(
        "/api/v1/aoi/export.csv",
        params={"kind": "monthly", "from": "2015-01", "to": "2015-12"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["x-row-count"] == "12"
    assert response.headers["x-unit"] == "hotspot_days_1km"
    assert "attachment" in response.headers["content-disposition"]

    text = response.content.decode("utf-8")
    assert text.startswith("\ufeff")
    lines = text.lstrip("\ufeff").splitlines()
    assert lines[0].split(",") == MONTHLY_HEADER
    assert len(lines) == 13


def test_hotspot_export_returns_detections(client):
    response = client.get(
        "/api/v1/aoi/export.csv",
        params={"bbox": "74.0,42.5,75.5,43.2", "from": "2015-01", "to": "2015-03"},
    )

    assert response.status_code == 200
    assert response.headers["x-unit"] == "detections"
    assert int(response.headers["x-row-count"]) > 0

    lines = response.content.decode("utf-8").lstrip("\ufeff").splitlines()
    assert lines[0].split(",") == HOTSPOT_HEADER
    assert len(lines) == int(response.headers["x-row-count"]) + 1


def test_export_beyond_the_row_cap_is_refused(client):
    response = client.get("/api/v1/aoi/export.csv", params={"from": "2000-01", "to": "2026-11"})

    assert response.status_code == 413
    assert "narrow" in response.json()["detail"]
