from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .config import COUNTRIES, NASA_BASE, SENSOR_START, SENSORS, file_sha256, write_json

MAX_RESPONSE_BYTES = 200 * 1024 * 1024
RETRIES = 4


class IngestError(RuntimeError):
    pass


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


urlopen = build_opener(_NoRedirect()).open


def windows(start: date, end: date, days: int = 5):
    if start > end or not 1 <= days <= 5:
        raise ValueError("Date range must be ordered; FIRMS windows are 1-5 days")
    while start <= end:
        stop = min(end, start + timedelta(days=days - 1))
        yield start, stop
        start = stop + timedelta(days=1)


def _request_bytes(url: str, destination: Path | None = None) -> bytes | str:
    if not url.startswith(NASA_BASE + "/"):
        raise IngestError("Only official NASA FIRMS HTTPS downloads are allowed")
    for attempt in range(RETRIES):
        try:
            request = Request(  # noqa: S310
                url, headers={"User-Agent": "FireBros/1.0 (NASA FIRMS research client)"}
            )
            with urlopen(request, timeout=60) as response:
                if response.url.split("/", 3)[:3] != NASA_BASE.split("/")[:3]:
                    raise IngestError("FIRMS redirected outside its official host")
                digest = hashlib.sha256()
                size = 0
                chunks = []
                temporary = destination.with_suffix(".download") if destination else None
                if destination:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                stream = temporary.open("wb") if temporary else None
                try:
                    while chunk := response.read(1024 * 1024):
                        size += len(chunk)
                        if size > MAX_RESPONSE_BYTES:
                            raise IngestError("FIRMS response exceeds the download size limit")
                        digest.update(chunk)
                        if stream:
                            stream.write(chunk)
                        else:
                            chunks.append(chunk)
                finally:
                    if stream:
                        stream.close()
                if temporary:
                    with temporary.open("r", encoding="utf-8-sig") as check:
                        header = next(csv.reader(check), [])
                        if not {"latitude", "longitude", "acq_date"}.issubset(header):
                            temporary.unlink(missing_ok=True)
                            raise IngestError("FIRMS did not return a detection CSV")
                    os.replace(temporary, destination)
                    return digest.hexdigest()
                return b"".join(chunks)
        except HTTPError as exc:
            if exc.code not in (408, 429, 500, 502, 503, 504) or attempt == RETRIES - 1:
                raise IngestError(f"FIRMS request failed (HTTP {exc.code}); URL withheld") from None
            retry_after = exc.headers.get("Retry-After", "")
            delay = min(float(retry_after), 60) if retry_after.isdigit() else 2**attempt
        except (URLError, TimeoutError, OSError):
            if attempt == RETRIES - 1:
                raise IngestError("FIRMS request failed after retries; URL withheld") from None
            delay = 2**attempt
        time.sleep(delay)
    raise IngestError("FIRMS request failed")


def archive_catalog() -> list[dict[str, str]]:
    content = _request_bytes(f"{NASA_BASE}/data/country/yearly_summary_files.txt")
    return list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))


def download_archive(
    raw_dir: Path, start: date, end: date, workers: int = 4, include_noaa: bool = False
) -> list[Path]:
    if start > end:
        raise ValueError("Start must not follow end")
    catalog = archive_catalog()
    prefixes = tuple(SENSORS) if include_noaa else ("modis", "viirs-snpp")
    jobs = []
    for row in catalog:
        match = re.fullmatch(
            r"(modis|viirs-snpp|viirs-jpss1)_(\d{4})_([A-Za-z_]+)\.csv", row["filename"]
        )
        if not match:
            continue
        prefix, year_text, country = match.groups()
        year = int(year_text)
        if prefix not in prefixes or country not in COUNTRIES or not start.year <= year <= end.year:
            continue
        if year >= date.today().year:
            continue
        jobs.append((row, prefix, year))
    if not jobs:
        raise IngestError("No complete annual FIRMS archives cover the requested range")
    groups: dict[tuple[str, int], set[str]] = {}
    for row, prefix, year in jobs:
        country = row["filename"].removeprefix(f"{prefix}_{year}_").removesuffix(".csv")
        groups.setdefault((prefix, year), set()).add(country)
    if any(countries != set(COUNTRIES) for countries in groups.values()):
        raise IngestError(
            "Annual archive is missing countries; regional coverage cannot be claimed"
        )

    def download(job):
        row, prefix, year = job
        path = raw_dir / prefix / str(year) / row["filename"]
        sidecar = path.with_suffix(".json")
        if path.exists() and sidecar.exists():
            metadata = json.loads(sidecar.read_text())
            if metadata.get("upstream_updated") == row["updated"] and file_sha256(
                path
            ) == metadata.get("sha256"):
                return path
        digest = _request_bytes(f"{NASA_BASE}/data/country/{row['filename']}", path)
        sensor = SENSORS[prefix]
        first = max(date(year, 1, 1), SENSOR_START[sensor])
        metadata = {
            "source": "NASA FIRMS annual country archive",
            "sensor": sensor,
            "url": f"{NASA_BASE}/data/country/{row['filename']}",
            "sha256": digest,
            "upstream_updated": row["updated"],
            "coverage_start": first.isoformat(),
            "coverage_end": date(year, 12, 31).isoformat(),
            "coverage_basis": "published archive availability; not cloud-free overpass coverage",
            "country": row["filename"].removeprefix(f"{prefix}_{year}_").removesuffix(".csv"),
        }
        write_json(sidecar, metadata)
        print(f"Downloaded {row['filename']}", flush=True)
        return path

    with ThreadPoolExecutor(max_workers=max(1, min(workers, 8))) as pool:
        return sorted(pool.map(download, jobs))


