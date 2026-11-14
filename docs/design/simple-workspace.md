# Simple workspace: implementation and verification

Recorded 2026-11-14, 23:25 UTC. Scope: current `frontend/src`, including retained legacy components and test files. Checks used the installed UIMixes scripts under `/home/vakuum/.agents/skills/uimixes/scripts`. This is source-level evidence, not a visual acceptance report.

## Design decisions

The recorded brief requests a quiet dark map application: choose an area and month, read the anomaly, then inspect history, method or export. The implementation keeps the existing React, CSS, Leaflet and Plotly stack.

- One control column and a dominant map replace competing analysis panels and the history dock.
- The initial anomaly view contains the observed count, verdict, median and percentile. Native disclosure retains sigma, baseline years, standardized score, historical bars and the comparison window. Incomplete-month information remains visible.
- On narrow screens, controls stack first and the map opens through an explicit toggle. Named top navigation retains Map, History, Method and Export.
- Tokens define graphite surfaces (`#111315`, `#191c1f`, `#222629`), warm emphasis (`#e4a476`), sage comparison (`#92b6aa`), 8px corners and 44px controls. Contrast results are recorded separately by the integration owner.
- IBM Plex Sans and JetBrains Mono are locally bundled with OFL license files. Typography uses Plex for the interface and Mono for coordinates.

## Commands and results

Run from the repository root; `$UIMIX` below denotes the installed scripts directory.

| Command | Observed result | Interpretation |
| --- | --- | --- |
| `python3 $UIMIX/ask.py gate` | Exit 0; 27 answers on file | Intake is complete. This does not independently confirm delegated style assumptions. |
| `python3 $UIMIX/slopcheck.py frontend/src --score` | Exit 0; 41 files, 0 failing rules, 17 warnings, worst file 8/100 | No source-level failing pattern. Warnings reviewed below. The score does not measure the composed screen. |
| `python3 $UIMIX/clutter_check.py frontend/src --profile app` | Exit 0; 41 files, 0 failures, 2 warnings | Per-file budgets pass. Composed-page density remains unmeasured. |
| `python3 $UIMIX/svg_check.py frontend/src` | Exit 0; 43 files, 0 errors, 0 warnings | Static SVG checks pass. |
| `python3 $UIMIX/verify_ui.py frontend/src --json` | Exit 1; 54 files, 6 errors, 29 warnings | Reported focus errors conflict with existing cross-file CSS rules; this gate is not reported as green. |
| `python3 $UIMIX/shellcheck.py frontend/src/App.jsx frontend/src/ui/AppShell.jsx frontend/src/ui/theme.css` | Exit 2: no HTML given | Inconclusive: this checker requires an HTML document and cannot assess the JSX shell directly. |

The final integration run passed 75 frontend tests and the production build. New regression coverage includes map reveal/focus, view focus, calendar activation and drawing cleanup.

## Warning review

**React handlers.** Fourteen slop warnings concern `onClick`, `onChange` and `onSubmit` props, including a test mock and legacy shell. These are React event props bound to component state and callbacks, not executable HTML event attributes. Moving each closure into a named function would not change its interaction model.

**Calendar states.** The calendar's selection shadows have zero blur and delineate selected or hovered cells. Missing-data hatching encodes absent observations; it is not background decoration. The retained legacy shell also contains hatching, but `main.jsx` renders `App`, which does not import that shell.

**Clutter warnings.** The five-radius warning belongs to retained `legacy-shell.css`. `PeriodSelect.jsx` receives a control-density warning for four controls among 62 words; it is a compact date-range form, so prose expansion would impede the task. Neither warning establishes the density of a rendered view.

**Focus findings.** All six reported errors refer to `AoiMap.jsx`. `ui/theme.css` defines a global `:focus-visible` outline; `components/map.css` explicitly defines focus for `.atlas-tool`, `.atlas-map .atlas-text-button`, Leaflet zoom links and attribution links. That CSS is imported by `AoiMap.jsx`. Hover and active rules also exist. The evidence supports a cross-file matching limitation in the checker; actual focus visibility still needs browser verification.

**Target sizes.** Reported 22×8px dimensions describe the decorative palette swatch inside a button. Reported 1px dimensions belong to the visually hidden helper and unfocused skip link; the skip link expands on focus. The 18px export radio sits within a padded clickable label. These are not measurements of the final clickable rectangles.

**Small text.** The checker flags 13px supporting text in export metadata/results, chart legends/context, attribution and limitation metadata. This is distinct from the main reading and control typography, but readable rendering at narrow widths and zoom remains unverified.

## Remaining verification limits

No Chrome DevTools MCP or Playwright MCP browser tools were exposed for this audit. No screenshots, viewport collision checks, computed state contrast, keyboard traversal, browser accessibility tree or Core Web Vitals were measured. Desktop/mobile visual review and the rendered shell gate remain **inconclusive**. Source assertions and component tests do not substitute for them.

Primary browser backend: unavailable. Browser MCP used: none. Terminal browser automation: **NOT USED**.


## Integration checks

- `simple-contrast.json`: 27 actual token pairs pass their text or non-text floor.
- `simple-seo.json`: static SEO has no findings.
- The static brief check: mode, palette, locale, density and copy checks pass.
  Font-file resolution fails in the checker: the three files are present under
  `frontend/public/fonts/`, with CSS URLs correctly relative to `/fonts.css`.
  This diagnostic is retained rather than altering working asset URLs.
- `elements.py check --slug dark-mode`: 1/1 pack passes. This checks the referenced
  element pack, not rendered product geometry.
- `theme.py check --slug dark-mode --theme mono` and custom palette check pass.
- The seven simplified-workspace requirements have implementation evidence in
  App, AoiMap, AnomalyCard and CSS. Actual rendered composition remains unverified.
- View transitions focus their visible heading or month field. The map reveal
  scrolls and focuses its first tool. Hidden maps stop active draw handlers;
  the calendar centers its selected month when History becomes active.


## Deployment

Released at https://nasa.vakuum.cc as `firebros-20261115-427a07eea588`.
The public HTML, entry JS/CSS, font, icon and social image match the local build
byte-for-byte. Container health is healthy; all five parallel API checks return
200 with `meta.source = parquet`. The sampled monthly CSV contains one data row,
matching `X-Row-Count`. Results are in `../deployment/nasa-simple-check.json`.
These are HTTP/data checks, not browser rendering evidence.
