# Security review

Reviewed for the November 2026 product release. This note records the boundaries
and checks of this review; it is not a certification or an exhaustive audit.

## Scope and threat model

The hosted application exposes public, read-only satellite observations. An
unauthenticated visitor can choose an area, period and export format. Visitors
cannot upload server-side files, change the dataset, run the pipeline or choose
the server's filesystem paths. Accounts, payments and private workspaces are not
part of this release.

The data pipeline runs separately with operator authority. It fetches NASA FIRMS
data, validates the inputs and builds a checksummed snapshot. The API reads that
snapshot through a read-only mount. The FIRMS key is an environment variable used
by the pipeline; it is not sent to the browser or included in exported metadata.

The review covered the backend application, pipeline runtime modules and VPS
deployment configuration. An independent source pass also reviewed ingestion,
local imports, exports, geometry validation, storage and the new request guard.
The new browser URL, GeoJSON, local-storage and report boundaries received a
separate targeted source review. Production was not subjected to intrusive tests.

## Finding and correction

The original request middleware released its query slot when a response was
constructed, before the response body finished transmitting. A slow reader could
therefore keep a buffered CSV response alive outside the intended concurrency
accounting. The ASGI server's connection limit reduced the impact; this was
classified as a low-severity resource-exhaustion issue, not arbitrary code
execution or data disclosure.

`backend/app/middleware.py` now holds the slot for the full ASGI response
lifetime. Completion, cancellation and errors release it. Static files do not
consume analysis slots. Oversized-query and busy responses receive the same
security headers as successful responses. CORS preflight and unexpected error
responses retain those headers, and unexpected errors return a generic message.

The pre-change Codex Security record is
`ed37c3b6-1d59-4a07-ab93-d7b83ef01c7a`. Its coverage is explicitly partial. The
finding remains evidence about the original snapshot; passing regression tests
after the correction does not turn it into a clean audit of every later change.

## Controls checked

| Boundary | Control and evidence |
| --- | --- |
| Public request to geometry | Finite coordinates, region bounds, query length, vertex count, nonzero area and self-intersection checks in `backend/app/geo.py`; date and period limits in `backend/app/routers/aoi.py`. |
| Geometry to database | SQL values are bound parameters. Cell predicates are generated from validated cell indices, not caller-provided SQL. DuckDB permits the snapshot directory, disables external access and locks configuration in `backend/app/store/parquet.py`. |
| Dataset to API | Required-data mode refuses missing or tampered snapshots. Manifest output paths are resolved and checked for containment before checksums are read. |
| NASA to pipeline | The download origin is fixed to official FIRMS HTTPS, redirects are refused, responses are size-bounded, and archive filenames must match a restrictive pattern. Network errors withhold the credential-bearing URL. |
| Export to spreadsheet | `backend/app/export.py` neutralizes formula-leading string cells, including formulas preceded by whitespace. Columns and attachment names are server-selected. |
| Browser URL to selection | `frontend/src/workspace/selectionUrl.js` bounds URL length, rejects duplicate or conflicting settings, validates dates and geometry, and accepts only known palettes and views. Generated links use HTTP or HTTPS and remove URL credentials. |
| GeoJSON to selection | Import is limited to 32 KiB and one closed WGS84 polygon without holes. Unsupported CRS declarations, non-finite or out-of-region coordinates, repeated or crossing vertices and excessive vertex counts are rejected. No file is uploaded to the server. |
| Browser storage | Saved selections are versioned, capped at 12 entries, size-bounded and revalidated on read. Names are treated as text. Storage denial or malformed content produces a recoverable error. These are local convenience settings, not encrypted private records. |
| Analysis to downloaded report | `frontend/src/analysis/report.js` checks area, period, source and method consistency before export. Dynamic strings and geometry are HTML-escaped. The report contains no scripts or external assets and carries a restrictive content policy. Its attachment filename is derived from a validated month. |
| Process to host | The container uses a non-root UID, a read-only root filesystem and dataset, dropped capabilities, no host port binding, and bounded memory, CPU, processes and log size. Caddy supplies TLS and restricts request methods. |

The browser's 100-vertex limit is intentionally stricter than the backend's
500-vertex maximum. Server-side validation remains authoritative; browser checks
are not trusted as a security boundary.

## Verification

The Python suite passed **91 tests**, including four new regressions for response
body lifetime, cancellation, CORS preflight headers and generic error headers.
Backend Ruff lint and formatting checks passed. A separate `pip-audit` run against
backend and pipeline runtime requirements found no known vulnerabilities in 26
resolved packages; this is advisory-database coverage, not proof of safety. Existing tests cover malformed
AOIs, oversized requests, CSV limits and columns, formula neutralization,
snapshot integrity, restricted file reads and exact comparison windows.

Targeted frontend tests cover untrusted selection links, GeoJSON, storage and
report text. Source review verified that report fields flow through escaping
and that structured imports are normalized rather than merged into application
objects. The release checklist should use the latest complete test run after
integration; the counts above describe this security change's verification.

## Remaining limits

- This review does not establish resistance to distributed denial of service.
  Slow clients can occupy admitted slots; transport timeouts and connection
  limits remain responsibilities of the ASGI server and reverse proxy.
- Runtime enforcement of the VPS configuration, a full browser security review,
  and all dependency advisories were not independently verified by this source
  audit. CI dependency checks and deployment smoke checks are separate evidence.
- There was no complete security audit of every repository document, test,
  development tool or later integration change. No additional reportable issue
  survived the inspected backend, pipeline and deployment paths.
- Public shared links contain the selected geometry and dates. Share only areas
  that may be disclosed. Local saved areas are accessible to scripts running on
  the same origin and to people using the same browser profile.
- Input validation and calibration provenance do not establish operational fire
  prediction accuracy. The product's scientific limitations still apply.

Future authentication, private data, alerts, billing or server-side uploads
would introduce new trust boundaries and require their own review before
release.