def download_area(
    raw_dir: Path, start: date, end: date, map_key: str, include_noaa: bool = False
) -> list[Path]:
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", map_key):
        raise IngestError("Set a valid FIRMS_MAP_KEY in the environment")
    sources = ("MODIS_SP", "VIIRS_SNPP_SP")
    if include_noaa:
        sources += ("VIIRS_NOAA20_SP",)
    availability = _request_bytes(f"{NASA_BASE}/api/data_availability/csv/{map_key}/ALL")
    rows = list(csv.DictReader(io.StringIO(availability.decode("utf-8-sig"))))
    ranges = {
        r["data_id"]: (date.fromisoformat(r["min_date"]), date.fromisoformat(r["max_date"]))
        for r in rows
    }
    paths = []
    for source in sources:
        for product in (source, source.replace("_SP", "_NRT")):
            if product not in ranges:
                continue
            lo, hi = ranges[product]
            lo, hi = max(start, lo), min(end, hi)
            if lo > hi:
                continue
            for first, last in windows(lo, hi):
                path = raw_dir / product.lower() / str(first.year) / f"{first}_{last}.csv"
                sidecar = path.with_suffix(".json")
                if path.exists() and sidecar.exists() and not product.endswith("_NRT"):
                    metadata = json.loads(sidecar.read_text())
                    if file_sha256(path) == metadata.get("sha256"):
                        paths.append(path)
                        continue
                days = (last - first).days + 1
                url = f"{NASA_BASE}/api/area/csv/{map_key}/{product}/68.5,38.4,80.7,43.7/{days}/{first}"
                digest = _request_bytes(url, path)
                write_json(
                    sidecar,
                    {
                        "source": "NASA FIRMS area API",
                        "sensor": product.removesuffix("_SP").removesuffix("_NRT"),
                        "sha256": digest,
                        "coverage_start": first.isoformat(),
                        "coverage_end": last.isoformat(),
                        "product": product,
                        "coverage_basis": "published API availability; not cloud-free overpass coverage",
                    },
                )
                paths.append(path)
    if not paths:
        raise IngestError("FIRMS has no products in the requested period")
    return sorted(paths)


def download_missing_dates(raw_dir: Path) -> Path:
    from html.parser import HTMLParser

    class Rows(HTMLParser):
        def __init__(self):
            super().__init__()
            self.rows, self.current, self.text = [], [], None

        def handle_starttag(self, tag, attrs):
            if tag == "tr":
                self.current = []
            if tag == "td":
                self.text = ""

        def handle_data(self, data):
            if self.text is not None:
                self.text += data

        def handle_endtag(self, tag):
            if tag == "td":
                self.current.append(self.text.strip())
                self.text = None
            if tag == "tr" and self.current:
                self.rows.append(self.current)

    payload = _request_bytes(f"{NASA_BASE}/api/missing_data/?action=fetch_data")
    data = json.loads(payload)
    if not data.get("success") or not isinstance(data.get("html"), str):
        raise IngestError("FIRMS missing-data catalog is unavailable")
    parser = Rows()
    parser.feed(data["html"])
    missing = []
    for row in parser.rows:
        for index in (0, 2):
            if len(row) <= index + 1 or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", row[index]):
                continue
            satellite = row[index + 1]
            sensor = (
                "VIIRS_SNPP"
                if "Suomi" in satellite
                else "MODIS"
                if "MODIS" in satellite
                else "VIIRS_NOAA20"
                if "NOAA-20" in satellite
                else "VIIRS_NOAA21"
                if "NOAA-21" in satellite
                else None
            )
            if sensor:
                missing.append(
                    {"sensor_family": sensor, "acq_date": row[index], "satellite": satellite}
                )
    path = raw_dir / "missing_data.json"
    write_json(
        path,
        {
            "source": f"{NASA_BASE}/api/missing_data/",
            "sha256": hashlib.sha256(payload).hexdigest(),
            "missing": missing,
        },
    )
    return path
