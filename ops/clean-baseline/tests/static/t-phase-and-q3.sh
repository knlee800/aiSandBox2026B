#!/bin/bash
# Governing correction a. Static order and closed phase vocabulary.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LIB="$ROOT/lib/ops-lib.sh"

known=$(awk '
  /^phase_is_known\(\) \{$/ {grab=1; next}
  grab && /^}$/ {exit}
  grab {print}
' "$LIB")
for fn in phase_allows_maint_exit phase_allows_from_maintenance; do
  arms=$(awk -v fn="$fn" '
    $0 == fn "() {" {grab=1; next}
    grab && /^}$/ {exit}
    grab {print}
  ' "$LIB")
  while read -r line; do
    case "$line" in
      *\|*)
        names=${line%%)}
        names=${names//|/ }
        for name in $names; do
          [[ "$name" == "*" ]] && continue
          if ! printf '%s\n' "$known" | grep -q -w "$name"; then
            printf 'recovery phase %s is not in the vocabulary\n' "$name" >&2
            exit 1
          fi
        done
        ;;
    esac
  done <<< "$arms"
done

body=$(awk '
  /^q3_recover\(\) \{$/ {grab=1; next}
  grab && /^}$/ {exit}
  grab {print}
' "$LIB")
pos_assert=$(printf '%s\n' "$body" | grep -n 'assert_tree_and_schema_unchanged' | head -n 1 | cut -d: -f1)
pos_remove=$(printf '%s\n' "$body" | grep -n 'marker_remove' | head -n 1 | cut -d: -f1)
pos_start=$(printf '%s\n' "$body" | grep -n 'systemctl start aisandbox-gateway' | head -n 1 | cut -d: -f1)
pos_front=$(printf '%s\n' "$body" | grep -n 'systemctl start aisandbox-frontend' | head -n 1 | cut -d: -f1)
if [[ -z "$pos_assert" || -z "$pos_remove" || -z "$pos_start" || -z "$pos_front" ]]; then
  printf 'q3_recover is missing a required step\n' >&2
  exit 1
fi
if ! (( pos_assert < pos_remove && pos_remove < pos_start && pos_start < pos_front )); then
  printf 'q3 order is not unchanged, then marker removal, then writer start\n' >&2
  exit 1
fi
printf 'phase and Q3 order PASS\n'
