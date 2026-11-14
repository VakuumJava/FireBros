from __future__ import annotations

import calendar as _calendar
import re

YearMonth = tuple[int, int]

_YM_PATTERN = re.compile(r"\d{4}-(0[1-9]|1[0-2])")


def parse_ym(value: str) -> YearMonth:
    if not _YM_PATTERN.fullmatch(value):
        raise ValueError(f"expected YYYY-MM, got {value!r}")
    year, month = (int(part) for part in value.split("-"))
    if year < 2000:
        raise ValueError("data starts in 2000")
    return year, month


def format_ym(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def iter_months(start: YearMonth, end: YearMonth):
    cursor = start
    while cursor <= end:
        yield cursor
        year, month = cursor
        cursor = (year + 1, 1) if month == 12 else (year, month + 1)


def months_between(start: YearMonth, end: YearMonth) -> int:
    return (end[0] - start[0]) * 12 + (end[1] - start[1]) + 1


def days_in_month(year: int, month: int) -> int:
    return _calendar.monthrange(year, month)[1]


def month_bounds(year: int, month: int) -> tuple[str, str]:
    last = days_in_month(year, month)
    return f"{year:04d}-{month:02d}-01", f"{year:04d}-{month:02d}-{last:02d}"
