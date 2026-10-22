#!/bin/bash
# Static checks for the parent folders of the t4.2-snapshot and t4.2-snapshot-root planted files. Reads source only. Executes nothing.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
T4="$ROOT/tests/operational/t4-metadata.sh"
fail() { printf '%s\n' "$*" >&2; exit 1; }
branch() {
  awk -v c="  $1)" '
    $0 == c {grab=1; next}
    grab && $0 == "    ;;" {exit}
    grab {print}
  ' "$2"
}
line_of() { printf '%s\n' "$body" | grep -n -F -- "$1" | cut -d: -f1 | tr '\n' ' ' || true; }
check() {
  local name="$1" dir="$2" i
  body=$(branch "$name" "$T4")
  [[ -n "$body" ]] || fail "$name branch is missing"
  local -a want=(
    "    require_prepared_idle"
    "    made=0"
    "    if [[ ! -d $dir ]]; then"
    "      mkdir $dir"
    "      made=1"
    " > $dir/extra"
    "    rm -f -- $dir/extra"
    '    if [[ "$made" -eq 1 ]]; then'
    "      rmdir $dir"
  )
  local -a at=()
  for i in "${!want[@]}"; do
    local hits
    hits=($(line_of "${want[$i]}"))
    [[ "${#hits[@]}" -eq 1 ]] || fail "$name must contain exactly once: ${want[$i]}"
    at+=("${hits[0]}")
  done
  for i in $(seq 1 $((${#at[@]} - 1))); do
    (( at[i - 1] < at[i] )) || fail "$name order: ${want[$((i - 1))]} must come before ${want[$i]}"
  done
}
check t4.2-snapshot /opt/aisandbox/services/snapshot-store
check t4.2-snapshot-root /opt/aisandbox/snapshot-store
printf 'snapshot parent PASS\n'
