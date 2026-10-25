#!/bin/bash
# Static checks for the t4.2-redis cleanup and the t4.2-noacl kernel probe. Reads source only. Executes nothing.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
T4="$ROOT/tests/operational/t4-metadata.sh"
fail() { printf '%s\n' "$*" >&2; exit 1; }
branch() {
  awk -v c="  $1)" '$0 == c {grab=1; next} grab && $0 == "    ;;" {exit} grab {print}' "$T4"
}
lines_of() { printf '%s\n' "$body" | grep -n -x -F -- "$1" | cut -d: -f1 | tr '\n' ' ' || true; }
in_order() {
  local name="$1" prev=0 w hits
  shift
  for w in "$@"; do
    hits=($(lines_of "$w"))
    [[ "${#hits[@]}" -eq 1 ]] || fail "$name must contain exactly once: $w"
    (( prev < hits[0] )) || fail "$name order: $w"
    prev=${hits[0]}
  done
}
body=$(branch t4.2-redis)
[[ -n "$body" ]] || fail "t4.2-redis branch is missing"
in_order t4.2-redis '    refuse_with_snapshot "$2" "$3"' '    unset AISB_SNAPSHOT_REDIS_KEYS' '    [[ "$(redis-cli -h 127.0.0.1 --no-auth-warning DEL ops-test)" == "1" ]]' '    [[ "$(redis-cli -h 127.0.0.1 --no-auth-warning EXISTS ops-test)" == "0" ]]' '    unset REDISCLI_AUTH'
auth=($(lines_of '    redis_auth_env'))
unset_keys=($(lines_of '    unset AISB_SNAPSHOT_REDIS_KEYS'))
del=($(lines_of '    [[ "$(redis-cli -h 127.0.0.1 --no-auth-warning DEL ops-test)" == "1" ]]'))
[[ "${#auth[@]}" -eq 2 ]] || fail "t4.2-redis must call redis_auth_env twice"
(( unset_keys[0] < auth[1] && auth[1] < del[0] )) || fail "t4.2-redis must call redis_auth_env again before the DEL"
[[ -z "$(lines_of '    redis-cli -h 127.0.0.1 --no-auth-warning DEL ops-test')" ]] || fail "t4.2-redis has an unchecked DEL"
body=$(branch t4.2-noacl)
[[ -n "$body" ]] || fail "t4.2-noacl branch is missing"
in_order t4.2-noacl '    mount -o loop,noacl "$probe" "$probe_dir" 2>"$evidence.probe"' '      if dmesg | tail -n 50 | grep -qF "Unknown parameter '"'"'noacl'"'"'"; then' '        exit 77' '    bytes="$(du -sb /opt/aisandbox | awk '"'"'{print $1}'"'"')"' '    mount -o loop "$img" "$stage"' '    mount -o loop,noacl "$img" /opt/aisandbox'
[[ "$(printf '%s\n' "$body" | grep -c -F FIXTURE_UNSUPPORTED)" -eq 1 ]] || fail "t4.2-noacl must print FIXTURE_UNSUPPORTED once"
printf 'redis cleanup and noacl probe PASS\n'
