# nasa.vakuum.cc

The application is deployed at https://nasa.vakuum.cc on the existing Vakuum VPS.
SSH uses `ssh -F ~/.ssh/config.vakuum vakuum-vps`; the private key
stays on the laptop. NASA credentials and raw archives are not deployed.

## Current release

- Compose project: `vakuum-firebros` in `/srv/vakuum-firebros`.
- Release: `firebros-20261115-dce8ffebeee7`.
- Image: `vakuum-firebros:firebros-20261115-dce8ffebeee7`.
- Release directory: `/srv/vakuum-firebros/releases/firebros-20261115-dce8ffebeee7`.
- Runtime selection: `/srv/vakuum-firebros/deploy.env` (release identifiers only).
- Service: `vakuum-firebros-app-1`, UID 10001, read-only root and data, no host ports.
- Limits: 1 GiB RAM, one CPU, 128 processes; eight admitted API requests.
- Network: existing `vakuum-space_edge`; alias `vakuum-firebros-api`.
- Data: verified `harmonize-v2` snapshot, 2000-11 through 2026-11.

The image contains the existing locally built `frontend/dist`, backend and
contracts. Data is mounted from the immutable release directory. Build with
`deploy/vps/Dockerfile`; its `Dockerfile.dockerignore` admits the compiled frontend
and excludes data and secrets. A release package also uses this file as its root
`.dockerignore`. A normal checkout needs `cd frontend && npm ci && npm run build`
before this image is built.

The preceding release `firebros-20261115-103ddd710525` remains available for rollback;
its `deploy.env` is saved as `backups/deploy.env.firebros-20261115-103ddd710525`.
The current release adds the native MODIS step reference and WAPE to the API and
the calibration panel, the CSP and per-path caching, and the sandboxed DuckDB
reader. Parquet files are unchanged; only the validation report and manifest differ.

A release package is a directory with `SHA256SUMS` over every file, named after the
first twelve hex digits of that list's hash. Verify it and the data manifest on the
server before `docker build`; extract with `--no-same-owner` so files keep 0644/0755
and UID 10001 can read the mounted data.

## Caddy and DNS

The application sets CSP, frame, referrer, permissions and cache headers itself.
The route adds only HSTS and uses `defer` so it never duplicates them; it also
strips `Server` and `Via`. The previous route is saved as
`/srv/vakuum-firebros/backups/nasa.caddy.20261114T2245Z`.

DNS already resolved to the VPS; no DNS records were changed. Caddy issued a
Let's Encrypt certificate for the explicit `nasa.vakuum.cc` site. Port 80 redirects
to HTTPS. Only GET, HEAD and OPTIONS are accepted at this site.

The new route is isolated in:

`/srv/vakuum-space/releases/store-20261102/deploy/vps/caddy.d/nasa.caddy`

The main Caddyfile imports `/etc/caddy/optional/*.caddy`, which maps to that
directory. Its bytes were not changed. Caddy was validated and reloaded through
`/tmp/FireBros-Caddyfile.next` in the existing container; it was not recreated.
A copy of `deploy/vps/nasa.caddy` is also in the laptop's VakuumSpace repository
under `deploy/vps/caddy.d/`, so future Space release packages can retain it.
Keep this optional file and network alias during future Space deployments.
The filename `nasa` must not be used for an unrelated Vakuum Link page.

## Status and updates

```bash
ssh -F ~/.ssh/config.vakuum vakuum-vps
cd /srv/vakuum-firebros
sudo docker compose --env-file deploy.env -p vakuum-firebros -f compose.yaml ps
sudo docker compose --env-file deploy.env -p vakuum-firebros -f compose.yaml logs --tail 100
```

Build each update in a new release directory with a unique image tag. Verify the
release-files hashes and the data manifest, build the image, then update
`FIREBROS_RELEASE` and `FIREBROS_RELEASE_DIR` in `deploy.env` and run:

```bash
sudo docker compose --env-file deploy.env -p vakuum-firebros -f compose.yaml up -d --wait --wait-timeout 90
```

Preserve the old release and image. Roll back by restoring those two values and
running the same command. Do not rebuild live data files or recreate the shared
Caddy stack. Future frontend assets and backend code must be shipped together.

To remove only this site, remove `nasa.caddy`, validate a copy of the main
Caddyfile inside the Caddy container, and reload that copy. The pre-cutover active
configuration backup is `/srv/vakuum-firebros/backups/active-20261114T211643Z.json`.
It contains other services' secrets, so retain mode 0600 and do not copy it to Git
or print it. Restore this whole backup only after ensuring no later unrelated
Caddy changes would be overwritten.

## Verified

HTTPS, certificate, HTTP redirect, application and compiled JS/CSS returned
success. All five API requests completed concurrently; both CSV formats matched
`X-Row-Count` (monthly 1 row, hotspots 107 rows for the test AOI/month).
`nasa-release-check.json` records the current release: route validation, headers, neighbouring sites before and after the reload, API metrics, CSV rows and a browser CSP probe. `nasa-hosted-check.json` records the initial checks; `nasa-atlas-check.json` records the first redesign; `nasa-refinement-check.json` records the current refinement, asset hashes, five concurrent API responses and CSV rows. The container was healthy,
used about 85 MiB at idle and had no host port bindings. Existing `vakuum.cc` and
`house.vakuum.cc` returned 200 before and after; `vpn.vakuum.cc/` retained its
expected 404. Full mobile interaction QA remains separate from deployment checks.
