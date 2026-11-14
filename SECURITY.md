# Security

Report a vulnerability through the repository's private vulnerability reporting
feature when available. Otherwise contact the repository owner privately; do not
post credentials, sensitive locations or a working exploit in a public issue.
Include the affected revision, impact and smallest safe reproduction.

The supported deployment is the current `main` revision behind a TLS reverse
proxy, with immutable validated Parquet data and a non-root, read-only container.
The public service exposes read-only analysis and bounded exports. It is a
research application, not an emergency alerting or dispatch system.

## Security boundaries

- NASA credentials belong only in the offline ingestion environment. They must
  never enter Git, logs, browser bundles or exported reports.
- Treat AOI coordinates, URL state, GeoJSON and browser storage as untrusted.
  Reject invalid and oversized values; do not execute supplied markup or URLs.
- Bind SQL values, keep DuckDB extensions and external access restricted to the
  data snapshot, and verify artifact hashes before activating a release.
- Retain request admission, CSV row limits, query limits, CSP and safe CSV cells.
  A download counts against admission until its response finishes.
- New endpoints, external hosts, permissions or persistent services require an
  explicit review of their inputs, resource bounds and deployment configuration.

## Maintenance

CI runs Python lint/tests, frontend format/tests/build and production dependency
advisory checks. Dependabot proposes dependency updates. Source code review and
unit tests do not prove absence of vulnerabilities; the recorded security review
states its scope and limitations in `docs/security-review.md`.

Saved areas stay in the browser's local storage. Analysis links contain their
coordinates and dates. GeoJSON is parsed locally, not uploaded. Reports contain
selected coordinates and analysis data, so share them with the intended audience.
