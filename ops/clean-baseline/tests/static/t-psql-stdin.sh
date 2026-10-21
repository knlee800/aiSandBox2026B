#!/bin/bash
# Static form of psql and pg_restore standard input. Reads source only. Executes nothing.
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

restore_lines=$(grep -c -F 'pg_restore' "$BIN/aisandbox-restore" || true)
if [[ "$restore_lines" -ne 1 ]]; then
  printf 'aisandbox-restore must call pg_restore exactly once\n' >&2
  exit 1
fi
if ! grep -q -x -F 'runuser -u postgres -- pg_restore --create --exit-on-error -d postgres < "$work/db.dump"' "$BIN/aisandbox-restore"; then
  printf 'pg_restore must read the dump from standard input with no file argument\n' >&2
  exit 1
fi

printf 'psql stdin PASS\n'
