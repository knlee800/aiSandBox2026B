#!/bin/bash
# append_ids_only lists open-work keys. Mocked commands only. Does not touch a database.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/../.." && pwd)
# shellcheck source=/dev/null
source "$ROOT/lib/ops-lib.sh"
pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }

tmp="$(mktemp -d)"
cleanup() { rm -rf -- "$tmp"; }
trap cleanup EXIT

usage="SELECT execution_id::text FROM usage_records WHERE execution_status IN ('pending','running','cancel_requested')"
runs="SELECT collaboration_run_id FROM collaboration_runs WHERE status='active'"
refs="SELECT referral_id FROM collaboration_referrals WHERE status IN ('pending_approval','approved','in_progress')"
expect="runuser -u postgres -- psql -d aisandbox -Atc ${usage} UNION ALL ${runs} UNION ALL ${refs}"

runuser() { printf 'runuser\n' >> "$tmp/unexpected"; return 99; }
psql() { printf 'psql\n' >> "$tmp/unexpected"; return 99; }
timeout() { printf 'timeout\n' >> "$tmp/unexpected"; return 99; }
run_bounded() {
  printf '%s\n' "$*" > "$tmp/args"
  printf '%s\n' 'exec-111' 'run-222' 'ref-333'
  return "${MOCK_RC:-0}"
}

check_query() {
  local q=""
  if [[ -f "$tmp/args" ]]; then
    q=$(cat "$tmp/args")
  fi
  if [[ "$q" == *execution_id* ]]; then
    ok names-execution-id
  else
    bad names-execution-id
  fi
  if [[ "$q" == *collaboration_run_id* ]]; then
    ok names-collaboration-run-id
  else
    bad names-collaboration-run-id
  fi
  if [[ "$q" == *referral_id* ]]; then
    ok names-referral-id
  else
    bad names-referral-id
  fi
  if printf '%s\n' "$q" | grep -E -q 'SELECT[[:space:]]+id([^[:alnum:]_]|$)'; then
    bad no-bare-id-column
  else
    ok no-bare-id-column
  fi
  if [[ "$q" == *"WHERE execution_status IN ('pending','running','cancel_requested')"* ]]; then
    ok where-usage-records
  else
    bad where-usage-records
  fi
  if [[ "$q" == *"WHERE status='active'"* ]]; then
    ok where-collaboration-runs
  else
    bad where-collaboration-runs
  fi
  if [[ "$q" == *"WHERE status IN ('pending_approval','approved','in_progress')"* ]]; then
    ok where-collaboration-referrals
  else
    bad where-collaboration-referrals
  fi
  if [[ "$q" == "$expect" ]]; then
    ok query-keeps-invocation
  else
    bad query-keeps-invocation
    printf 'query:\n%s\n' "$q" >&2
  fi
}

check_ids() {
  local name="$1"
  printf '%s\n' 'exec-111' 'run-222' 'ref-333' > "$tmp/want"
  if cmp -s "$tmp/out" "$tmp/want"; then
    ok "$name"
  else
    bad "$name"
    printf 'out:\n' >&2
    cat "$tmp/out" >&2 || true
  fi
}

MOCK_RC=0
set +e
append_ids_only >"$tmp/out" 2>"$tmp/err"
rc=$?
set -e
if [[ "$rc" -eq 0 ]]; then
  ok returns-zero
else
  bad returns-zero
fi
if [[ ! -s "$tmp/err" && ! -e "$tmp/unexpected" ]]; then
  ok no-database-command
else
  bad no-database-command
fi
check_ids prints-mock-ids
check_query

MOCK_RC=1
set +e
append_ids_only >"$tmp/out" 2>"$tmp/err"
rc=$?
set -e
if [[ "$rc" -eq 0 ]]; then
  ok failure-still-returns-zero
else
  bad failure-still-returns-zero
fi
check_ids prints-mock-ids-when-command-fails

printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
