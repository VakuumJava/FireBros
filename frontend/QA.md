# Simple workspace verification

The release adds bounded saved analyses, versioned sharing, WGS84 GeoJSON exchange,
a seasonal comparison and an escaped, self-contained report. The UI uses a left selection column, a dominant map and separate History,
Method and Export views. The repeated heading, competing inspector and history
dock have been removed. The anomaly summary shows the count, verdict, median and
percentile; comparison details use native disclosure.

## Recorded checks

- 152 tests pass across ten files, including named-area selection, synchronized
  months and ranges, keyboard calendar navigation, empty and missing data, CSV,
  focus return, route visibility and stale-request handling.
- New regressions cover opening the mobile map with focus and scroll, moving
  focus on view changes, revealing the selected calendar month on activation,
  and stopping Leaflet drawing when the map is hidden.
- Production build passes. Plotly remains in its own deferred chunk.
- 27 measured foreground/background token pairs meet their contrast floors.
- UIMixes dark-mode element coverage, monochrome and custom palette checks pass.
- Source slop, clutter and SVG checks have no failing rules. Warning review and
  checker limitations are in `../docs/design/simple-workspace.md`.
- Static SEO checks have no findings. Bundled font files and OFL licenses exist;
  the brief checker's font path resolution reports them missing despite correct
  CSS-relative URLs. Do not change those URLs to satisfy that diagnostic.

## Evidence limits

No Chrome DevTools or Playwright MCP is exposed. No terminal browser automation
was used. Desktop/mobile screenshots, computed contrast, actual gesture and
keyboard traversal, and Core Web Vitals remain unverified. Source tests do not
establish visual acceptance. The brief records implementation decisions as agent
choices; only the earlier dark cartographic preference was explicitly selected.

STATIC QA: source checks pass with documented checker limitations.
RENDER QA: inconclusive — no browser MCP.
BRIEF QA: implementation recorded; font-path diagnostic and rendered checks open.
PRODUCT QA: 152 tests pass; visual acceptance pending.
SEO QA: static checks pass; Core Web Vitals unmeasured.


The real Parquet integration also passed all five API contracts for a regional,
tiny and polygon AOI, both CSV modes and a single-month calendar. All 33 snapshot
output hashes matched. Report generation was exercised using actual rectangle
and polygon API responses; both retained 12 months of seasonal baselines.

The current source audit found no failing UIMixes slop/clutter rules, one
control-density advisory and no SVG errors. These remain source checks. A
standalone npm install from the lockfile is checked before release. Python
runtime dependencies are audited independently; online npm advisory lookup is
also required by CI, since a cached/offline audit cannot establish current
advisory coverage.


Seasonal chart revision: a shared zero-based nice axis, gap-safe selected-year
and median lines, historical IQR band and an exact-value inspection row replace
stretched SVG ticks. ResizeObserver sizes the chart to its visible container;
mobile month labels are thinned without removing data. Tapped months stay selected.
Chart geometry and interaction regressions pass; browser-rendered verification
remains unavailable in this environment.
