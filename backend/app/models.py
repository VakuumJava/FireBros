from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Sensor = Literal["MODIS", "VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21"]
Palette = Literal["viridis", "cividis"]
Unit = Literal["hotspot_days_1km"]
Direction = Literal["above", "normal", "below"]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class Meta(ApiModel):
    source: Literal["parquet", "mock"]
    unit: Unit = "hotspot_days_1km"
    method_version: str
    region_bbox: list[float]
    generated_at: str


class AoiOut(ApiModel):
    id: str
    kind: Literal["bbox", "polygon"]
    bbox: list[float] = Field(min_length=4, max_length=4)
    polygon: list[list[float]] | None = None
    area_km2: float
    cells_total: int
    cells_inside: int
    cells_partial: int
    coverage_fraction: float


class Period(ApiModel):
    from_: str = Field(alias="from")
    to: str
    months: int


class MonthPoint(ApiModel):
    year: int
    month: int
    count: int
    lo: int
    hi: int
    sensor: Sensor
    harmonized: bool
    days_observed: int
    days_in_month: int


class Coverage(ApiModel):
    months_expected: int
    months_present: int
    gaps: list[str]
    nrt_months: list[str]


class Totals(ApiModel):
    hotspot_days: int
    peak_year: int | None = None
    peak_month: int | None = None
    mean_month: int


class SummaryResponse(ApiModel):
    meta: Meta
    aoi: AoiOut
    period: Period
    series: list[MonthPoint]
    coverage: Coverage
    totals: Totals


class CalendarResponse(ApiModel):
    meta: Meta
    aoi_id: str
    years: list[int]
    months: list[int]
    values: list[list[int | None]]
    max: int
    palette_default: Palette = "viridis"
    palettes: list[Palette] = ["viridis", "cividis"]
    unit: Unit = "hotspot_days_1km"


class Baseline(ApiModel):
    median: float
    mad: float
    robust_sigma: float
    n_years: int
    window: str


class AnomalyPoint(ApiModel):
    year: int
    count: int
    partial: bool | None = None


class AnomalyResponse(ApiModel):
    meta: Meta
    aoi_id: str
    month: str
    partial: bool
    through_day: int
    observed: int
    baseline: Baseline
    robust_z: float
    percentile: float
    direction: Direction
    label: str
    series: list[AnomalyPoint]


class TopMonth(ApiModel):
    rank: int
    year: int
    month: int
    count: int


class TopYear(ApiModel):
    rank: int
    year: int
    count: int


class TopResponse(ApiModel):
    meta: Meta
    aoi_id: str
    months: list[TopMonth]
    years: list[TopYear]


class Jump(ApiModel):
    step_ratio_raw: float | None
    step_ratio_harmonized: float | None
    step_ratio_modis: float | None = None
    step_ratio_placebo: float | None
    definition: str
    target: float = 1.0


class Validation(ApiModel):
    holdout_years: list[int]
    n: int
    rmse_log: float | None = None
    mape: float | None = None
    wape: float | None = None
    bias: float | None = None


class HarmoPoint(ApiModel):
    year: int
    month: int
    sensor: Sensor
    raw: int
    harmonized: int
    lo: int
    hi: int
    modis_truth: int | None = None


class HarmonizationResponse(ApiModel):
    meta: Meta
    aoi_id: str
    knot_year: Literal[2012]
    series: list[HarmoPoint]
    jump: Jump
    validation: Validation
