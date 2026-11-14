from __future__ import annotations

from datetime import UTC, date, datetime

from .config import KNOT_YEAR, METHOD_VERSION
from .errors import DataUnavailable, NoData
from .geo import REGION, Aoi
from .models import (
    AnomalyPoint,
    AnomalyResponse,
    AoiOut,
    Baseline,
    CalendarResponse,
    Coverage,
    HarmonizationResponse,
    HarmoPoint,
    Jump,
    Meta,
    MonthPoint,
    Period,
    SummaryResponse,
    TopMonth,
    TopResponse,
    TopYear,
    Totals,
    Validation,
)
from .periods import YearMonth, days_in_month, format_ym, iter_months, months_between
from .stats import (
    mape,
    mean_bias,
    median,
    percentile_rank,
    rmse_log,
    robust_sigma,
    robust_z,
    round_or_none,
    step_ratio,
    wape,
)
from .store import Store

JUMP_DEFINITION = "median_m[ value(knot,m) / median(value(knot-3..knot-1, m)) ]"
PLACEBO_KNOT = 2010
Z_THRESHOLD = 0.5


def meta(store: Store) -> Meta:
    return Meta(
        source=store.source,
        method_version=METHOD_VERSION,
        region_bbox=list(REGION),
        generated_at=datetime.now(UTC).isoformat(timespec="seconds"),
    )


def aoi_out(aoi: Aoi) -> AoiOut:
    return AoiOut(
        id=aoi.id,
        kind=aoi.kind,
        bbox=list(aoi.bbox),
        polygon=[list(point) for point in aoi.polygon] if aoi.polygon else None,
        area_km2=round(aoi.area_km2, 1),
        cells_total=aoi.bbox_cells,
        cells_inside=aoi.cells_inside,
        cells_partial=aoi.cells_partial,
        coverage_fraction=round(aoi.coverage_fraction, 3),
    )


def summary(aoi: Aoi, start: YearMonth, end: YearMonth, store: Store) -> SummaryResponse:
    records = {(record.year, record.month): record for record in store.records(aoi, start, end)}
    expected = months_between(start, end)

    series: list[MonthPoint] = []
    gaps: list[str] = []
    partial_months: list[str] = []

    for year, month in iter_months(start, end):
        record = records.get((year, month))
        if record is None or record.days_observed == 0:
            gaps.append(format_ym(year, month))
            series.append(_empty_point(year, month))
            continue

        length = days_in_month(year, month)
        series.append(
            MonthPoint(
                year=year,
                month=month,
                count=record.count,
                lo=record.lo,
                hi=record.hi,
                sensor=record.sensor,
                harmonized=record.sensor != "MODIS",
                days_observed=record.days_observed,
                days_in_month=length,
            )
        )
        if record.days_observed < length:
            partial_months.append(format_ym(year, month))

    present = [point for point in series if point.days_observed > 0]
    peak = max(present, key=lambda point: point.count) if present else None
    totals = Totals(
        hotspot_days=sum(point.count for point in present),
        peak_year=peak.year if peak else None,
        peak_month=peak.month if peak else None,
        mean_month=round(sum(point.count for point in present) / len(present)) if present else 0,
    )

    return SummaryResponse(
        meta=meta(store),
        aoi=aoi_out(aoi),
        period=Period(
            from_=format_ym(*start),
            to=format_ym(*end),
            months=expected,
        ),
        series=series,
        coverage=Coverage(
            months_expected=expected,
            months_present=len(present),
            gaps=gaps,
            nrt_months=partial_months,
        ),
        totals=totals,
    )


def calendar(aoi: Aoi, start: YearMonth, end: YearMonth, store: Store) -> CalendarResponse:
    by_month = {
        (record.year, record.month): record.count
        for record in store.records(aoi, start, end)
        if record.days_observed > 0
    }
    years = list(range(start[0], end[0] + 1))
    values = [[by_month.get((year, month)) for month in range(1, 13)] for year in years]

    return CalendarResponse(
        meta=meta(store),
        aoi_id=aoi.id,
        years=years,
        months=list(range(1, 13)),
        values=values,
        max=max((value for row in values for value in row if value is not None), default=0),
    )


