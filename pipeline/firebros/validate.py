from __future__ import annotations

import calendar

import numpy as np
import pandas as pd

from .harmonize import HOLDOUT_YEARS, KEYS, METHOD_VERSION, _with_groups, paired_months, predict

KNOT_YEAR = 2012
PLACEBO_YEAR = 2010
STEP_TOLERANCE = 0.05


def _number(value: float) -> float | None:
    return round(float(value), 6) if np.isfinite(value) else None


def _ratio(numerator: pd.Series, denominator: pd.Series) -> float | None:
    total = float(denominator.sum())
    return _number(float(numerator.sum()) / total) if total > 0 else None


def _within(value: float | None) -> bool:
    return value is not None and abs(value - 1.0) <= STEP_TOLERANCE


def _complete_months(frame: pd.DataFrame) -> pd.DataFrame:
    lengths = [
        calendar.monthrange(int(year), int(month))[1]
        for year, month in zip(frame.year, frame.month, strict=True)
    ]
    return frame[frame.days_observed == lengths]


def _coverage(truth: np.ndarray, lower: np.ndarray, upper: np.ndarray) -> float | None:
    return _number(np.mean((truth >= lower) & (truth <= upper))) if len(truth) else None


def error_metrics(truth: np.ndarray, estimate: np.ndarray) -> dict[str, int | float | None]:
    positive = truth > 0
    errors = np.log1p(estimate) - np.log1p(truth)
    relative = (estimate[positive] - truth[positive]) / truth[positive]
    return {
        "n": len(truth),
        "n_positive_truth": int(positive.sum()),
        "rmse_log": _number(np.sqrt(np.mean(errors**2))) if len(truth) else None,
        "mape": _number(np.mean(np.abs(relative))) if positive.any() else None,
        "wape": _number(np.abs(estimate - truth).sum() / truth.sum()) if positive.any() else None,
        "bias": _number(np.mean(relative)) if positive.any() else None,
        "mae": _number(np.mean(np.abs(estimate - truth))) if len(truth) else None,
    }


def step_ratio(unified: pd.DataFrame, column: str, knot: int) -> float | None:
    totals = unified.groupby(["year", "month"])[column].sum()
    ratios = []
    for month in range(1, 13):
        current = totals.get((knot, month))
        previous = [totals.get((year, month)) for year in range(knot - 3, knot)]
        if current is None or any(value is None for value in previous):
            continue
        baseline = float(np.median(previous))
        if baseline > 0:
            ratios.append(float(current) / baseline)
    return _number(np.median(ratios)) if ratios else None


def _year_role(year: int) -> str:
    if year in HOLDOUT_YEARS:
        return "holdout"
    return "prospective" if year > max(HOLDOUT_YEARS) else "training"


def _by_year(matched: pd.DataFrame) -> list[dict[str, object]]:
    columns = ["hotspot_days_viirs", "hotspot_days", "hotspot_days_modis"]
    return [
        {
            "year": int(year),
            "role": _year_role(int(year)),
            "n": len(group),
            "raw_to_modis": _ratio(group.hotspot_days_viirs, group.hotspot_days_modis),
            "harmonized_to_modis": _ratio(group.hotspot_days, group.hotspot_days_modis),
        }
        for year, group in matched[["year", *columns]].groupby("year")
    ]


def _out_of_sample(pairs: pd.DataFrame, calibration: pd.DataFrame) -> dict[str, dict]:
    source = pairs[[*KEYS, "hotspot_days_viirs", "days_observed_viirs", "n_detections_viirs"]]
    source = source.rename(
        columns={
            "hotspot_days_viirs": "hotspot_days",
            "days_observed_viirs": "days_observed",
            "n_detections_viirs": "n_detections",
        }
    ).assign(sensor="VIIRS_SNPP")
    estimated = predict(source, calibration)
    truth = pairs.hotspot_days_modis.to_numpy(float)
    estimate = estimated.hotspot_days.to_numpy(float)
    cells = {
        **error_metrics(truth, estimate),
        "coverage_95": _coverage(
            truth, estimated.hotspot_days_lo.to_numpy(), estimated.hotspot_days_hi.to_numpy()
        ),
        "raw_to_modis": _ratio(pairs.hotspot_days_viirs, pairs.hotspot_days_modis),
        "harmonized_to_modis": _ratio(estimated.hotspot_days, pairs.hotspot_days_modis),
    }
    comparisons = _with_groups(pairs[[*KEYS, "hotspot_days_modis"]].copy())
    comparisons["estimate"] = estimate
    comparisons["lo"] = estimated.hotspot_days_lo.to_numpy()
    comparisons["hi"] = estimated.hotspot_days_hi.to_numpy()
    scales = {"cell": cells}
    for name, group_keys in (
        ("tile", ["tile_row", "tile_col", "year", "month"]),
        ("region", ["year", "month"]),
    ):
        totals = comparisons.groupby(group_keys)[["hotspot_days_modis", "estimate", "lo", "hi"]]
        totals = totals.sum()
        truth_totals = totals.hotspot_days_modis.to_numpy(float)
        scales[name] = {
            **error_metrics(truth_totals, totals.estimate.to_numpy(float)),
            "coverage_95": _coverage(truth_totals, totals.lo.to_numpy(), totals.hi.to_numpy()),
        }
    return scales


