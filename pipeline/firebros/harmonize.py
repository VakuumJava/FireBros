from __future__ import annotations

import calendar
from dataclasses import dataclass

import numpy as np
import pandas as pd

METHOD_VERSION = "harmonize-v2"
HOLDOUT_YEARS = (2024, 2025)
KEYS = ["grid_row", "grid_col", "year", "month"]
REGION_WEST, REGION_SOUTH = 68.5, 38.4
MIN_TRAIN_PAIRS = 12
MIN_LOCAL_PAIRS = 24
SHRINKAGE_STRENGTH = 48.0


@dataclass(frozen=True)
class Fit:
    a: float
    b: float
    sigma: float
    cov_aa: float
    cov_ab: float
    cov_bb: float
    n: int


def _check_monthly(monthly: pd.DataFrame) -> pd.DataFrame:
    required = {*KEYS, "sensor", "hotspot_days", "days_observed", "n_detections"}
    missing = required.difference(monthly.columns)
    if missing:
        raise ValueError(f"monthly data missing columns: {', '.join(sorted(missing))}")
    data = monthly.copy()
    numeric = [
        *KEYS,
        "hotspot_days",
        "days_observed",
        "n_detections",
        *(["through_day"] if "through_day" in data else []),
    ]
    values = data[numeric].to_numpy(dtype=float)
    if not np.isfinite(values).all() or (values < 0).any() or (values % 1 != 0).any():
        raise ValueError("monthly counts and indices must be finite nonnegative integers")
    if (values > np.iinfo(np.int64).max // 100).any():
        raise ValueError("monthly values exceed supported integer range")
    if not data["month"].between(1, 12).all():
        raise ValueError("month must be between 1 and 12")
    if not data["year"].between(2000, 2100).all():
        raise ValueError("year is outside the supported archive")
    if not data["grid_row"].between(0, 21).all() or not data["grid_col"].between(0, 48).all():
        raise ValueError("grid cell is outside the configured region")
    if (data["days_observed"] > _month_lengths(data)).any():
        raise ValueError("days_observed exceeds month length")
    if ((data.days_observed == 0) & (data.hotspot_days > 0)).any():
        raise ValueError("positive counts require observed days")
    duplicate_keys = [*KEYS, "sensor"]
    if "through_day" in data:
        duplicate_keys.append("through_day")
        if not data["through_day"].between(1, 31).all():
            raise ValueError("through_day must be between 1 and 31")
        if (data["through_day"] > _month_lengths(data)).any():
            raise ValueError("through_day exceeds month length")
        if (data["days_observed"] > data["through_day"]).any():
            raise ValueError("prefix coverage exceeds through_day")
    if data.duplicated(duplicate_keys).any():
        raise ValueError("duplicate monthly sensor-cell rows")
    data[numeric] = data[numeric].astype("int64")
    if not data.sensor.isin(["MODIS", "VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21"]).all():
        raise ValueError("unknown sensor family")
    return data


def _month_lengths(data: pd.DataFrame) -> np.ndarray:
    pairs = data[["year", "month"]].drop_duplicates()
    lengths = {
        (int(y), int(m)): calendar.monthrange(int(y), int(m))[1]
        for y, m in pairs.itertuples(index=False, name=None)
    }
    return np.fromiter(
        (
            lengths[(int(y), int(m))]
            for y, m in data[["year", "month"]].itertuples(index=False, name=None)
        ),
        dtype=int,
    )


def _with_groups(data: pd.DataFrame) -> pd.DataFrame:
    result = data.copy()
    result["tile_row"] = np.floor((REGION_SOUTH + (result.grid_row + 0.5) * 0.25) / 2).astype(int)
    result["tile_col"] = np.floor((REGION_WEST + (result.grid_col + 0.5) * 0.25) / 2).astype(int)
    result["season"] = (result.month % 12 // 3 + 1).astype(int)
    return result


def paired_months(monthly: pd.DataFrame) -> pd.DataFrame:
    data = _check_monthly(monthly)
    complete = data[data.days_observed == _month_lengths(data)]
    modis = complete[complete.sensor == "MODIS"]
    viirs = complete[complete.sensor == "VIIRS_SNPP"]
    paired = viirs.merge(modis, on=KEYS, suffixes=("_viirs", "_modis"), validate="one_to_one")
    return _with_groups(paired)


def _fit(x: np.ndarray, y: np.ndarray) -> Fit:
    design = np.column_stack((np.ones(len(x)), x))
    beta = np.linalg.lstsq(design, y, rcond=None)[0]
    weights = np.ones(len(x))
    for _ in range(50):
        residual = y - design @ beta
        scale = max(1.4826 * np.median(np.abs(residual - np.median(residual))), 1e-6)
        weights = np.minimum(1.0, 1.345 * scale / np.maximum(np.abs(residual), 1e-12))
        weighted = design * np.sqrt(weights)[:, None]
        updated = np.linalg.lstsq(weighted, y * np.sqrt(weights), rcond=None)[0]
        if updated[1] < 0:
            updated = np.array([np.average(y, weights=weights), 0.0])
        if np.max(np.abs(updated - beta)) < 1e-9:
            beta = updated
            break
        beta = updated
    residual = y - design @ beta
    sigma = max(float(np.sqrt(np.average(residual**2, weights=weights))), 1e-6)
    bread = np.linalg.pinv(design.T @ (weights[:, None] * design))
    meat = design.T @ ((weights * residual)[:, None] ** 2 * design)
    covariance = bread @ meat @ bread * len(x) / max(len(x) - 2, 1)
    return Fit(
        a=float(beta[0]),
        b=float(beta[1]),
        sigma=sigma,
        cov_aa=float(covariance[0, 0]),
        cov_ab=float(covariance[0, 1]),
        cov_bb=float(covariance[1, 1]),
        n=len(x),
    )


def _fit_rows(rows: pd.DataFrame) -> Fit:
    return _fit(
        np.log1p(rows.hotspot_days_viirs.to_numpy(float)),
        np.log1p(rows.hotspot_days_modis.to_numpy(float)),
    )


def _tile_pairs(monthly: pd.DataFrame) -> pd.DataFrame:
    pairs = paired_months(monthly)
    return pairs.groupby(["tile_row", "tile_col", "season", "year", "month"], as_index=False)[
        ["hotspot_days_viirs", "hotspot_days_modis"]
    ].sum()


def _mean_factor(samples: pd.DataFrame, fitted: Fit) -> float:
    raw = samples.hotspot_days_viirs.to_numpy(float)
    prediction = np.maximum(0, np.expm1(fitted.a + fitted.b * np.log1p(raw)))
    prediction[raw == 0] = 0
    total = prediction.sum()
    return float(samples.hotspot_days_modis.sum() / total) if total > 0 else 1.0


def fit_calibration(monthly: pd.DataFrame) -> pd.DataFrame:
    pairs = _tile_pairs(monthly)
    train = pairs[(pairs.year >= 2012) & (pairs.year < min(HOLDOUT_YEARS))]
    train = train[(train.hotspot_days_viirs > 0) | (train.hotspot_days_modis > 0)]
    if len(train) < MIN_TRAIN_PAIRS or train.year.nunique() < 2:
        raise ValueError(
            "calibration needs at least 12 active complete overlap pairs in two training years"
        )
    if train.hotspot_days_viirs.nunique() < 2:
        raise ValueError("calibration needs varying VIIRS counts")
    global_fit = _fit_rows(train)
    global_factor = _mean_factor(train, global_fit)
    years = ",".join(map(str, sorted(train.year.unique())))
    rows = [
        {
            "tile_row": -1,
            "tile_col": -1,
            "season": 0,
            **vars(global_fit),
            "shrinkage": 0.0,
            "kind": "global",
            "mean_factor": global_factor,
        }
    ]
    groups = _with_groups(monthly)[["tile_row", "tile_col", "season"]].drop_duplicates()
    by_group = {key: group for key, group in train.groupby(["tile_row", "tile_col", "season"])}
    for group_key in sorted(map(tuple, groups.to_numpy())):
        samples = by_group.get(group_key, train.iloc[:0])
        if len(samples) >= MIN_LOCAL_PAIRS and samples.hotspot_days_viirs.nunique() >= 2:
            local = _fit_rows(samples)
            weight = len(samples) / (len(samples) + SHRINKAGE_STRENGTH)
            fitted = Fit(
                a=weight * local.a + (1 - weight) * global_fit.a,
                b=weight * local.b + (1 - weight) * global_fit.b,
                sigma=max(local.sigma, global_fit.sigma),
                cov_aa=weight**2 * local.cov_aa + (1 - weight) ** 2 * global_fit.cov_aa,
                cov_ab=weight**2 * local.cov_ab + (1 - weight) ** 2 * global_fit.cov_ab,
                cov_bb=weight**2 * local.cov_bb + (1 - weight) ** 2 * global_fit.cov_bb,
                n=len(samples),
            )
            factor = weight * _mean_factor(samples, fitted) + (1 - weight) * global_factor
            kind = "shrunk"
        else:
            fitted = Fit(**{**vars(global_fit), "n": len(samples)})
            weight, kind, factor = 0.0, "global_fallback", global_factor
        rows.append(
            dict(zip(["tile_row", "tile_col", "season"], group_key, strict=True))
            | vars(fitted)
            | {"shrinkage": weight, "kind": kind, "mean_factor": factor}
        )
    calibration = pd.DataFrame(rows)
    calibration["training_years"] = years
    calibration["holdout_years"] = ",".join(map(str, HOLDOUT_YEARS))
    calibration["method_version"] = METHOD_VERSION
    return calibration


def _predict_tiles(tiles: pd.DataFrame, calibration: pd.DataFrame) -> pd.DataFrame:
    required = [
        "tile_row",
        "tile_col",
        "season",
        "a",
        "b",
        "sigma",
        "cov_aa",
        "cov_ab",
        "cov_bb",
        "mean_factor",
    ]
    if not set(required).issubset(calibration.columns):
        raise ValueError("invalid calibration table")
    global_rows = calibration[calibration["kind"] == "global"]
    if len(global_rows) != 1:
        raise ValueError("calibration must contain exactly one global fit")
    coefficients = calibration[calibration["kind"] != "global"]
    result = tiles.merge(
        coefficients[required], how="left", on=required[:3], validate="many_to_one"
    )
    for name in required[3:]:
        result[name] = result[name].fillna(global_rows.iloc[0][name])
    x = np.log1p(result.hotspot_days.to_numpy(float))
    mean = result.a.to_numpy(float) + result.b.to_numpy(float) * x
    variance = (
        result.cov_aa.to_numpy(float)
        + 2 * x * result.cov_ab.to_numpy(float)
        + x**2 * result.cov_bb.to_numpy(float)
    )
    spread = 1.96 * np.sqrt(np.maximum(variance, 0) + result.sigma.to_numpy(float) ** 2)
    if not np.isfinite(mean).all() or not np.isfinite(spread).all():
        raise ValueError("non-finite calibration prediction")
    factor = result.mean_factor.to_numpy(float)
    upper = mean + spread + np.log(np.maximum(factor, 1))
    if (upper > np.log(np.iinfo(np.int64).max / 2)).any():
        raise ValueError("calibration prediction exceeds supported count range")
    count = np.maximum(0, np.expm1(mean)) * factor
    count[result.hotspot_days.to_numpy() == 0] = 0
    result["estimate"] = np.rint(count).astype(np.int64)
    result["lower"] = np.minimum(
        result.estimate, np.floor(np.maximum(0, np.expm1(mean - spread)) * factor)
    ).astype(np.int64)
    result["upper"] = np.maximum(
        result.estimate, np.ceil(np.maximum(0, np.expm1(mean + spread)) * factor)
    ).astype(np.int64)
    return result.drop(columns=required[3:])


def predict(viirs: pd.DataFrame, calibration: pd.DataFrame) -> pd.DataFrame:
    grouped = _with_groups(viirs).reset_index(drop=True)
    keys = ["tile_row", "tile_col", "season", "year", "month"]
    tiles = grouped.groupby(keys, as_index=False).hotspot_days.sum()
    tiles = _predict_tiles(tiles, calibration).rename(columns={"hotspot_days": "tile_raw"})
    result = grouped.merge(tiles, on=keys, validate="many_to_one")
    share = np.divide(
        result.hotspot_days.to_numpy(float),
        result.tile_raw.to_numpy(float),
        out=np.zeros(len(result)),
        where=result.tile_raw.to_numpy() > 0,
    )
    fractional = share * result.estimate.to_numpy()
    floor = np.floor(fractional).astype(np.int64)
    result["fraction"] = fractional - floor
    result["allocated"] = floor
    ranked = result.sort_values(
        [*keys, "fraction", "grid_row", "grid_col"],
        ascending=[True] * len(keys) + [False, True, True],
    )
    rank = ranked.groupby(keys).cumcount()
    remainder = ranked.estimate - ranked.groupby(keys).allocated.transform("sum")
    result.loc[ranked.index, "allocated"] += (rank < remainder).astype(np.int64)
    result["hotspot_days_raw"] = result.hotspot_days.astype("int64")
    result["hotspot_days"] = result.allocated
    result["hotspot_days_lo"] = np.minimum(
        result.hotspot_days, np.floor(share * result.lower)
    ).astype(np.int64)
    result["hotspot_days_hi"] = np.maximum(
        result.hotspot_days, np.ceil(share * result.upper)
    ).astype(np.int64)
    extra = [*keys[:3], "tile_raw", "estimate", "lower", "upper", "fraction", "allocated"]
    return result.drop(columns=extra)


def _predict_prefixes(
    viirs: pd.DataFrame, calibration: pd.DataFrame, reference_monthly: pd.DataFrame
) -> pd.DataFrame:
    reference = reference_monthly[reference_monthly.sensor == "VIIRS_SNPP"]
    calibrated = predict(reference, calibration)
    fields = [*KEYS, "hotspot_days_raw", "hotspot_days", "hotspot_days_lo", "hotspot_days_hi"]
    result = viirs.merge(
        calibrated[fields], on=KEYS, suffixes=("", "_full"), validate="many_to_one"
    )
    if result.hotspot_days_raw.isna().any():
        raise ValueError("cumulative data has no monthly calibration reference")
    fraction = np.divide(
        result.hotspot_days.to_numpy(float),
        result.hotspot_days_raw.to_numpy(float),
        out=np.zeros(len(result)),
        where=result.hotspot_days_raw.to_numpy() > 0,
    )
    if (fraction > 1).any():
        raise ValueError("cumulative count exceeds monthly total")
    result["hotspot_days_raw"] = result.hotspot_days.astype("int64")
    result["hotspot_days"] = np.rint(result.hotspot_days_full * fraction).astype(np.int64)
    result["hotspot_days_lo"] = np.floor(result.hotspot_days_lo * fraction).astype(np.int64)
    result["hotspot_days_hi"] = np.ceil(result.hotspot_days_hi * fraction).astype(np.int64)
    return result.drop(columns="hotspot_days_full")


def apply_calibration(
    monthly: pd.DataFrame, calibration: pd.DataFrame, reference_monthly: pd.DataFrame | None = None
) -> pd.DataFrame:
    data = _check_monthly(monthly)
    keys = [*KEYS, *(["through_day"] if "through_day" in data else [])]
    data = data[
        data.sensor.isin(["MODIS", "VIIRS_SNPP"])
        & (data.days_observed > 0)
        & ((data.sensor == "MODIS") | (data.year >= 2012))
    ].copy()
    data["preference"] = np.where((data.year >= 2012) & (data.sensor == "VIIRS_SNPP"), 1, 0)
    if data.empty:
        raise ValueError("no covered MODIS or VIIRS SNPP observations")
    chosen = data.sort_values([*keys, "days_observed", "preference", "sensor"]).drop_duplicates(
        keys, keep="last"
    )
    modis = chosen[chosen.sensor == "MODIS"].copy()
    modis["hotspot_days_raw"] = modis.hotspot_days
    modis["hotspot_days_lo"] = modis.hotspot_days
    modis["hotspot_days_hi"] = modis.hotspot_days
    viirs = chosen[chosen.sensor == "VIIRS_SNPP"]
    if not viirs.empty:
        if calibration.empty:
            raise ValueError("VIIRS counts require a fitted calibration")
        if "through_day" in viirs:
            if reference_monthly is None:
                raise ValueError("cumulative calibration requires reference_monthly")
            viirs = _predict_prefixes(viirs, calibration, reference_monthly)
        else:
            viirs = predict(viirs, calibration)
    result = pd.concat([modis, viirs], ignore_index=True)
    truth = data[data.sensor == "MODIS"][[*keys, "hotspot_days", "days_observed"]].rename(
        columns={"hotspot_days": "hotspot_days_modis", "days_observed": "modis_days_observed"}
    )
    result = result.merge(truth, on=keys, how="left", validate="one_to_one")
    expected = result.through_day if "through_day" in result else _month_lengths(result)
    incomplete = (result.modis_days_observed != expected) | (result.days_observed != expected)
    result.loc[incomplete, "hotspot_days_modis"] = pd.NA
    result["hotspot_days_modis"] = result.hotspot_days_modis.astype("Int64")
    columns = [
        *keys,
        "sensor",
        "hotspot_days",
        "hotspot_days_lo",
        "hotspot_days_hi",
        "hotspot_days_raw",
        "hotspot_days_modis",
        "days_observed",
        "n_detections",
    ]
    return result[columns].sort_values(keys).reset_index(drop=True)


def harmonize(monthly: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    data = _check_monthly(monthly)
    if data.empty:
        raise ValueError("cannot harmonize an empty archive")
    calibration = fit_calibration(data) if (data.sensor == "VIIRS_SNPP").any() else pd.DataFrame()
    return apply_calibration(data, calibration), calibration
