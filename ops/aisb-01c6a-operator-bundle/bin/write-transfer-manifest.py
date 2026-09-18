#!/usr/bin/env python3
"""Generate TRANSFER.manifest for the operator review bundle."""

from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    lines = ["# AISB-01C6A operator helper transfer manifest", "# sha256  relative-path"]
    files = []
    for prefix in ("bin", "lib", "config"):
        for path in sorted((ROOT / prefix).rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
                files.append(path)
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        lines.append(f"{sha256_file(path)}  {rel}")
    (ROOT / "TRANSFER.manifest").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {len(files)} helper entries")


if __name__ == "__main__":
    main()
