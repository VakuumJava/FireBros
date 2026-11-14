# Схема API (поля JSON)

База: `/api/v1`. Все ответы — `application/json; charset=utf-8`, кроме CSV.
Машинные схемы: [`../contracts/*.schema.json`](../contracts/). Примеры: [`../contracts/fixtures/`](../contracts/fixtures/). OpenAPI сервиса: `/api/v1/openapi.json`; интерактивная документация отключена, потому что подгружает сторонние скрипты и несовместима с CSP.

## Общее для всех ответов

| Поле | Тип | Смысл |
|---|---|---|
| `meta.source` | `"parquet"` \| `"mock"` | откуда данные. Фронт показывает бейдж, если `mock` |
| `meta.unit` | `"hotspot_days_1km"` | единица измерения, всегда |
| `meta.method_version` | str | версия метода гармонизации, попадает в подпись графика |
| `meta.region_bbox` | `[W,S,E,N]` | регион предрасчёта |
| `meta.generated_at` | ISO-8601 | время ответа |

## Параметры AOI

`bbox=68.5,38.4,80.7,43.7` **или** `polygon=74.5,42.8;75.2,42.8;75.2,43.2;74.5,43.2` — ровно один из двух.

- `bbox`: `west,south,east,north`, EPSG:4326, как у FIRMS area API.
- `polygon`: `lon,lat;...`, порядок как в GeoJSON — вывод Leaflet подходит без конвертации.
- Вне региона → `422` с текстом, содержащим `region_bbox`. Не тихий ноль.

`from` / `to` — `YYYY-MM`, по умолчанию `from=2000-01`, `to=текущий месяц`. `from > to` → `422`.

---

## `GET /aoi/summary`

Единый месячный ряд — основа всей остальной математики.

```jsonc
{
  "meta":  { "source": "parquet", "unit": "hotspot_days_1km", "method_version": "harmonize-v2", "...": "..." },
  "aoi":   { "id": "aoi_145ca8037dbb", "kind": "bbox", "bbox": [68.5,38.4,80.7,43.7],
             "area_km2": 600222.2, "cells_total": 1078, "cells_inside": 1078,
             "cells_partial": 0, "coverage_fraction": 1.0 },
  "period": { "from": "2000-01", "to": "2026-11", "months": 323 },
  "series": [{
      "year": 2012, "month": 4,
      "count": 2853,          // hotspot_days_1km
      "lo": 2238, "hi": 3468, // 95% интервал; до 2012 lo == hi == count
      "sensor": "VIIRS_SNPP", // MODIS | VIIRS_SNPP | VIIRS_NOAA20 | VIIRS_NOAA21
      "harmonized": true,
      "days_observed": 30, "days_in_month": 30
  }],
  "coverage": { "months_expected": 323, "months_present": 320,
                "gaps": ["2000-05"], "nrt_months": ["2026-11"] },
  "totals": { "hotspot_days": 444821, "peak_year": 2016, "peak_month": 4, "mean_month": 1377 }
}
```

## `GET /aoi/calendar`

```jsonc
{
  "years":  [2000, 2001, "...", 2026],       // ось Y
  "months": [1,2,3,4,5,6,7,8,9,10,11,12],   // ось X, всегда 12
  "values": [[12, 34, 480, 2714, "..."]],   // values[i] — строка года years[i]
  "max": 4230,                              // масштаб легенды, не пересчитывать на клиенте
  "palette_default": "viridis",
  "palettes": ["viridis", "cividis"],
  "unit": "hotspot_days_1km"
}
```

`values[i][j] === null` — данных нет (пробел). `0` — месяц наблюдался, хотспотов не было.

## `GET /aoi/anomaly?month=2026-11`

```jsonc
{
  "month": "2026-11", "partial": true, "through_day": 14,
  "observed": 371,
  "baseline": { "median": 301.0, "mad": 35.5, "robust_sigma": 52.6,
                "n_years": 26, "window": "same month, days <= 14" },
  "robust_z": 1.04,          // (observed - median) / (1.4826 * MAD)
  "percentile": 0.808,       // доля лет, где было не больше
  "direction": "above",      // above | normal | below
  "label": "1.0σ above the median",
  "series": [{ "year": 2000, "count": 268 }]
}
```

`window` — не украшение: при неполном месяце **каждый** год истории обрезается до того же числа дней, иначе аномалия всегда отрицательная.

## `GET /aoi/top?n=10`

