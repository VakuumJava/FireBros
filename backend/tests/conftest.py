from __future__ import annotations

import json
from pathlib import Path

import pytest
from app.config import Settings
from app.main import create_app
from app.store import clear_store_cache
from fastapi.testclient import TestClient
from jsonschema import Draft7Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT7

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    clear_store_cache()
    return Settings(
        data_dir=tmp_path,
        contracts_dir=CONTRACTS,
        cors_origins=(),
        csv_max_rows=5_000,
        polygon_scan_rows=20_000,
        max_span_months=400,
        holdout_years=(2024, 2025),
    )


@pytest.fixture()
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings))


@pytest.fixture()
def validate():
    return _assert_matches_contract


def _contracts() -> tuple[dict[str, dict], Registry]:
    schemas = {
        path.name: json.loads(path.read_text(encoding="utf-8"))
        for path in CONTRACTS.glob("*.schema.json")
    }
    resources = []
    for name, schema in schemas.items():
        resource = Resource.from_contents(schema, default_specification=DRAFT7)
        resources.extend([(name, resource), (schema["$id"], resource)])
    return schemas, Registry().with_resources(resources)


def _assert_matches_contract(payload: dict, schema_name: str) -> None:
    schemas, registry = _contracts()
    schema = schemas[schema_name]
    validator = Draft7Validator(schema, registry=registry)
    errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.path))
    assert not errors, [f"/{'/'.join(map(str, error.path))}: {error.message}" for error in errors]
