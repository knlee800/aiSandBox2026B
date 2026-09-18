#!/usr/bin/env python3
"""Fail-closed transfer verification. Every helper must be in the manifest."""

from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

REQUIRED_PREFIXES = ("bin/", "lib/", "config/")
OPTIONAL_NAMES = {"MANIFEST.sha256", "TRANSFER.manifest", "OPERATOR-BUNDLE.md", "tests/"}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest(path: Path) -> dict[str, str]:
    mapping = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 2:
            raise SystemExit(f"MANIFEST_MALFORMED: {line}")
        digest, rel = parts[0], parts[-1]
        mapping[rel.replace("\\", "/").lstrip("./")] = digest
    return mapping


def iter_helpers(root: Path) -> list[Path]:
    files = []
    for prefix in ("bin", "lib", "config"):
        base = root / prefix
        if not base.is_dir():
            raise SystemExit(f"MISSING_DIR:{prefix}")
        for p in base.rglob("*"):
            if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc":
                files.append(p)
    return files


def verify(root: Path, manifest_path: Path) -> int:
    mapping = load_manifest(manifest_path)
    helpers = iter_helpers(root)
    missing = []
    mismatch = []
    extra_ok = True
    for path in helpers:
        rel = path.relative_to(root).as_posix()
        if rel not in mapping:
            missing.append(rel)
            continue
        digest = sha256_file(path)
        if digest != mapping[rel].lower():
            mismatch.append(f"{rel} expected={mapping[rel]} got={digest}")
    if missing or mismatch:
        for item in missing:
            print(f"MISSING_FROM_MANIFEST {item}", file=sys.stderr)
        for item in mismatch:
            print(f"HASH_MISMATCH {item}", file=sys.stderr)
        return 1
    print(f"TRANSFER_VERIFY_OK helpers={len(helpers)}")
    return 0


def main(argv: list[str]) -> int:
    root = Path(argv[0] if argv else os.environ.get("PREP", ".")).resolve()
    manifest = root / "TRANSFER.manifest"
    if not manifest.is_file():
        print("TRANSFER.manifest missing", file=sys.stderr)
        return 1
    return verify(root, manifest)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