def validate(
    monthly: pd.DataFrame,
    unified: pd.DataFrame,
    calibration: pd.DataFrame | None = None,
) -> dict:
    pairs = paired_months(monthly)
    held = pairs[pairs.year.isin(HOLDOUT_YEARS)]
    later = pairs[pairs.year > max(HOLDOUT_YEARS)]
    overlap = pairs[pairs.year >= KNOT_YEAR]
    matched = overlap.merge(unified[[*KEYS, "hotspot_days"]], on=KEYS, validate="one_to_one")
    complete = _complete_months(unified)
    native_modis = _complete_months(monthly[monthly.sensor == "MODIS"])

    result = {
        "method_version": METHOD_VERSION,
        "source": "parquet",
        "status": "unvalidated",
        "holdout_years": list(HOLDOUT_YEARS),
        "unit": "hotspot_days_1km",
        "step_ratio_raw": step_ratio(complete, "hotspot_days_raw", KNOT_YEAR),
        "step_ratio_harmonized": step_ratio(complete, "hotspot_days", KNOT_YEAR),
        "step_ratio_modis": step_ratio(native_modis, "hotspot_days", KNOT_YEAR),
        "step_ratio_placebo": step_ratio(complete, "hotspot_days", PLACEBO_YEAR),
        "temporal_step_definition": "median of knot-year monthly totals / median of same-month totals in each of three previous years; all three required",
        "sensor_ratio_definition": "sum of same-cell same-month counts / sum of paired MODIS; complete source months only",
        "interpretation": "Temporal steps include real environmental variation. MODIS kept observing through 2012, so step_ratio_modis is the reference the harmonized step should track; a value of 1.0 is not the target. Acceptance targets are diagnostic, never enforced by rescaling.",
        "overlap": {
            "n": len(matched),
            "raw_to_modis": _ratio(matched.hotspot_days_viirs, matched.hotspot_days_modis),
            "harmonized_to_modis": _ratio(matched.hotspot_days, matched.hotspot_days_modis),
        },
        "overlap_by_year": _by_year(matched),
        "holdout": {**error_metrics(np.array([]), np.array([])), "coverage_95": None},
        "warnings": [],
    }
    if any(
        result[name] is None
        for name in (
            "step_ratio_raw",
            "step_ratio_harmonized",
            "step_ratio_modis",
            "step_ratio_placebo",
        )
    ):
        result["warnings"].append(
            "Insufficient complete temporal coverage for one or more step diagnostics."
        )
    if held.empty or calibration is None or calibration.empty:
        result["warnings"].append(
            "No complete paired holdout observations; accuracy is not validated."
        )
        return result

    scales = _out_of_sample(held, calibration)
    result["holdout"] = scales["cell"]
    result["holdout_tile"] = scales["tile"]
    result["holdout_region"] = scales["region"]
    result["holdout_years_present"] = sorted(map(int, held.year.unique()))
    if result["holdout_years_present"] != list(HOLDOUT_YEARS):
        result["warnings"].append(
            "Not all planned holdout years are present; the holdout period is incomplete."
        )
    if not later.empty:
        prospective = _out_of_sample(later, calibration)
        result["prospective"] = {
            "years": sorted(map(int, later.year.unique())),
            "design": "years after the holdout; never used for fitting or for model revision",
            "cell": prospective["cell"],
            "region": prospective["region"],
        }
    result["validation_design"] = (
        "2024-2025 excluded from fitting; v1 holdout diagnostic informed the v2 sparse-count correction, so this is not an untouched final benchmark. Later years form the prospective test."
    )
    result["warnings"].append(
        "Cell estimates allocate tile predictions by VIIRS activity; cell accuracy is reported separately from tile and regional accuracy."
    )
    result["status"] = "evaluated"

    tracking = (
        result["step_ratio_harmonized"] / result["step_ratio_modis"]
        if result["step_ratio_harmonized"] is not None and result["step_ratio_modis"]
        else None
    )
    result["acceptance"] = {
        "raw_step_at_least_1_5": result["step_ratio_raw"] is not None
        and result["step_ratio_raw"] >= 1.5,
        "sensor_ratio_within_5_percent": _within(result["holdout"]["harmonized_to_modis"]),
        "temporal_step_within_5_percent": _within(result["step_ratio_harmonized"]),
        "temporal_step_tracks_modis_within_5_percent": _within(tracking),
    }
    return result
