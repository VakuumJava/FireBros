from __future__ import annotations

import pytest

REGION = "68.5,38.4,80.7,43.7"


@pytest.mark.parametrize(
    "params",
    [
        {"bbox": "0,0,1,1"},
        {"bbox": "68.5,38.4,80.7"},
        {"bbox": "nan,38.4,80.7,43.7"},
        {"bbox": "-170,-80,170,80"},
        {"bbox": REGION, "polygon": "74.4,42.7;75.4,42.7;75.4,43.3"},
        {"polygon": "74.4,42.7;75.4,42.7"},
        {"polygon": "74.4,42.7;75.4,42.7;75.4,90"},
    ],
)
def test_bad_aoi_is_rejected(client, params):
    response = client.get("/api/v1/aoi/summary", params=params)
    assert response.status_code == 422
    assert response.json()["detail"]


@pytest.mark.parametrize(
    "params",
    [
        {"from": "2010-13"},
        {"from": "1999-01"},
        {"from": "2020-01", "to": "2019-12"},
        {"from": "2010-01", "to": "2100-01"},
    ],
)
def test_bad_period_is_rejected(client, params):
    response = client.get("/api/v1/aoi/summary", params=params)
    assert response.status_code == 422


def test_future_month_has_no_anomaly(client):
    response = client.get("/api/v1/aoi/anomaly", params={"month": "2099-01"})
    assert response.status_code == 422


def test_aoi_narrows_with_the_drawn_box(client):
    whole = client.get("/api/v1/aoi/summary", params={"from": "2014-01", "to": "2014-12"}).json()
    part = client.get(
        "/api/v1/aoi/summary",
        params={"bbox": "74.0,42.5,75.5,43.2", "from": "2014-01", "to": "2014-12"},
    ).json()

    assert part["aoi"]["cells_inside"] < whole["aoi"]["cells_inside"]
    assert part["totals"]["hotspot_days"] < whole["totals"]["hotspot_days"]
    assert part["aoi"]["id"] != whole["aoi"]["id"]


def test_polygon_is_more_specific_than_its_bbox(client):
    polygon = "74.0,42.5;75.5,42.5;75.5,43.2;74.0,43.2"
    box = "74.0,42.5,75.5,43.2"
    by_polygon = client.get("/api/v1/aoi/summary", params={"polygon": polygon}).json()
    by_box = client.get("/api/v1/aoi/summary", params={"bbox": box}).json()

    assert by_polygon["aoi"]["kind"] == "polygon"
    assert by_polygon["aoi"]["cells_partial"] >= 0
    assert by_polygon["aoi"]["area_km2"] <= by_box["aoi"]["area_km2"]


def test_health_does_not_leak_paths(client):
    payload = client.get("/api/v1/meta/health").json()
    assert payload["source"] == "mock"
    assert "data_dir" not in payload
    assert not any(
        isinstance(value, str) and "/" in value and "data" in value for value in payload.values()
    )
