from __future__ import annotations

import math
from collections.abc import Sequence

Pair = tuple[float, float]


def median(values: Sequence[float]) -> float:
    ordered = sorted(values)
    size = len(ordered)
    middle = size // 2
    if size % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def mad(values: Sequence[float], center: float) -> float:
    return median([abs(value - center) for value in values])


def robust_sigma(values: Sequence[float], center: float) -> float:
    return 1.4826 * mad(values, center)


def robust_z(observed: float, center: float, sigma: float) -> float:
    if sigma <= 0:
        return 0.0
    return (observed - center) / sigma


def percentile_rank(values: Sequence[float], observed: float) -> float:
    if not values:
        return 0.0
    return sum(1 for value in values if value <= observed) / len(values)


def step_ratio(
    series: Sequence[tuple[int, int, float]],
    knot: int,
    baseline_years: int = 3,
) -> float | None:
    by_month: dict[int, dict[int, float]] = {}
    for year, month, value in series:
        by_month.setdefault(month, {})[year] = value

    ratios = []
    for years in by_month.values():
        current = years.get(knot)
        history = [years[year] for year in range(knot - baseline_years, knot) if year in years]
        if current is None or current <= 0 or not history:
            continue
        baseline = median(history)
        if baseline > 0:
            ratios.append(current / baseline)
    return median(ratios) if ratios else None


def rmse_log(pairs: Sequence[Pair]) -> float | None:
    if not pairs:
        return None
    squared = [(math.log1p(estimate) - math.log1p(truth)) ** 2 for estimate, truth in pairs]
    return math.sqrt(sum(squared) / len(squared))


def mape(pairs: Sequence[Pair]) -> float | None:
    errors = [abs(estimate - truth) / truth for estimate, truth in pairs if truth]
    return sum(errors) / len(errors) if errors else None


def mean_bias(pairs: Sequence[Pair]) -> float | None:
    errors = [(estimate - truth) / truth for estimate, truth in pairs if truth]
    return sum(errors) / len(errors) if errors else None


def round_or_none(value: float | None, digits: int = 3) -> float | None:
    return None if value is None else round(value, digits)
