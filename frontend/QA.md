# Fire Atlas interface refinement

The second pass replaces the promotional composition with a compact research
workspace. It removes slogans and numbered section labels, gives each active
component one stylesheet, and moves the legacy UI shell out of the runtime CSS.
The map editor collapses on mobile, retaining area context above the assessment.
Calendar scrolling is bounded with an explicit full-archive control.

## Verified

- 60 Vitest tests across eight files. Coverage includes AOI/period request races,
  zero versus missing observations, keyboard calendar movement, archive expansion,
  ranking selection, shared month state, focus return after area selection,
  dialog focus lifecycle, one-month chart markers, chart errors, CSV safety and
  contrast over both calendar ramps.
- Production Vite build passed. Plotly remains lazy loaded.
- 22 actual palette foreground/background pairs passed their required floors.
  Body text: 13.32:1 on white; secondary text: 6.28:1; primary button: 7.72:1;
  control border: 3.61:1 on white. See `docs/design/refinement-contrast.json`.
- Clutter checks over all eight active CSS files: zero failures, zero warnings.
- Source slop check: zero failing rules. Retained warnings concern React event
  handlers and semantic calendar hatching/selection outlines.
- UI SVG audit: zero errors and warnings. Font files and licenses verified.
- Static SEO checks: zero findings. Git whitespace checks passed.

## Unverified

No Chrome DevTools or Playwright MCP tools are exposed in this session. A
request to connect Chrome DevTools was presented; no approval has arrived.
No installation or terminal browser automation was performed. Browser layout,
mobile reflow, rendered state contrast, gestures and Core Web Vitals remain
INCONCLUSIVE. Mocked focus and chart tests do not establish browser acceptance.

The brief uses agent decisions under the user's delegated design scope.
`ask.py gate` passes. The stricter `agree` correctly reports those assumptions
as unconfirmed. Static brief checking now resolves palette roles but cannot
resolve the SPA navigation or public font paths without a served snapshot.
`verify_ui` reports missing map focus styles because its parser does not follow
`insights.css`; the selectors exist and need rendered confirmation.

Before presentation, verify 320, 375, 768, 1024, 1280 and 1440px, especially map
expansion/recentering, internal calendar scrolling, reduced motion, export and
modal focus. Existing pitch screenshots and video show older UI revisions and
must not be treated as evidence for the current design.

STATIC QA: source checks pass; runtime shell evidence incomplete.
RENDER QA: inconclusive — no browser MCP.
BRIEF QA: partial — static palette checks pass, served SPA check pending.
PRODUCT QA: 60 component/regression tests pass; browser acceptance pending.
SEO QA: static checks pass; Lighthouse/Core Web Vitals unmeasured.
