from __future__ import annotations

import calendar

import numpy as np
import pandas as pd
import pytest
from firebros.harmonize import apply_calibration, harmonize
from firebros.validate import validate


def archive() -> pd.DataFrame:
    rows = []
    for year in range(2008, 2026):
        for month in range(1, 13):
            for column in range(3):
                count = 10 + month * 4 + (year - 2008) * 3 + column
                for sensor in ["MODIS", "VIIRS_SNPP"] if year >= 2012 else ["MODIS"]:
                    rows.append(
                        {
                            "year": year,
                            "month": month,
                            "grid_row": 0,
                            "grid_col": column,
                            "sensor": sensor,
                            "hotspot_days": count if sensor == "MODIS" else 2 * count + 1,
                            "days_observed": calendar.monthrange(year, month)[1],
                            "n_detections": count * 2,
                        }
                    )
    return pd.DataFrame(rows)


def test_harmonization_learns_known_log_relationship_and_validates_holdout():
    monthly = archive()
    unified, calibration = harmonize(monthly)
    report = validate(monthly, unified, calibration)
    assert report["holdout"]["mape"] < 0.02
    assert 0.99 <= report["holdout"]["harmonized_to_modis"] <= 1.01
    assert report["holdout"]["coverage_95"] >= 0.9
    assert report["status"] == "evaluated"
    assert len(unified) == 18 * 12 * 3
    assert (unified.hotspot_days_lo <= unified.hotspot_days).all()
    assert (unified.hotspot_days <= unified.hotspot_days_hi).all()
    old = unified[unified.year < 2012]
    assert (old.hotspot_days == old.hotspot_days_raw).all()
    assert (old.hotspot_days_lo == old.hotspot_days_hi).all()


def test_holdout_does_not_change_fitted_coefficients():
    data = archive()
    extra = data[data.year == 2025].copy()
    extra["year"] = 2026
    data = pd.concat([data, extra], ignore_index=True)
    _, first = harmonize(data)
    data.loc[data.year.isin([2024, 2025, 2026]), "hotspot_days"] *= 10
    _, second = harmonize(data)
    pd.testing.assert_frame_equal(first, second)


def test_regression_is_robust_to_isolated_sensor_outliers():
    clean = archive()
    _, first = harmonize(clean)
    clean.loc[
        (clean.year == 2014) & (clean.sensor == "MODIS") & (clean.month == 4), "hotspot_days"
    ] = 1000000
    _, second = harmonize(clean)
    np.testing.assert_allclose(
        first.iloc[0][["a", "b"]].to_numpy(float),
        second.iloc[0][["a", "b"]].to_numpy(float),
        atol=0.02,
    )


def test_zero_viirs_stays_zero_and_missing_month_is_not_created():
    data = archive()
    data.loc[(data.year == 2025) & (data.month == 1), "hotspot_days"] = 0
    data = data[~((data.year == 2025) & (data.month == 2))]
    unified, calibration = harmonize(data)
    assert (unified[(unified.year == 2025) & (unified.month == 1)].hotspot_days == 0).all()
    assert unified[(unified.year == 2025) & (unified.month == 2)].empty
    assert not calibration.empty


def test_prefixes_reuse_fit_without_training_on_incomplete_months():
    data = archive()
    _, calibration = harmonize(data)
    prefixes = data.copy()
    prefixes["through_day"] = 10
    prefixes["days_observed"] = 10
    prefixes["hotspot_days"] //= 3
    unified = apply_calibration(prefixes, calibration, reference_monthly=data)
    assert (unified.through_day == 10).all()
    assert (unified.days_observed == 10).all()
    with pytest.raises(ValueError, match="12 active complete overlap"):
        harmonize(prefixes)


def test_uncalibrated_viirs_fails_and_modis_only_passes():
    data = archive()
    with pytest.raises(ValueError, match="12 active complete overlap"):
        harmonize(data[data.sensor == "VIIRS_SNPP"])
    unified, calibration = harmonize(data[data.sensor == "MODIS"])
    assert calibration.empty
    assert (unified.hotspot_days == unified.hotspot_days_raw).all()
    assert validate(data[data.sensor == "MODIS"], unified, calibration)["status"] == "unvalidated"


