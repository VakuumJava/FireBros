from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Sequence

FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def render_csv(rows: Iterable[dict[str, object]], columns: Sequence[str]) -> bytes:
    buffer = io.StringIO(newline="")
    buffer.write("\ufeff")
    writer = csv.DictWriter(
        buffer,
        fieldnames=list(columns),
        lineterminator="\n",
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows({key: _neutralize(value) for key, value in row.items()} for row in rows)
    return buffer.getvalue().encode("utf-8")


def _neutralize(value: object) -> object:
    """Stop spreadsheet formula injection on any string cell."""
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return f"'{value}"
    return value
