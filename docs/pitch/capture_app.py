"""Freeze actual API responses into a local copy of the compiled application."""

from __future__ import annotations

import argparse
import json
import shutil
import urllib.parse
import urllib.request
from pathlib import Path

ENDPOINTS = ("summary", "calendar", "anomaly", "top", "harmonization")


def fetch(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://127.0.0.1:8000/api/v1")
    parser.add_argument("--dist", type=Path, default=Path("frontend/dist"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--bbox", default="68.5,38.4,80.7,43.7")
    parser.add_argument("--from-month", default="2000-01")
    parser.add_argument("--to-month", default="2026-11")
    parser.add_argument("--anomaly-month", default="2025-10")
    args = parser.parse_args()
    if not args.api.startswith(("http://127.0.0.1:", "http://localhost:")):
        parser.error("Capture only connects to an explicitly local development API")
    health = fetch(f"{args.api}/meta/health")
    if health.get("source") != "parquet":
        parser.error("Real parquet data must be loaded before freezing a demonstration")
    responses = {"health": health}
    for endpoint in ENDPOINTS:
        parameters = {"bbox": args.bbox}
        if endpoint == "anomaly":
            parameters["month"] = args.anomaly_month
        else:
            parameters.update({"from": args.from_month, "to": args.to_month})
        responses[endpoint] = fetch(
            f"{args.api}/aoi/{endpoint}?{urllib.parse.urlencode(parameters)}"
        )
    if args.output.exists():
        parser.error("Output directory already exists; choose a fresh capture directory")
    shutil.copytree(args.dist, args.output)
    (args.output / "responses.json").write_text(json.dumps(responses), encoding="utf-8")
    payload = json.dumps(responses).replace("<", "\\u003c")
    query = urllib.parse.urlencode(
        {"from": args.from_month, "to": args.to_month, "month": args.anomaly_month}
    )
    script = """<script>
history.replaceState(null, "", "?QUERY");
const archiveResponses = PAYLOAD;
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  const name = url.pathname.split('/').pop();
  if (url.pathname.includes('/api/v1/') && archiveResponses[name]) {
    return Promise.resolve(new Response(JSON.stringify(archiveResponses[name]), {headers: {'Content-Type': 'application/json'}}));
  }
  return nativeFetch(input, options);
};
</script>""".replace("PAYLOAD", payload).replace("QUERY", query)
    index = args.output / "index.html"
    index.write_text(index.read_text().replace("<head>", f"<head>\n{script}"), encoding="utf-8")
    print(args.output)
    (args.output / "CAPTURE.md").write_text(
        f"Frozen application capture for bbox {args.bbox}, "
        f"period {args.from_month} through {args.to_month}, "
        f"anomaly month {args.anomaly_month}. Source: parquet. "
        "The fetch shim freezes real API responses only for reproducible video capture; "
        "do not deploy this capture copy as the interactive application.\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
