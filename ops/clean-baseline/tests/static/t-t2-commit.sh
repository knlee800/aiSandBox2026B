#!/bin/bash
# Static checks for the t2-commit branch and its fixture. Reads source only. Executes nothing.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
T2="$ROOT/tests/operational/t2-lock-and-fault.sh"
FIX="$ROOT/tests/operational/t2-synthetic-migration.txt"
fail() { printf '%s\n' "$*" >&2; exit 1; }
branch() {
  awk -v c="  $1)" '
    $0 == c {grab=1; next}
    grab && $0 == "    ;;" {exit}
    grab {print}
  ' "$2"
}
line_of() { printf '%s\n' "$body" | grep -n -F -- "$1" | cut -d: -f1 | tr '\n' ' ' || true; }
[[ -f "$FIX" ]] || fail "t2 fixture is missing"
[[ "$(sha256sum "$FIX" | awk '{print $1}')" == "35204681f1744b9ae4fe195b471890ae0bb9b3785f78e252e1523b9b986df0cd" ]] || fail "t2 fixture SHA-256 is not the authorized one"
body=$(branch t2-commit "$T2")
[[ -n "$body" ]] || fail "t2-commit branch is missing"
[[ "$(grep -c -x -F '    fixture="$HERE/t2-synthetic-migration.txt"' <<< "$body" || true)" -eq 1 ]] || fail "t2-commit must read the fixture beside it"
ct=($(line_of ' commit-tree "$tree" -p "$parent" '))
ur=($(line_of 'git_as_owner update-ref "$ref" "$commit" ""'))
hd=($(line_of '[[ "$(git_as_owner rev-parse HEAD)" == "$parent" ]]'))
[[ "${#ct[@]}" -eq 1 && "${#ur[@]}" -eq 1 && "${#hd[@]}" -eq 1 ]] || fail "t2-commit must call commit-tree, update-ref and the HEAD check once each"
(( ct[0] < ur[0] && ur[0] < hd[0] )) || fail "t2-commit order must be: commit-tree, update-ref, HEAD check"
[[ "$(grep -c -E ' (read-tree|update-index|write-tree)([ )]|$)' <<< "$body" || true)" -eq 3 ]] || fail "t2-commit must build its tree with read-tree, update-index and write-tree once each"
! grep -E ' (read-tree|update-index|write-tree)([ )]|$)' <<< "$body" | grep -v -q -F 'GIT_INDEX_FILE="$work/index"' || fail "t2-commit must keep the real index untouched"
! grep -E -q '(git_as_owner|"\$AISB_ROOT") (commit|checkout|reset|merge|push)( |$)' <<< "$body" || fail "t2-commit must not run git commit, checkout, reset, merge or push"
printf 't2-commit PASS\n'
