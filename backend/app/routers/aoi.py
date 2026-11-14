from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from .. import service
from ..columns import HOTSPOT_COLUMNS, MONTHLY_COLUMNS
from ..config import FIRST_MONTH, Settings
from ..deps import get_settings, get_store
from ..export import render_csv
from ..geo import (
    MAX_BBOX_CHARS,
    MAX_POLYGON_CHARS,
    REGION,
    Aoi,
    GeoError,
    describe_aoi,
    outside_region,
    parse_bbox,
    parse_polygon,
    polygon_bbox,
)
from ..models import (
    AnomalyResponse,
    CalendarResponse,
    HarmonizationResponse,
    SummaryResponse,
    TopResponse,
)
from ..periods import YearMonth, format_ym, months_between, parse_ym
from ..store import Store

router = APIRouter(tags=["aoi"])


def current_month() -> YearMonth:
    today = date.today()
    return today.year, today.month


def resolve_aoi(
    bbox: str | None = Query(None, max_length=MAX_BBOX_CHARS),
    polygon: str | None = Query(None, max_length=MAX_POLYGON_CHARS),
) -> Aoi:
    if bbox and polygon:
        raise HTTPException(422, "pass either 'bbox' or 'polygon', not both")

    try:
        shape = parse_polygon(polygon) if polygon else None
        box = polygon_bbox(shape) if shape else parse_bbox(bbox) if bbox else REGION
        message = outside_region(box)
        if message:
            raise HTTPException(422, message)
        return describe_aoi(box, shape)
    except GeoError as exc:
        raise HTTPException(422, str(exc)) from exc


def resolve_period(start: str, end: str | None, settings: Settings) -> tuple[YearMonth, YearMonth]:
    try:
        start_ym = parse_ym(start)
        end_ym = parse_ym(end) if end else current_month()
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    if start_ym > end_ym:
        raise HTTPException(422, "'from' must not be after 'to'")
    if months_between(start_ym, end_ym) > settings.max_span_months:
        raise HTTPException(422, f"range is limited to {settings.max_span_months} months")
    return start_ym, end_ym


@router.get("/aoi/summary", response_model=SummaryResponse, response_model_exclude_none=True)
def read_summary(
    aoi: Aoi = Depends(resolve_aoi),
    start: str = Query(FIRST_MONTH, alias="from", max_length=7),
    end: str | None = Query(None, alias="to", max_length=7),
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> SummaryResponse:
    start_ym, end_ym = resolve_period(start, end, settings)
    return service.summary(aoi, start_ym, end_ym, store)


@router.get("/aoi/calendar", response_model=CalendarResponse)
def read_calendar(
    aoi: Aoi = Depends(resolve_aoi),
    start: str = Query(FIRST_MONTH, alias="from", max_length=7),
    end: str | None = Query(None, alias="to", max_length=7),
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> CalendarResponse:
    start_ym, end_ym = resolve_period(start, end, settings)
    return service.calendar(aoi, start_ym, end_ym, store)


@router.get("/aoi/anomaly", response_model=AnomalyResponse)
def read_anomaly(
    aoi: Aoi = Depends(resolve_aoi),
    month: str | None = Query(None, max_length=7),
    store: Store = Depends(get_store),
) -> AnomalyResponse:
    try:
        target = parse_ym(month) if month else current_month()
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    if target > current_month():
        raise HTTPException(422, f"month {format_ym(*target)} is in the future")
    return service.anomaly(aoi, target, store)


@router.get("/aoi/top", response_model=TopResponse)
def read_top(
    aoi: Aoi = Depends(resolve_aoi),
    limit: int = Query(10, ge=1, le=50, alias="n"),
    store: Store = Depends(get_store),
) -> TopResponse:
    return service.top(aoi, limit, store)


@router.get("/aoi/harmonization", response_model=HarmonizationResponse)
def read_harmonization(
    aoi: Aoi = Depends(resolve_aoi),
    start: str = Query(FIRST_MONTH, alias="from", max_length=7),
    end: str | None = Query(None, alias="to", max_length=7),
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> HarmonizationResponse:
    start_ym, end_ym = resolve_period(start, end, settings)
    return service.harmonization(aoi, start_ym, end_ym, store, settings.holdout_years)


@router.get(
    "/aoi/export.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
def export_csv(
    aoi: Aoi = Depends(resolve_aoi),
    start: str = Query(FIRST_MONTH, alias="from", max_length=7),
    end: str | None = Query(None, alias="to", max_length=7),
    kind: Literal["hotspots", "monthly"] = Query("hotspots"),
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> Response:
    start_ym, end_ym = resolve_period(start, end, settings)

    if kind == "monthly":
        report = service.summary(aoi, start_ym, end_ym, store)
        rows = [point.model_dump() for point in report.series if point.days_observed > 0]
        columns = MONTHLY_COLUMNS
        unit = "hotspot_days_1km"
    else:
        rows = store.hotspots(aoi, start_ym, end_ym, settings.csv_max_rows)
        columns = HOTSPOT_COLUMNS
        unit = "detections"

    payload = render_csv(rows, columns)
    filename = f"firebros_{kind}_{format_ym(*start_ym)}_{format_ym(*end_ym)}.csv"
    return Response(
        content=payload,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Row-Count": str(len(rows)),
            "X-Unit": unit,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
