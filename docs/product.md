# Product and next validation

Ala-Too Fire Atlas helps a researcher, land manager or emergency planner answer:
“How unusual is this month in this area compared with its available history?”

## Current workflow

1. Draw an area, enter bounds or import one WGS84 GeoJSON polygon.
2. Choose a month and read its count, historical median and percentile.
3. Open History for the calendar and seasonal median/interquartile comparison.
4. Inspect Method for the sensor transition, uncertainty and validation error.
5. Save the analysis in this browser, copy its link, export CSV/GeoJSON, or
   download a self-contained report for printing and sharing.

Saved areas are local, not team accounts. Shared links include geometry and dates.
Reports preserve the selected geometry, range, source, method and statistics; they
reject stale or mixed responses. No external services are needed to read a report.
A report can be printed to PDF using the browser's print dialog.

## Evidence boundaries

The same-month anomaly baseline excludes the selected year. Seasonal comparison
also excludes the selected year, missing values and incomplete months, requiring
three complete baseline years per month. Zero is an observation; a missing month
is not zero. The seasonal range is the middle 50% of years, not a forecast or a
confidence interval around the calibration.

The calibrated series still has material local error. This release supports
historical analysis; it does not detect incidents, send operational alerts,
estimate burned area or assign evacuation risk. No accuracy, customer, revenue or
competition result is asserted without evidence.

## Pilot plan

Test the same task with a researcher, an emergency planning representative and a
land manager: select a familiar area, interpret a known month, and send a report.
Record completion time, misinterpretation of units/coverage, useful decisions and
missing data. The next product decision should follow these observations.

Potential pilots are recurring seasonal briefs and reproducible regional research.
A paid service needs validated user demand and operational reliability first.
Authentication, team workspaces, notifications and country-wide expansion are
future decisions, not incomplete controls in the current interface.

## Release acceptance

- Contract-valid real-data responses and both CSV modes, including empty and
  tiny areas, short periods and row-limit rejection.
- Unit/integration checks for URL/GeoJSON/storage bounds, stale state, report
  consistency, keyboard interaction and request admission.
- Clean build and recorded source/dependency checks.
- Desktop/mobile browser acceptance remains required before claiming production
  readiness; current environment does not expose the required browser MCP.
