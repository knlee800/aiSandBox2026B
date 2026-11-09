#!/bin/bash
# connectors-mcp is on the checkout build list and the prepare artifact list.
# File checks only. Does not build or contact a host.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LIB="$ROOT/lib/ops-lib.sh"
PREPARE="$ROOT/bin/aisandbox-prepare"
pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }

exact() {
  local name="$1" file="$2" line="$3"
  if grep -F -x -q -- "$line" "$file"; then
    ok "$name"
  else
    bad "$name"
  fi
}

contains() {
  local name="$1" file="$2" text="$3"
  if grep -F -q -- "$text" "$file"; then
    ok "$name"
  else
    bad "$name"
  fi
}

exact checkout-builds-connectors-mcp "$LIB" '  runuser -u aisandbox -- npm --prefix "$AISB_ROOT/services/connectors-mcp" run build'
contains checkout-artifact-connectors-mcp "$LIB" 'services/connectors-mcp/dist/main.js'
contains prepare-artifact-connectors-mcp "$PREPARE" 'services/connectors-mcp/dist/main.js'

printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
