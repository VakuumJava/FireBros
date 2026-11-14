# /data — сырьё FIRMS

Каталог в `.gitignore`. Сюда кладём только то, что можно пересоздать скриптом.

## 0. Ключ

`MAP_KEY` бесплатный: https://firms.modaps.eosdis.nasa.gov/api/map_key/

Ключ **никогда** не попадает в репозиторий. Только через env:

```bash
export FIRMS_MAP_KEY=xxxxx          # bash / WSL
$env:FIRMS_MAP_KEY = "xxxxx"        # PowerShell
```

## 1. Что качаем

| Сенсор | Продукт FIRMS (`SOURCE`) | Разрешение | Период | Роль |
|---|---|---|---|---|
| MODIS (Terra+Aqua) | `MODIS_SP` (science, ~2 мес. задержка), `MODIS_NRT` (последние 7 дней) | 1 км | 2000-11 → | базовая шкала |
| VIIRS SNPP | `VIIRS_SNPP_SP`, `VIIRS_SNPP_NRT` | 375 м | 2012-01 → | основной современный |
| VIIRS NOAA-20 | `VIIRS_NOAA20_SP`, `VIIRS_NOAA20_NRT` | 375 м | 2018-04 → | **выключен по умолчанию** |
| VIIRS NOAA-21 | `VIIRS_NOAA21_SP`, `VIIRS_NOAA21_NRT` | 375 м | 2023-01 → | **выключен по умолчанию** |

**Почему NOAA-20/21 выключены:** добавление второго/третьего VIIRS меняет плотность без смены разрешения. Дедупликация по `(0.01° ячейка, дата)` съедает часть эффекта, но не весь. Включаем флагом `--include-noaa` и **только** если калибровка по ним показала стабильность на hold-out. Иначе получим второй, уже рукотворный скачок.

## 2. Способ загрузки

Area API отдаёт CSV за диапазон дат по bbox:

```
https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{west},{south},{east},{north}/{days}/{date}
```

Ограничения: не более ~10 дней за запрос и ~5000 детекций на ответ — поэтому качаем **окнами по 5 дней**, батчами, с ретраями. Скрипт: `pipeline/firebros/ingest.py`.

Ручной вариант (если API капризничает): https://firms.modaps.eosdis.nasa.gov/download/ — выбрать регион, сенсор, диапазон; скачанные архивы распаковать в `data/raw/`.

## 3. Раскладка

```
data/
  raw/            # как пришло от NASA, нетронутое
    modis_sp/2000/*.csv
    viirs_snpp_sp/2012/*.csv
  interim/        # после дедупа и снапа в 0.01°, parquet по годам
  processed/      # то, что читает backend
    cells_monthly.parquet     # 0.25° × год-месяц × sensor_family
    calibration.parquet       # тайл 2° × месяц × (a, b, sigma, n)
    hotspots/                 # партиции по году для CSV-экспорта (lat/lon/date/...)
  manifest.json   # дата сборки, диапазон, хэши, версия метода
```

## 4. Лицензия и атрибуция

Данные NASA FIRMS распространяются свободно; в приложении обязательна строка атрибуции:
`NASA FIRMS — MODIS/VIIRS active fire data (2000–2026)`. Ссылку держим в футере и на `/limitations`.