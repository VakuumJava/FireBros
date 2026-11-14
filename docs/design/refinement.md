# Interface refinement

The first atlas design still read like a launch page. This pass prioritizes the
research task: selected place, chosen month, its historical interpretation, then
archive and model evidence. The competing alternative was a data-story layout;
it was rejected because it delayed the first useful result.

The existing UIMixes infographic grammar remains: factual captions, explicit
units, tabular values, restrained rules and meaningful data color. IBM Plex Sans
and JetBrains Mono remain self-hosted. Neutral surfaces and green controls carry
the working interface; earth red indicates the raw sensor series and elevated
activity. The map and data, rather than decoration, establish the identity.

Changes:

- Compact factual heading replaces the display slogan and numbered labels.
- Mobile opens with selected-area context and the monthly result. Map editing
  can be expanded; successful selection restores focus to its visible trigger.
- A single token file controls the active interface. Map, calendar, chart,
  export and limitations have dedicated stylesheets. Legacy shell styles are
  excluded from the current runtime bundle.
- All calendar years remain available in a bounded scroll area with sticky
  labels, explicit expansion and keyboard scrolling contained in that area.
- Loading reserves component-specific space and does not present stale numbers.
- The chart uses an HTML legend, readable diagnostics and markers for one-month
  ranges. Its colors come from the same CSS tokens as the interface.
- The footer retains NASA attribution and opens one accessible limitations
  dialog, instead of duplicating its contents.

Actual browser verification is not available; `frontend/QA.md` records that
limitation. Test assertions and static check results are not claimed as rendered
visual acceptance. The previous pitch video is stale for this interface.

Release: `firebros-20261115-103ddd710525`. The previous release remains available for rollback.

Public verification passed: compiled HTML/CSS/JS/fonts match local bytes; all five API endpoints return 200 with parquet provenance; monthly CSV row count matches the header. Detailed results: `../deployment/nasa-refinement-check.json`.
