from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from jsonschema import Draft7Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT7


def verify(output: Path | None = None) -> dict:
    settings = Settings.from_env()
    if not settings.has_parquet:
        raise RuntimeError("Release verification requires real Parquet data")
    manifest = json.loads((settings.data_dir / "manifest.json").read_text())
    for relative, expected in manifest["outputs"].items():
        artifact = (settings.data_dir / relative).resolve()
        if not artifact.is_relative_to(settings.data_dir.resolve()):
            raise RuntimeError("Manifest path escapes the data directory")
        with artifact.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != expected:
            raise RuntimeError(f"Artifact checksum mismatch: {relative}")
    schemas = {
        path.name: json.loads(path.read_text())
        for path in settings.contracts_dir.glob("*.schema.json")
    }
    registry = Registry().with_resources(
        (key, Resource.from_contents(schema, default_specification=DRAFT7))
        for name, schema in schemas.items()
        for key in (name, schema["$id"])
    )
    measurements = []
    with TestClient(create_app(settings)) as client:
        health = client.get("/api/v1/meta/health").json()
        if health.get("source") != "parquet":
            raise RuntimeError("Release verification must not use fixtures")
        month = health["last_month"]
        selections = [
            {"bbox": "68.5,38.4,80.7,43.7"},
            {"bbox": "74.45,42.80,74.4501,42.8001"},
            {"polygon": "74.4,42.7;75.4,42.7;75.4,43.3;74.4,43.3"},
        ]
        for selection in selections:
            for endpoint in ("summary", "calendar", "anomaly", "top", "harmonization"):
                params = {**selection, "from": "2000-01", "to": month, "month": month}
                began = time.perf_counter()
                response = client.get(f"/api/v1/aoi/{endpoint}", params=params)
                seconds = time.perf_counter() - began
                if response.status_code != 200:
                    raise RuntimeError(f"{endpoint} failed: {response.text}")
                schema = schemas[f"aoi-{endpoint}.schema.json"]
                Draft7Validator(schema, registry=registry).validate(response.json())
                if response.json()["meta"]["source"] != "parquet":
                    raise RuntimeError("An endpoint silently returned fixture data")
                measurements.append(
                    {"endpoint": endpoint, "selection": selection, "seconds": round(seconds, 4)}
                )
            for kind in ("monthly", "hotspots"):
                response = client.get(
                    "/api/v1/aoi/export.csv",
                    params={**selection, "kind": kind, "from": month, "to": month},
                )
                if response.status_code != 200:
                    raise RuntimeError(f"CSV failed: {response.text}")
                rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
                if len(rows) != int(response.headers["x-row-count"]):
                    raise RuntimeError("CSV row count header mismatch")
        response = client.get("/api/v1/aoi/calendar", params={"from": month, "to": month})
        if sum(value is not None for row in response.json()["values"] for value in row) != 1:
            raise RuntimeError("Single-month selection included unrelated observations")
    result = {
        "health": health,
        "manifest_outputs_verified": len(manifest["outputs"]),
        "validation_status": json.loads(
            (settings.data_dir / "harmonization_report.json").read_text()
        ).get("status"),
        "requests": measurements,
        "calendar_under_two_seconds": all(
            item["seconds"] < 2 for item in measurements if item["endpoint"] == "calendar"
        ),
    }
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2) + "\n")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Verify installed Parquet release contracts and CSV"
    )
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    print(json.dumps(verify(arguments.output), indent=2))
