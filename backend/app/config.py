from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

API_PREFIX = "/api/v1"
API_VERSION = "1.0.0"
FIRST_MONTH = "2000-01"
KNOT_YEAR = 2012
METHOD_VERSION = "harmonize-v2"


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be positive")
    return value


def _env_path(name: str, default: Path) -> Path:
    raw = os.environ.get(name)
    return Path(raw).expanduser().resolve() if raw else default


def _env_list(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return tuple(item.strip() for item in raw.split(",") if item.strip())


@dataclass(frozen=True, slots=True)
class Settings:
    data_dir: Path
    contracts_dir: Path
    cors_origins: tuple[str, ...]
    csv_max_rows: int
    polygon_scan_rows: int
    max_span_months: int
    holdout_years: tuple[int, ...]
    max_concurrent_queries: int = 8
    require_data: bool = False

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            data_dir=_env_path("FIREBROS_DATA_DIR", REPO_ROOT / "data" / "processed"),
            contracts_dir=_env_path("FIREBROS_CONTRACTS_DIR", REPO_ROOT / "contracts"),
            cors_origins=_env_list(
                "FIREBROS_CORS",
                ("http://localhost:5173", "http://127.0.0.1:5173"),
            ),
            csv_max_rows=_env_int("FIREBROS_CSV_MAX_ROWS", 100_000),
            polygon_scan_rows=_env_int("FIREBROS_POLYGON_SCAN_ROWS", 100_000),
            max_span_months=_env_int("FIREBROS_MAX_SPAN_MONTHS", 400),
            holdout_years=(2024, 2025),
            max_concurrent_queries=_env_int("FIREBROS_MAX_CONCURRENT_QUERIES", 8),
            require_data=os.environ.get("FIREBROS_REQUIRE_DATA", "false").lower() == "true",
        )

    @property
    def cells_path(self) -> Path:
        return self.data_dir / "cells_monthly.parquet"

    def hotspots_path(self) -> Path:
        return self.data_dir / "hotspots" / "*.parquet"

    @property
    def has_parquet(self) -> bool:
        return self.cells_path.is_file()