def anomaly(aoi: Aoi, month: YearMonth, store: Store, today: date | None = None) -> AnomalyResponse:
    today = today or date.today()
    records = store.records(aoi, (2000, 1), month)
    target = next(
        (
            record
            for record in records
            if (record.year, record.month) == month and record.days_observed > 0
        ),
        None,
    )
    if target is None:
        raise NoData(f"no observations for {format_ym(*month)} in this AOI")

    length = days_in_month(*month)
    partial = target.days_observed < length

    history = [
        record
        for record in records
        if record.month == month[1] and record.year < month[0] and record.days_observed > 0
    ]
    if not history:
        raise NoData("not enough history for an anomaly")

    needs_prefix = partial or any(
        days_in_month(r.year, r.month) > target.days_observed for r in history
    )
    if needs_prefix:
        prefix_reader = getattr(store, "prefix_records", None)
        if prefix_reader is None:
            raise DataUnavailable("exact month-to-date aggregates are not installed")
        prefixes = prefix_reader(aoi, (2000, 1), month, target.days_observed)
        target_prefix = next((r for r in prefixes if (r.year, r.month) == month), None)
        if target_prefix is None or target_prefix.days_observed != target.days_observed:
            raise NoData("the current month does not have a complete observed day prefix")
        target = target_prefix
        history = [
            record
            for record in prefixes
            if record.month == month[1]
            and record.year < month[0]
            and record.days_observed == target.days_observed
        ]
    else:
        history = [r for r in history if r.days_observed == days_in_month(r.year, r.month)]
    if not history:
        raise NoData("not enough complete history for the comparison window")
    baseline_counts = [record.count for record in history]

    center = median(baseline_counts)
    sigma = robust_sigma(baseline_counts, center)
    z = robust_z(target.count, center, sigma)
    if sigma == 0:
        direction = (
            "above" if target.count > center else "below" if target.count < center else "normal"
        )
    else:
        direction = "above" if z > Z_THRESHOLD else "below" if z < -Z_THRESHOLD else "normal"

    return AnomalyResponse(
        meta=meta(store),
        aoi_id=aoi.id,
        month=format_ym(*month),
        partial=partial,
        through_day=target.days_observed,
        observed=target.count,
        baseline=Baseline(
            median=round(center, 1),
            mad=round(median([abs(value - center) for value in baseline_counts]), 1),
            robust_sigma=round(sigma, 1),
            n_years=len(baseline_counts),
            window=f"same month, days <= {target.days_observed}",
        ),
        robust_z=round(z, 2),
        percentile=round(percentile_rank(baseline_counts, target.count), 3),
        direction=direction,
        label=_label(direction, z, sigma),
        series=[
            AnomalyPoint(
                year=record.year,
                count=count,
                partial=target.days_observed < days_in_month(record.year, record.month),
            )
            for record, count in zip(history, baseline_counts, strict=True)
        ]
        + [AnomalyPoint(year=target.year, count=target.count, partial=partial)],
    )


def top(
    aoi: Aoi, limit: int, store: Store, start: YearMonth = (2000, 1), end: YearMonth | None = None
) -> TopResponse:
    records = [
        record
        for record in store.records(aoi, start, end or _last_month())
        if record.days_observed > 0
    ]

    by_month = sorted(records, key=lambda record: record.count, reverse=True)[:limit]
    by_year: dict[int, int] = {}
    for record in records:
        by_year[record.year] = by_year.get(record.year, 0) + record.count
    year_ranks = sorted(by_year.items(), key=lambda item: item[1], reverse=True)[:limit]

    return TopResponse(
        meta=meta(store),
        aoi_id=aoi.id,
        months=[
            TopMonth(rank=index, year=record.year, month=record.month, count=record.count)
            for index, record in enumerate(by_month, start=1)
        ],
        years=[
            TopYear(rank=index, year=year, count=count)
            for index, (year, count) in enumerate(year_ranks, start=1)
        ],
    )


def harmonization(
    aoi: Aoi,
    start: YearMonth,
    end: YearMonth,
    store: Store,
    holdout_years: tuple[int, ...],
) -> HarmonizationResponse:
    records = [record for record in store.records(aoi, start, end) if record.days_observed > 0]
    complete = [r for r in records if r.days_observed == days_in_month(r.year, r.month)]
    raw = [(r.year, r.month, r.raw) for r in complete]
    harmonized = [(r.year, r.month, r.count) for r in complete]
    native_modis = [(r.year, r.month, r.modis) for r in complete if r.modis is not None]

    jump = Jump(
        step_ratio_raw=round_or_none(step_ratio(raw, KNOT_YEAR)),
        step_ratio_harmonized=round_or_none(step_ratio(harmonized, KNOT_YEAR)),
        step_ratio_modis=round_or_none(step_ratio(native_modis, KNOT_YEAR)),
        step_ratio_placebo=round_or_none(step_ratio(harmonized, PLACEBO_KNOT)),
        definition=JUMP_DEFINITION,
    )

    pairs = [
        (record.count, record.modis)
        for record in records
        if record.modis is not None
        and record.year in holdout_years
        and record.days_observed == days_in_month(record.year, record.month)
        and record.sensor != "MODIS"
    ]
    validation = Validation(
        holdout_years=list(holdout_years),
        n=len(pairs),
        rmse_log=round_or_none(rmse_log(pairs)),
        mape=round_or_none(mape(pairs)),
        wape=round_or_none(wape(pairs)),
        bias=round_or_none(mean_bias(pairs)),
    )

    return HarmonizationResponse(
        meta=meta(store),
        aoi_id=aoi.id,
        knot_year=KNOT_YEAR,
        series=[
            HarmoPoint(
                year=record.year,
                month=record.month,
                sensor=record.sensor,
                raw=record.raw,
                harmonized=record.count,
                lo=record.lo,
                hi=record.hi,
                modis_truth=record.modis,
            )
            for record in records
        ],
        jump=jump,
        validation=validation,
    )


def _empty_point(year: int, month: int) -> MonthPoint:
    sensor = "MODIS" if year < KNOT_YEAR else "VIIRS_SNPP"
    return MonthPoint(
        year=year,
        month=month,
        count=0,
        lo=0,
        hi=0,
        sensor=sensor,
        harmonized=sensor != "MODIS",
        days_observed=0,
        days_in_month=days_in_month(year, month),
    )


def _label(direction: str, z: float, sigma: float) -> str:
    if direction == "normal":
        return "within the usual range"
    if sigma == 0:
        return f"{direction} an unvarying history"
    return f"{abs(z):.1f}\N{GREEK SMALL LETTER SIGMA} {direction} the median"


def _last_month() -> YearMonth:
    today = date.today()
    return today.year, today.month
