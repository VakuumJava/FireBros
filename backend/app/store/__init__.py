from __future__ import annotations

from functools import lru_cache

from ..config import Settings
from .base import MonthlyRecord, Store
from .mock import MockStore
from .parquet import ParquetStore


@lru_cache(maxsize=4)
def _build(settings: Settings) -> Store:
    if settings.has_parquet:
        return ParquetStore(settings)
    return MockStore(settings.contracts_dir)


def store_for(settings: Settings) -> Store:
    return _build(settings)


def clear_store_cache() -> None:
    _build.cache_clear()


__all__ = ["MonthlyRecord", "Store", "clear_store_cache", "store_for"]