```jsonc
{ "months": [{ "rank": 1, "year": 2014, "month": 4, "count": 3804 }],
  "years":  [{ "rank": 1, "year": 2014, "count": 18245 }] }
```

## `GET /aoi/harmonization`

Главный аргумент для жюри.

```jsonc
{
  "knot_year": 2012,
  "series": [{
      "year": 2012, "month": 4, "sensor": "VIIRS_SNPP",
      "raw": 5526,                 // как есть у сенсора — «до»
      "harmonized": 2853,          // в шкале MODIS — «после»
      "lo": 2238, "hi": 3468,
      "modis_truth": 3213          // настоящий MODIS в тот же месяц; только в перекрытии
  }],
  "jump": {
      "step_ratio_raw": 1.859,         // наивная склейка: сенсор плюс реальная изменчивость
      "step_ratio_harmonized": 1.048,  // после калибровки
      "step_ratio_modis": 1.012,       // что увидел сам MODIS в тот же переход — эталон
      "step_ratio_placebo": 0.922,     // контрольный год без смены сенсора
      "definition": "median_m[ value(knot,m) / median(value(knot-3..knot-1, m)) ]",
      "target": 1.0
  },
  "validation": { "holdout_years": [2024, 2025], "n": 24,
                  "rmse_log": 0.074, "mape": 0.067, "wape": 0.058, "bias": 0.003 }
}
```

На графике: `raw` и `harmonized` линиями, `lo/hi` полосой, `modis_truth` точками, вертикаль на `knot_year`.

MODIS продолжал наблюдения в 2012 году, поэтому `step_ratio_harmonized` сравнивается с `step_ratio_modis`, а не с единицей: реальный сезон может быть тише или активнее прошлых лет. `wape` — сумма абсолютных ошибок, делённая на сумму MODIS; в отличие от `mape` она не взрывается на месяцах с одной-двумя детекциями.

## `GET /aoi/export.csv?kind=hotspots|monthly`

`text/csv; charset=utf-8` с BOM (чтобы русский Excel открывал без пляски), `Content-Disposition: attachment`, заголовки `X-Row-Count` и `X-Unit`.

`kind=hotspots` — сырые детекции:

```
latitude,longitude,acq_date,acq_time,satellite,instrument,sensor_family,confidence,frp,daynight,grid_cell
```

`kind=monthly` — сводная таблица (то, что на графике):

```
year,month,count,lo,hi,sensor,harmonized,days_observed,days_in_month
```

Больше `FIREBROS_CSV_MAX_ROWS` (по умолчанию 100 000) → `413` с просьбой сузить AOI или период. Лучше внятный отказ, чем вкладка, которая умерла.

## `GET /meta/health`, `GET /meta/region`

`health` — версия, источник, есть ли Parquet, лимит CSV. `region` — bbox, сетка, число ячеек, год стыка, атрибуция.
Первый запрос при любом «а почему пусто».

## Коды ошибок

| Код | Когда | Тело |
|---|---|---|
| `422` | битый bbox/polygon, `from > to`, AOI вне региона, месяц из будущего | `{"detail": "..."}` с человеческим текстом |
| `413` | CSV больше лимита | `{"detail": "narrow the AOI or the period"}` |
| `503` | Parquet есть, но не читается | `{"detail": "store not ready"}` |

## Implementation notes (current)

- `GET /aoi/top` accepts optional `from` / `to` with the same bounds as summary.
- A partial-month anomaly requires the precomputed cumulative artifact. Missing exact coverage returns 404, missing artifact returns 503. Full-month histories use complete months only.
- Health adds `first_month`, `last_month`, `monthly_rows`, `exact_prefixes`, `built_at` and `method_version` when available. They describe the installed dataset, not forecast coverage or validation approval.
- CSV adds `X-Data-Source` and `X-Method-Version`; `X-Row-Count` is the number of data rows excluding the header.
- Busy servers may return 503 with `Retry-After`; excessive query bytes return 414.
- Partial coverage across the selected spatial cells is considered unavailable, not a complete observation.
- `nrt_months` is a legacy field for partial months and is not a definitive inventory of NRT-origin records.

`jump` is a descriptive temporal ratio, not a causal measure of sensor bias.
The implementation requires each contributing calendar month to have three prior
complete years. The independent pipeline report also publishes paired
same-period sensor ratios; its cell-level MAPE differs from the API's AOI-total
MAPE because aggregation occurs before the API error metric.
