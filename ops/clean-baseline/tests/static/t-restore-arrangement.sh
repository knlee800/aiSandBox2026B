#!/bin/bash
# Static checks for the t4c deleted path and the t1.5-sha PREPARED restore. Reads source only. Executes nothing.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
T1="$ROOT/tests/operational/t1-prepare.sh"
T4C="$ROOT/tests/operational/t4c-deleted-tracked.sh"
fail() { printf '%s\n' "$*" >&2; exit 1; }
branch() {
  awk -v c="  $1)" '
    $0 == c {grab=1; next}
    grab && $0 == "    ;;" {exit}
    grab {print}
  ' "$2"
}
line_of() { printf '%s\n' "$body" | grep -n -F -- "$1" | cut -d: -f1 | tr '\n' ' ' || true; }
[[ "$(grep -c -x 'rel=database/README.md' "$T4C" || true)" -eq 1 ]] || fail "t4c must delete database/README.md"
! grep -q 'tracked-delete-me' "$T4C" || fail "t4c still names the fixture-only path"
body=$(branch t1.5-sha "$T1")
[[ -n "$body" ]] || fail "t1.5-sha branch is missing"
save=($(line_of 'cp -p -- /etc/aisandbox/PREPARED "$prepared_saved"'))
plant=($(line_of "printf 'sha=0000000000000000000000000000000000000000\n' > /etc/aisandbox/PREPARED"))
restore=($(line_of '"$sbin/aisandbox-restore" "$3" "$4"'))
back=($(line_of 'cp -p -- "$prepared_saved" /etc/aisandbox/PREPARED'))
rcchk=($(line_of '[[ "$rc" -eq 10 ]]'))
[[ "${#save[@]}" -eq 1 && "${#plant[@]}" -eq 1 && "${#restore[@]}" -eq 1 && "${#back[@]}" -eq 1 && "${#rcchk[@]}" -eq 1 ]] || fail "t1.5-sha save, plant, restore, put-back or rc check is missing"
(( save[0] < plant[0] && plant[0] < restore[0] && restore[0] < back[0] && back[0] < rcchk[0] )) || fail "t1.5-sha order must be: save PREPARED, plant, restore, put PREPARED back, assert"
last=$(printf '%s\n' "$body" | grep -v '^[[:space:]]*$' | tail -n 1)
[[ "$last" == "    require_prepared_idle" ]] || fail "t1.5-sha must end with require_prepared_idle"
printf 'restore arrangement PASS\n'
