from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol

from ..geo import Aoi
from ..periods import YearMonth

StoreSource = Literal["parquet", "mock"]


@dataclass(frozen=True, slots=True)
class MonthlyRecord:
    year: int
    month: int
    count: int
    lo: int
    hi: int
    raw: int
    modis: int | None
    sensor: str
    days_observed: int


class Store(Protocol):
    source: StoreSource

    def records(self, aoi: Aoi, start: YearMonth, end: YearMonth) -> list[MonthlyRecord]: ...

    def hotspots(
        self,
        aoi: Aoi,
        start: YearMonth,
        end: YearMonth,
        limit: int,
    ) -> list[dict[str, object]]: ...
