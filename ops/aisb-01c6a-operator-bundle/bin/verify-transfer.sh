#!/usr/bin/env bash
# Fail-closed transfer verification. No helper may be assumed present on staging.
set -eu
PREP=${PREP:-$1}
PYTHON=${PYTHON3:-python3}
"$PYTHON" "$PREP/bin/verify-transfer.py" "$PREP"
