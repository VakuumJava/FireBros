# frontend — React + Vite + Leaflet + Plotly

## Запуск
```bash
cd frontend
npm install
cp .env.example .env     # (Windows: copy .env.example .env)
npm run dev              # http://localhost:5173
npm test                 # дымовые тесты на фикстурах
```
По умолчанию `VITE_USE_MOCK=true`: приложение читает `../contracts/fixtures/*.json`, бэкенд не нужен, сверху горит бейдж MOCK.
Живой API: в `.env` поставить `VITE_USE_MOCK=false`, поднять backend на :8000 — Vite проксирует `/api` туда (CORS не нужен).

## Карта файлов (владелец → что)
| Путь | Владелец | Что |
|---|---|---|
| `src/api/client.js` | P4 | **единственное** место с URL и параметрами API |
| `src/api/mock.js`, `useAoiData.js`, `config.js` | P4 | мок-режим, загрузка 5 эндпоинтов, константы |
| `src/components/*` | P4 | AoiMap, CoordinateForm, PeriodSelect, CalendarHeatmap, AnomalyCard, TopPeriods, HarmonizationChart, SummaryStats, ExportPanel |
| `src/components/components.css` | P4 | раскладка и структура блоков |
| `src/ui/*` | P5 | тема (`theme.css`), палитры, `Card`, `Footer`, цвета графика, форматтеры |
| `src/App.jsx`, `src/main.jsx` | P4 | сборка страницы, состояние (AOI, период, палитра) |

Данные идут одним путём: `App` → `useAoiData` → `api/client.js` → (мок | fetch) → компоненты получают готовый JSON как `data`.

## Правила контракта, которые уже соблюдены (не ломать)
- `null` в календаре рисуется штриховкой «нет данных», не нулём (есть тест).
- Легенда берёт `max` из ответа, шкала не пересчитывается на клиенте.
- Календарь управляется с клавиатуры: Tab заходит в сетку, стрелки/Home/End двигают.
- Единица везде «хотспот-дни, 1 км»; мок помечается бейджем.
- Неполный месяц: плашка «месяц-к-дате» в аномалии и жёлтая рамка NRT-ячеек в календаре.
- Один упавший эндпоинт не роняет остальные; одинаковые ошибки (422) сводятся в одну плашку.

## Что осталось (чек-лист P4)
- [ ] Переключить на живой API и сверить поля (`npm run dev` с `VITE_USE_MOCK=false`).
- [ ] CSV: `kind=hotspots` проверить на реальном бэкенде (413 покажется в панели).
- [ ] Полигон: проверить, что бэкенд принимает `polygon=lon,lat;...`.
- [ ] Состояния «AOI вне региона» (422) визуально проверить.

## Известные грабли
- Если на карте серые квадраты — не подключён `leaflet.css` (в `AoiMap.jsx` подключён).
- `leaflet-draw` требует глобальный `L` — поэтому `leafletSetup.js` импортируется раньше него. Не менять порядок импортов.
- У прямоугольника/полигона отключён `showArea`: иначе leaflet-draw 1.0.4 падает с «type is not defined».
