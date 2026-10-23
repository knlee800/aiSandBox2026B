#!/bin/bash
# Static checks for the snapshot-store listing in prepare_snapshot. Reads source only. Executes nothing.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
H="$ROOT/tests/lib/case-helpers.sh"
fail() { printf '%s\n' "$*" >&2; exit 1; }
body=$(awk '$0 == "prepare_snapshot() {" {grab=1; next} grab && $0 == "}" {exit} grab {print}' "$H")
[[ -n "$body" ]] || fail "prepare_snapshot is missing"
line_of() { printf '%s\n' "$body" | grep -n -F -- "$1" | cut -d: -f1 | tr '\n' ' ' || true; }
for gone in 'find /opt/aisandbox/services/snapshot-store /opt/aisandbox/snapshot-store' '2>/dev/null | sort'; do
  [[ -z "$(line_of "$gone")" ]] || fail "prepare_snapshot must not contain: $gone"
done
want=(
  '    stores="${AISB_SNAPSHOT_STORES:-$(printf '"'"'%s\n'"'"' /opt/aisandbox/services/snapshot-store /opt/aisandbox/snapshot-store)}"'
  '    while IFS= read -r store; do'
  '      if [[ -e "$store" || -L "$store" ]]; then'
  '        find "$store" -mindepth 1 -print | sort || return 1'
  '        printf '"'"'absent=%s\n'"'"' "$store"'
  '    done <<< "$stores"'
)
prev=0
for w in "${want[@]}"; do
  hits=($(line_of "$w"))
  [[ "${#hits[@]}" -eq 1 ]] || fail "prepare_snapshot must contain exactly once: $w"
  (( prev < hits[0] )) || fail "prepare_snapshot order: $w"
  prev=${hits[0]}
done
printf 'snapshot stores PASS\n'
