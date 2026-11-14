# Frontend

React 18, Vite, Leaflet and Plotly. Node 22.12+ is required. The API contract lives in `../contracts`.

```bash
npm ci
npm run dev
npm run build
npm test
```

The default mode calls `/api/v1`; Vite proxies that prefix to `localhost:8000`.
Copy `.env.example` to `.env` when overriding deployment settings. Set
`VITE_USE_MOCK=true` only for a backend-free fixture preview. The preview names
its fixed sample region explicitly and never presents fixture calibration
metrics as measured results.

Draw a rectangle/polygon or enter bounds within the supported region, choose
an inclusive month range, and select a calendar cell to compare that month
against history. Keyboard users can navigate cells with arrows/Home/End and
select with Enter/Space. Null cells represent unavailable observations;
zero is an observed month without hotspots. At startup, archive health
metadata selects its latest available month instead of inventing current data.

Panels fail independently. A changed AOI clears previous values, pending
requests are canceled, and Retry refreshes the selection. CSV uses the active
AOI/range, the response filename, and `X-Row-Count`. Exports can be canceled;
limit errors are displayed without initiating a download.

`src/api/` owns transport and loading state. `src/components/` owns product
controls/charts. `src/ui/` owns tokens, common presentation and limitations.
Plotly loads lazily. The map uses OpenStreetMap tiles, which require a network
connection; manual coordinate entry remains available independently.

Verification evidence and limitations are recorded in `QA.md`. A passing
build/unit suite does not substitute for desktop/mobile browser inspection.
