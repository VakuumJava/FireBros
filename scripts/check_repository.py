from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRET_PATTERNS = (
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(rb"gh[pousr]_[A-Za-z0-9]{36,}"),
    re.compile(rb"github_pat_[A-Za-z0-9_]{70,}"),
    re.compile(rb"AKIA[0-9A-Z]{16}"),
)


def inspect_repository() -> list[str]:
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).split(b"\0")  # noqa: S607
    errors = []
    for raw in filter(None, tracked):
        relative = Path(raw.decode())
        path = ROOT / relative
        if not path.is_file():
            continue
        if relative.name.startswith(".env") and relative.name != ".env.example":
            errors.append(f"{relative}: environment file must not be tracked")
        if relative.suffix in {".pem", ".key", ".p12"}:
            errors.append(f"{relative}: private key container must not be tracked")
        if relative.parts[0] == "data" and relative.name not in {"README.md", ".gitkeep"}:
            errors.append(f"{relative}: generated data must not be tracked")
        content = path.read_bytes()
        if any(pattern.search(content) for pattern in SECRET_PATTERNS):
            errors.append(f"{relative}: possible credential detected; value withheld")
    return errors


if __name__ == "__main__":
    failures = inspect_repository()
    for failure in failures:
        print(failure)
    if failures:
        raise SystemExit(1)
    print("Tracked files: no forbidden data, environment files or recognized credentials.")