def test_duplicate_negative_and_nonfinite_counts_rejected():
    data = archive()
    with pytest.raises(ValueError, match="duplicate"):
        harmonize(pd.concat([data, data.iloc[:1]]))
    for invalid in [-1, np.nan, np.inf, 1.25]:
        data.loc[0, "hotspot_days"] = invalid
        with pytest.raises(ValueError, match="finite nonnegative integers"):
            harmonize(data)


def test_reports_observed_steps_without_forcing_acceptance():
    data = archive()
    unified, calibration = harmonize(data)
    report = validate(data, unified, calibration)
    assert report["acceptance"]["sensor_ratio_within_5_percent"]
    assert not report["acceptance"]["temporal_step_within_5_percent"]
    assert report["step_ratio_placebo"] is None


def test_temporal_step_is_judged_against_native_modis_and_later_years_are_prospective():
    data = archive()
    later = data[data.year == 2025].copy()
    later["year"] = 2026
    data = pd.concat([data, later], ignore_index=True)
    unified, calibration = harmonize(data)
    report = validate(data, unified, calibration)

    assert report["step_ratio_raw"] > 1.5
    assert report["step_ratio_modis"] == pytest.approx(report["step_ratio_harmonized"], rel=0.02)
    assert report["acceptance"]["temporal_step_tracks_modis_within_5_percent"]
    assert report["holdout"]["wape"] < 0.02
    assert report["prospective"]["years"] == [2026]
    assert report["prospective"]["cell"]["n"] == 36
    assert report["prospective"]["region"]["wape"] < 0.02
    roles = {entry["year"]: entry["role"] for entry in report["overlap_by_year"]}
    assert roles[2012] == "training"
    assert roles[2024] == roles[2025] == "holdout"
    assert roles[2026] == "prospective"


def test_incomplete_modis_is_not_reported_as_validation_truth():
    data = archive()
    data.loc[
        (data.sensor == "MODIS") & (data.year == 2025) & (data.month == 4), "days_observed"
    ] = 10
    unified, _ = harmonize(data)
    month = unified[(unified.year == 2025) & (unified.month == 4)]
    assert (month.sensor == "VIIRS_SNPP").all()
    assert month.hotspot_days_modis.isna().all()


def test_more_complete_modis_prevents_comparing_missing_viirs_days():
    data = archive()
    data.loc[
        (data.sensor == "VIIRS_SNPP") & (data.year == 2025) & (data.month == 4), "days_observed"
    ] = 10
    unified, _ = harmonize(data)
    month = unified[(unified.year == 2025) & (unified.month == 4)]
    assert (month.sensor == "MODIS").all()
    assert (month.hotspot_days == month.hotspot_days_modis).all()


def test_cumulative_predictions_are_monotone_and_close_at_month_end():
    data = archive()
    monthly, calibration = harmonize(data)
    source = data[(data.year == 2025) & (data.month == 1)].copy()
    frames = []
    for day in range(1, 32):
        prefix = source.copy()
        prefix["hotspot_days"] = prefix.hotspot_days * day // 31
        prefix["days_observed"] = day
        prefix["through_day"] = day
        frames.append(prefix)
    cumulative = apply_calibration(
        pd.concat(frames, ignore_index=True), calibration, reference_monthly=data
    )
    for _, cell in cumulative.groupby(["grid_row", "grid_col"]):
        assert (np.diff(cell.sort_values("through_day").hotspot_days) >= 0).all()
    final = cumulative[cumulative.through_day == 31].hotspot_days.to_numpy()
    expected = monthly[(monthly.year == 2025) & (monthly.month == 1)].hotspot_days.to_numpy()
    np.testing.assert_array_equal(final, expected)


def test_sparse_counts_allocate_tile_totals_without_input_order_dependence():
    data = archive()
    data = data[data.year < 2024].copy()
    for column in range(3, 20):
        empty = data[data.grid_col == 0].copy()
        empty["grid_col"] = column
        empty["hotspot_days"] = 0
        data = pd.concat([data, empty], ignore_index=True)
    unified, calibration = harmonize(data)
    shuffled, shuffled_calibration = harmonize(data.sample(frac=1, random_state=18))
    pd.testing.assert_frame_equal(unified, shuffled)
    pd.testing.assert_frame_equal(calibration, shuffled_calibration)
    assert (unified[unified.grid_col >= 3].hotspot_days == 0).all()
    paired = unified[unified.year >= 2012]
    ratio = paired.hotspot_days.sum() / paired.hotspot_days_modis.sum()
    assert 0.99 <= ratio <= 1.01
