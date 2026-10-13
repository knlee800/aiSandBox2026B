#!/bin/bash
# Static form of psql standard input. Reads source only. Executes nothing.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LIB="$ROOT/lib/ops-lib.sh"
BIN="$ROOT/bin"

if grep -F -q -- '/dev/stdin' "$LIB"; then
  printf '/dev/stdin appears in lib/ops-lib.sh\n' >&2
  exit 1
fi

while IFS= read -r -d '' path; do
  if grep -F -q -- '/dev/stdin' "$path"; then
    printf '/dev/stdin appears in %s\n' "${path#"$ROOT"/}" >&2
    exit 1
  fi
done < <(find "$BIN" -type f -print0)

for fn in apply_roles_sql apply_q3_inject; do
  body=$(awk -v fn="$fn" '
    $0 == fn "() {" {grab=1; next}
    grab && /^}$/ {exit}
    grab {print}
  ' "$LIB")
  if [[ -z "$body" ]]; then
    printf '%s is missing\n' "$fn" >&2
    exit 1
  fi
  if ! printf '%s\n' "$body" | grep -F 'psql' | grep -F -q -- ' -f - < '; then
    printf '%s has no psql call with -f - <\n' "$fn" >&2
    exit 1
  fi
done

printf 'psql stdin PASS\n'
