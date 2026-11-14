from __future__ import annotations

import argparse
import json
import os
import platform
import tempfile
import time
from datetime import UTC, date, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from .aggregate import aggregate, cumulative_year
from .config import (
    HOTSPOT_COLUMNS,
    MONTHLY_COLUMNS,
    REGION,
    file_sha256,
    write_json,
)
from .grid import load_inputs
from .harmonize import METHOD_VERSION, apply_calibration, harmonize
from .ingest import IngestError, download_archive, download_area, download_missing_dates
from .validate import validate


def write_parquet(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pandas(frame, preserve_index=False).replace_schema_metadata(None)
    pq.write_table(table, path, compression="zstd", version="2.6", row_group_size=65536)


def build(
    raw_dir: Path,
    output_dir: Path,
    start: date,
    end: date,
    *,
    assume_complete: bool = False,
    cumulative: bool = True,
) -> dict:
    began = time.monotonic()
    if start > end or end > date.today():
        raise ValueError("Use an ordered date range ending no later than today")
    raw_dir, output_dir = raw_dir.resolve(), output_dir.resolve()
    if raw_dir == output_dir or raw_dir in output_dir.parents or output_dir in raw_dir.parents:
        raise ValueError("Raw and processed directories must be separate")
    paths = sorted(raw_dir.rglob("*.csv"))
    if not paths:
        raise ValueError("No raw CSV input; use --download archive or import FIRMS CSV first")
    detections, coverage, inputs = load_inputs(paths, start, end, assume_complete)
    print(
        f"Loaded {len(detections):,} regional detections from {len(paths)} input files", flush=True
    )
    monthly = aggregate(detections, coverage)
    unified, calibration = harmonize(monthly)
    report = validate(monthly, unified, calibration)
    output_dir.mkdir(parents=True, exist_ok=True)
    lock = output_dir / ".build.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError(
            "A build lock exists; finish the running build or remove its stale lock"
        ) from None
    try:
        os.close(descriptor)
        with tempfile.TemporaryDirectory(prefix=".firebros-build-", dir=output_dir.parent) as temp:
            staging = Path(temp)
            write_parquet(unified[list(MONTHLY_COLUMNS)], staging / "cells_monthly.parquet")
            write_parquet(calibration, staging / "calibration.parquet")
            write_parquet(coverage, staging / "coverage.parquet")
            write_parquet(monthly, staging / "sensor_monthly.parquet")
            hotspot_dir = staging / "hotspots"
            hotspot_dir.mkdir()
            for year, frame in detections.groupby(detections.acq_date.dt.year):
                export = frame[list(HOTSPOT_COLUMNS)].copy()
                export["acq_date"] = export.acq_date.dt.date
                write_parquet(export, hotspot_dir / f"{year}.parquet")
            if not any(hotspot_dir.iterdir()):
                write_parquet(detections[list(HOTSPOT_COLUMNS)], hotspot_dir / "empty.parquet")
            if cumulative:
                writer = None
                try:
                    for year in sorted(coverage.acq_date.dt.year.unique()):
                        prefixes = cumulative_year(detections, coverage, int(year))
                        calibrated = apply_calibration(
                            prefixes,
                            calibration,
                            reference_monthly=monthly.loc[monthly.year.eq(year)],
                        )
                        calibrated = calibrated[[*MONTHLY_COLUMNS, "through_day"]]
                        table = pa.Table.from_pandas(
                            calibrated, preserve_index=False
                        ).replace_schema_metadata(None)
                        if writer is None:
                            writer = pq.ParquetWriter(
                                staging / "cells_cumulative.parquet",
                                table.schema,
                                compression="zstd",
                                version="2.6",
                            )
                        if table.schema != writer.schema:
                            table = table.cast(writer.schema)
                        writer.write_table(table, row_group_size=65536)
                        print(f"Built cumulative daily windows: {year}", flush=True)
                finally:
                    if writer:
                        writer.close()
            write_json(staging / "harmonization_report.json", report)
            outputs = {
                str(path.relative_to(staging)): file_sha256(path)
                for path in sorted(staging.rglob("*"))
                if path.is_file()
            }
            manifest = {
                "schema_version": 1,
                "source": "NASA FIRMS",
                "method_version": METHOD_VERSION,
                "runtime": {
                    "python": platform.python_version(),
                    "numpy": np.__version__,
                    "pandas": pd.__version__,
                    "pyarrow": pa.__version__,
                },
                "created_at": datetime.now(UTC).isoformat(),
                "bbox": list(REGION),
                "requested_range": [start.isoformat(), end.isoformat()],
                "range": [
                    coverage.acq_date.min().date().isoformat(),
                    coverage.acq_date.max().date().isoformat(),
                ],
                "grid_degrees": 0.25,
                "dedup_grid_degrees": 0.01,
                "unit": "hotspot_days_1km",
                "coverage_basis": "dates covered by published archives/API or declared local imports; not cloud-free satellite coverage",
                "assume_complete_local_imports": assume_complete,
                "inputs": inputs,
                "outputs": outputs,
                "n_detections": len(detections),
                "n_monthly_cells": len(unified),
                "build_seconds": round(time.monotonic() - began, 3),
            }
            write_json(staging / "manifest.json", manifest)
            for path in sorted(staging.rglob("*")):
                if path.is_file() and path.name != "manifest.json":
                    target = output_dir / path.relative_to(staging)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    os.replace(path, target)
            expected_hotspots = {name for name in outputs if name.startswith("hotspots/")}
            for old in (output_dir / "hotspots").glob("*.parquet"):
                if str(old.relative_to(output_dir)) not in expected_hotspots:
                    old.unlink()
            if not cumulative:
                (output_dir / "cells_cumulative.parquet").unlink(missing_ok=True)
            os.replace(staging / "manifest.json", output_dir / "manifest.json")
        return manifest
    finally:
        lock.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build reproducible regional FIRMS analysis products"
    )
    parser.add_argument("--raw-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/processed"))
    parser.add_argument("--start", type=date.fromisoformat, default=date(2000, 11, 1))
    parser.add_argument("--end", type=date.fromisoformat, default=date.today())
    parser.add_argument("--download", choices=["none", "archive", "api", "all"], default="none")
    parser.add_argument(
        "--download-only",
        action="store_true",
        help="Fetch input data without building analysis products",
    )
    parser.add_argument("--workers", type=int, choices=range(1, 9), default=4)
    parser.add_argument(
        "--include-noaa",
        action="store_true",
        help="Download NOAA-20 for diagnostics; primary series remains SNPP",
    )
    parser.add_argument(
        "--assume-complete",
        action="store_true",
        help="Explicitly declare local CSV exports cover all requested dates",
    )
    parser.add_argument(
        "--skip-cumulative",
        action="store_true",
        help="Skip prefix artifact; exact partial-month anomaly will be unavailable",
    )
    args = parser.parse_args()
    try:
        if args.download in ("archive", "all"):
            download_archive(args.raw_dir, args.start, args.end, args.workers, args.include_noaa)
        if args.download == "api" or (
            args.download == "all" and args.end.year == date.today().year
        ):
            download_area(
                args.raw_dir,
                max(args.start, date(date.today().year, 1, 1))
                if args.download == "all"
                else args.start,
                args.end,
                os.getenv("FIRMS_MAP_KEY", ""),
                args.include_noaa,
            )
        if args.download != "none":
            download_missing_dates(args.raw_dir)
        if args.download_only:
            print("Download complete; analysis build skipped")
            return 0
        manifest = build(
            args.raw_dir,
            args.output_dir,
            args.start,
            args.end,
            assume_complete=args.assume_complete,
            cumulative=not args.skip_cumulative,
        )
    except (ValueError, IngestError) as exc:
        parser.exit(1, f"Build failed: {exc}\n")
    print(
        json.dumps(
            {
                "range": manifest["range"],
                "n_detections": manifest["n_detections"],
                "build_seconds": manifest["build_seconds"],
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
