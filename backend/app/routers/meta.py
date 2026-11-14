from __future__ import annotations

from fastapi import APIRouter, Depends

from ..config import API_VERSION, Settings
from ..deps import get_settings, get_store
from ..geo import GRID_DEG, REGION, REGION_CELLS
from ..store import Store

router = APIRouter(tags=["meta"])


@router.get("/meta/health")
def health(
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> dict[str, object]:
    describe = getattr(store, "describe", None)
    return {
        "status": "ok",
        "api_version": API_VERSION,
        "source": store.source,
        "data_ready": settings.has_parquet,
        "csv_max_rows": settings.csv_max_rows,
        **(describe() if describe else {}),
    }


@router.get("/meta/region")
def region() -> dict[str, object]:
    return {
        "region_bbox": list(REGION),
        "grid_deg": GRID_DEG,
        "cells": len(REGION_CELLS),
        "unit": "hotspot_days_1km",
        "knot_year": 2012,
        "first_month": "2000-01",
        "attribution": "NASA FIRMS - MODIS/VIIRS active fire data",
    }
