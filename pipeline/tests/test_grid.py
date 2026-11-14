from datetime import date

import pandas as pd
import pytest
from firebros.aggregate import aggregate, cumulative_year
from firebros.grid import cell_days, load_inputs, normalize


def detection_frame():
    return pd.DataFrame(
        {
            "latitude": [40.0001, 40.0002, 40.0001, 40.0001],
            "longitude": [74.0001, 74.0002, 74.0001, 74.0001],
            "acq_date": ["2024-10-01", "2024-10-01", "2024-10-02", "2024-10-31"],
            "acq_time": ["0100", "0200", "0100", "0100"],
            "satellite": ["Terra"] * 4,
            "instrument": ["MODIS"] * 4,
            "confidence": [80] * 4,
            "frp": [5.5] * 4,
            "daynight": ["N"] * 4,
        }
    )


def test_unique_fine_cell_days_and_exact_prefix():
    detections = normalize(detection_frame())
    coverage = pd.DataFrame(
        {"sensor_family": "MODIS", "acq_date": pd.date_range("2024-10-01", "2024-10-31")}
    )
    assert len(cell_days(detections)) == 3
    monthly = aggregate(detections, coverage)
    assert monthly.hotspot_days.sum() == 3
    assert monthly.n_detections.sum() == 4
    prefix = cumulative_year(detections, coverage, 2024)
    assert prefix.loc[prefix.through_day.eq(2), "hotspot_days"].sum() == 2
    assert prefix.loc[prefix.through_day.eq(30), "hotspot_days"].sum() == 2
    assert prefix.loc[prefix.through_day.eq(31), "hotspot_days"].sum() == 3


def test_missing_days_are_not_assumed_zero(tmp_path):
    path = tmp_path / "fires.csv"
    detection_frame().to_csv(path, index=False)
    _, coverage, _ = load_inputs([path], date(2024, 10, 1), date(2024, 10, 31))
    assert len(coverage) == 3
    _, coverage, _ = load_inputs(
        [path], date(2024, 10, 1), date(2024, 10, 31), assume_complete=True
    )
    assert len(coverage) == 31


def test_invalid_time_and_coordinates_rejected():
    bad = detection_frame()
    bad.loc[0, "acq_time"] = "2460"
    with pytest.raises(ValueError, match="HHMM"):
        normalize(bad)
    bad = detection_frame()
    bad.loc[0, "latitude"] = 95
    with pytest.raises(ValueError, match="geographic"):
        normalize(bad)


def test_region_northeast_boundary_stays_inside_grid():
    raw = detection_frame().iloc[:1].copy()
    raw.loc[0, ["latitude", "longitude"]] = [43.7, 80.7]
    result = normalize(raw)
    assert result.grid_row.iloc[0] == 21
    assert result.grid_col.iloc[0] == 48


def test_science_quality_wins_duplicate_near_real_time(tmp_path):
    import json

    raw = detection_frame().iloc[:1].copy()
    for name, frp, product in (("nrt", 100, "MODIS_NRT"), ("science", 10, "MODIS_SP")):
        raw["frp"] = frp
        path = tmp_path / f"{name}.csv"
        raw.to_csv(path, index=False)
        path.with_suffix(".json").write_text(json.dumps({"product": product, "sensor": "MODIS"}))
    result, _, _ = load_inputs(
        sorted(tmp_path.glob("*.csv")), date(2024, 10, 1), date(2024, 10, 31)
    )
    assert len(result) == 1
    assert result.frp.iloc[0] == 10


def test_published_outage_does_not_become_zero_fire_day(tmp_path):
    import json

    path = tmp_path / "fires.csv"
    detection_frame().to_csv(path, index=False)
    (tmp_path / "missing_data.json").write_text(
        json.dumps({"missing": [{"sensor_family": "MODIS", "acq_date": "2024-10-02"}]})
    )
    detections, coverage, _ = load_inputs(
        [path], date(2024, 10, 1), date(2024, 10, 31), assume_complete=True
    )
    monthly = aggregate(detections, coverage)
    assert monthly.days_observed.min() == 30
    assert monthly.hotspot_days.sum() == 2


def test_science_replaces_nrt_date_even_when_coordinates_change(tmp_path):
    import json

    for name, latitude, product in (("nrt", 40.01, "MODIS_NRT"), ("science", 40.02, "MODIS_SP")):
        raw = detection_frame().iloc[:1].copy()
        raw["latitude"] = latitude
        path = tmp_path / f"{name}.csv"
        raw.to_csv(path, index=False)
        path.with_suffix(".json").write_text(
            json.dumps(
                {
                    "product": product,
                    "sensor": "MODIS",
                    "coverage_start": "2024-10-01",
                    "coverage_end": "2024-10-01",
                }
            )
        )
    result, _, _ = load_inputs(
        sorted(tmp_path.glob("*.csv")), date(2024, 10, 1), date(2024, 10, 31)
    )
    assert len(result) == 1
    assert result.latitude.iloc[0] == 40.02


def test_outside_region_invalid_frp_does_not_reject_regional_data():
    raw = detection_frame().iloc[:2].copy()
    raw.loc[1, ["latitude", "longitude", "frp"]] = [30.1, 101.0, -0.5]
    result = normalize(raw)
    assert len(result) == 1


def test_verified_empty_window_is_observed_zero(tmp_path):
    import json

    path = tmp_path / "zero.csv"
    detection_frame().iloc[:0].to_csv(path, index=False)
    path.with_suffix(".json").write_text(
        json.dumps(
            {
                "sensor": "MODIS",
                "product": "MODIS_SP",
                "coverage_start": "2010-10-01",
                "coverage_end": "2010-10-05",
            }
        )
    )
    detections, coverage, _ = load_inputs([path], date(2010, 10, 1), date(2010, 10, 31))
    monthly = aggregate(detections, coverage)
    assert len(monthly) == 1078
    assert monthly.hotspot_days.sum() == 0
    assert monthly.days_observed.min() == 5
