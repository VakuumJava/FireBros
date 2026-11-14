from datetime import date
from urllib.error import HTTPError

import pytest
from firebros import ingest


def test_five_day_windows_preserve_every_date():
    periods = list(ingest.windows(date(2024, 12, 29), date(2025, 1, 7)))
    assert periods == [(date(2024, 12, 29), date(2025, 1, 2)), (date(2025, 1, 3), date(2025, 1, 7))]
    with pytest.raises(ValueError):
        list(ingest.windows(date(2025, 1, 1), date(2025, 1, 2), days=6))


def test_transport_error_does_not_expose_key(monkeypatch):
    secret = "secret_MAP_KEY_123456"  # noqa: S105
    url = f"{ingest.NASA_BASE}/api/area/csv/{secret}/MODIS_SP/68,38,80,44/5"

    def reject(*args, **kwargs):
        raise HTTPError(url, 403, "Forbidden", {}, None)

    monkeypatch.setattr(ingest, "urlopen", reject)
    with pytest.raises(ingest.IngestError) as error:
        ingest._request_bytes(url)
    assert secret not in str(error.value)
    assert "403" in str(error.value)


def test_transport_retries_are_bounded(monkeypatch):
    calls = []

    def reject(*args, **kwargs):
        calls.append(1)
        raise HTTPError("hidden", 429, "Too many requests", {}, None)

    monkeypatch.setattr(ingest, "urlopen", reject)
    monkeypatch.setattr(ingest.time, "sleep", lambda _: None)
    with pytest.raises(ingest.IngestError):
        ingest._request_bytes(f"{ingest.NASA_BASE}/some-file.csv")
    assert len(calls) == ingest.RETRIES


def test_untrusted_download_host_rejected():
    with pytest.raises(ingest.IngestError, match="official NASA"):
        ingest._request_bytes("http://127.0.0.1/private")
    with pytest.raises(ingest.IngestError, match="official NASA"):
        ingest._request_bytes("https://firms.modaps.eosdis.nasa.gov.attacker.invalid/fires.csv")


def test_archive_refuses_partial_country_group(monkeypatch, tmp_path):
    monkeypatch.setattr(
        ingest,
        "archive_catalog",
        lambda: [{"filename": "modis_2024_Kyrgyzstan.csv", "size": "10", "updated": "2025-01-01"}],
    )
    with pytest.raises(ingest.IngestError, match="missing countries"):
        ingest.download_archive(tmp_path, date(2024, 1, 1), date(2024, 12, 31))
