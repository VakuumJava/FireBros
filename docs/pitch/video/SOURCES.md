# Source provenance

The application images are exact crops of a HyperFrames local-file capture of
`frontend/dist` with responses from the local FastAPI service. Capture data:
`assets/responses.json`. Report: `assets/harmonization_report.json`.

Selection: whole region [68.5,38.4,80.7,43.7], November2000–November2026;
anomaly comparison October2025. All responses report `parquet`, method
`harmonize-v2`. The capture copy freezes responses for reproducible media only;
it is not the deployed application. No count was retouched.

Data: NASA FIRMS MODIS/VIIRS. Map tiles: OpenStreetMap contributors; their
attribution remains in the captured map. Motion primitive: HyperFrames registry
`blur-in`, adapted to the existing app palette. GSAP3.15.0 is vendored for
network-independent rendering. HyperFramesCLI0.9.47 is pinned in package scripts.

Pitch numbers distinguish global paired-cell totals, local cell accuracy and
AOI monthly accuracy. The model was revised after examining holdout diagnostics;
the evaluation is internal and is not an untouched final benchmark.

Typography: the captured application uses its system-font stack. The movie's
large explanatory type uses Inter resolved by HyperFrames' compiler into
cached deterministic `@font-face` rules (11 faces fetched/cached during the
check); it is not a font file vendored in this project's assets directory.
