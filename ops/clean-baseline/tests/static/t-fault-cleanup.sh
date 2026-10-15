#!/bin/bash
# Static order of the t3.5 maintenance exit and fault cleanup in t3.5 and t2.4. Reads source only. Executes nothing.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
T3="$ROOT/tests/operational/t3-quiesce.sh"
T2="$ROOT/tests/operational/t2-lock-and-fault.sh"
fail() { printf '%s\n' "$*" >&2; exit 1; }
branch() {
  awk -v c="  $1)" '
    $0 == c {grab=1; next}
    grab && $0 == "    ;;" {exit}
    grab {print}
  ' "$2"
}
line_of() { printf '%s\n' "$body" | grep -n -F -- "$1" | cut -d: -f1 | tr '\n' ' ' || true; }
body=$(branch t3.5 "$T3")
[[ -n "$body" ]] || fail "t3.5 branch is missing"
exits=($(line_of '/usr/local/sbin/aisandbox-maint exit'))
refused=($(line_of '[[ "$exit_rc" -eq 11 ]]'))
del=($(line_of 'DEL bull:ai-execution:wait'))
clear=($(line_of 'clear_injected_fault'))
[[ "${#exits[@]}" -eq 2 ]] || fail "t3.5 must call aisandbox-maint exit twice"
[[ "${#refused[@]}" -eq 1 && "${#del[@]}" -eq 1 && "${#clear[@]}" -eq 1 ]] || fail "t3.5 refusal, DEL or fault cleanup is missing"
(( exits[0] < refused[0] && refused[0] < del[0] && del[0] < clear[0] && clear[0] < exits[1] )) || fail "t3.5 order must be: refused exit, DEL, fault cleanup, exit"
body=$(branch t2.4 "$T2")
[[ -n "$body" ]] || fail "t2.4 branch is missing"
last=$(printf '%s\n' "$body" | grep -v '^[[:space:]]*$' | tail -n 1)
[[ "$last" == "    clear_injected_fault" ]] || fail "t2.4 must end with clear_injected_fault"
printf 'fault cleanup PASS\n'
