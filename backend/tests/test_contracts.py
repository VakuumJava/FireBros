from __future__ import annotations

import pytest

ENDPOINTS = [
    ("/api/v1/aoi/summary", "aoi-summary.schema.json"),
    ("/api/v1/aoi/calendar", "aoi-calendar.schema.json"),
    ("/api/v1/aoi/anomaly", "aoi-anomaly.schema.json"),
    ("/api/v1/aoi/top", "aoi-top.schema.json"),
    ("/api/v1/aoi/harmonization", "aoi-harmonization.schema.json"),
]


@pytest.mark.parametrize(("path", "schema"), ENDPOINTS)
def test_default_payload_matches_contract(client, validate, path, schema):
    response = client.get(path)
    assert response.status_code == 200, response.text
    validate(response.json(), schema)


@pytest.mark.parametrize(("path", "schema"), ENDPOINTS)
def test_polygon_payload_matches_contract(client, validate, path, schema):
    params = {
        "polygon": "74.4,42.7;75.4,42.7;75.4,43.3;74.4,43.3",
        "from": "2015-01",
        "to": "2016-12",
    }
    response = client.get(path, params=params)
    assert response.status_code == 200, response.text
    validate(response.json(), schema)


def test_summary_covers_every_month_of_the_period(client):
    response = client.get("/api/v1/aoi/summary", params={"from": "2010-01", "to": "2011-12"})
    payload = response.json()
    assert payload["period"]["months"] == 24
    assert len(payload["series"]) == 24
    assert payload["coverage"]["months_expected"] == 24


def test_calendar_rows_align_with_years(client):
    payload = client.get("/api/v1/aoi/calendar").json()
    assert len(payload["values"]) == len(payload["years"])
    assert all(len(row) == 12 for row in payload["values"])
    assert payload["max"] == max(value for row in payload["values"] for value in row if value)


def test_harmonization_proves_the_knot_is_gone(client):
    jump = client.get("/api/v1/aoi/harmonization").json()["jump"]
    assert jump["step_ratio_raw"] > 1.5
    assert abs(jump["step_ratio_harmonized"] - 1.0) < 0.1
    assert abs(jump["step_ratio_placebo"] - 1.0) < 0.1


def test_anomaly_of_a_partial_month_is_month_to_date(client):
    payload = client.get("/api/v1/aoi/anomaly", params={"month": "2026-11"}).json()
    assert payload["partial"] is True
    assert payload["through_day"] < 31
    assert payload["baseline"]["window"] == f"same month, days <= {payload['through_day']}"
