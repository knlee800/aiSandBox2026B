#!/usr/bin/env python3
"""Local mock Node. Prints operator-supplied JSON and exits. Not used on staging."""

from __future__ import annotations

import os
import sys


def main() -> int:
    payload = os.environ.get("AISB_01C6A_MOCK_NODE_JSON", "")
    if payload:
        sys.stdout.write(payload if payload.endswith("\n") else payload + "\n")
    err = os.environ.get("AISB_01C6A_MOCK_NODE_STDERR", "")
    if err:
        sys.stderr.write(err if err.endswith("\n") else err + "\n")
    try:
        return int(os.environ.get("AISB_01C6A_MOCK_NODE_EXIT", "0"))
    except ValueError:
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
