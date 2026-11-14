# frontend - React + Vite + Leaflet + Plotly

## Run
```bash
cd frontend
npm install
cp .env.example .env     # Windows: copy .env.example .env
npm run dev              # http://localhost:5173
npm test                 # smoke tests on fixtures
```
By default `VITE_USE_MOCK=true`: the app reads `../contracts/fixtures/*.json`, no backend needed, and a MOCK badge is shown at the top.
Live API: set `VITE_USE_MOCK=false` in `.env` and start the backend on :8000. Vite proxies `/api` there (no CORS needed).

## File map (owner -> contents)
| Path | Owner | What |
|---|---|---|
| `src/api/client.js` | P4 | the **only** place with API URLs and parameters |
| `src/api/mock.js`, `useAoiData.js`, `config.js` | P4 | mock mode, loading the 5 endpoints, constants |
| `src/components/*` | P4 | AoiMap, CoordinateForm, PeriodSelect, CalendarHeatmap, AnomalyCard, TopPeriods, HarmonizationChart, SummaryStats, ExportPanel |
| `src/components/components.css` | P4 | layout and structure of blocks |
| `src/ui/*` | P5 | theme (`theme.css`), palettes, `Card`, `Footer`, chart colours, formatters |
| `src/App.jsx`, `src/main.jsx` | P4 | page assembly, state (AOI, period, palette) |

Data flows one way: `App` -> `useAoiData` -> `api/client.js` -> (mock | fetch) -> components receive ready JSON as `data`.

## Contract rules already respected (do not break)
- `null` in the calendar is drawn hatched as "no data", never as zero (there is a test).
- The legend uses `max` from the response; the scale is never recomputed on the client.
- The calendar works from the keyboard: Tab enters the grid, arrows/Home/End move.
- The unit is "hotspot-days, 1 km" everywhere; mock data is flagged with a badge.
- Incomplete month: a "month-to-date" note in the anomaly card and a yellow NRT frame in the calendar.
- One failing endpoint does not take down the rest; identical errors (422) are merged into one banner.
- The UI language is English only; a test fails if any Cyrillic character appears in `src/`.
  The anomaly headline is built on the client, so the backend `label` field is not displayed.

## TODO (P4 checklist)
- [ ] Switch to the live API and check the fields (`npm run dev` with `VITE_USE_MOCK=false`).
- [ ] CSV: test `kind=hotspots` on the real backend (a 413 will show in the panel).
- [ ] Polygon: check that the backend accepts `polygon=lon,lat;...`.
- [ ] Visually check the "AOI outside region" (422) state.

## Known pitfalls
- Grey squares on the map mean `leaflet.css` is not loaded (it is imported in `AoiMap.jsx`).
- `leaflet-draw` needs a global `L`, which is why `leafletSetup.js` is imported before it. Do not change the import order.
- `showArea` is disabled for the rectangle and polygon: otherwise leaflet-draw 1.0.4 crashes with "type is not defined".
