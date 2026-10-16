#!/bin/bash
# journal_has_writer_start ignores systemd assert refusals and still detects writer starts. Runs only that function, with stubs.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LIB="$ROOT/lib/ops-lib.sh"
fn=$(awk '$0 == "journal_has_writer_start() {" {grab=1} grab {print} grab && /^}$/ {exit}' "$LIB")
[[ -n "$fn" ]] || { printf '%s\n' 'journal_has_writer_start is missing' >&2; exit 1; }
eval "$fn"
CURSOR=c1
JOURNAL=""
JOURNAL_RC=0
op_field() { printf '%s\n' "$CURSOR"; }
journalctl() { printf '%s' "$JOURNAL"; return "$JOURNAL_RC"; }
check() {
  local want="$1" name="$2" rc=0
  journal_has_writer_start || rc=$?
  if [[ "$rc" -ne "$want" ]]; then
    printf '%s: want %s got %s\n' "$name" "$want" "$rc" >&2
    exit 1
  fi
}
JOURNAL=$'aisandbox-frontend.service: Starting requested but asserts failed.\naisandbox-gateway.service: Starting requested but asserts failed.\n'
check 1 "assert refusals only"
JOURNAL=$'aisandbox-gateway.service: Starting requested but asserts failed.\nStarted aisandbox-gateway.service - aiSandbox gateway.\n'
check 0 "real start after a refusal"
JOURNAL=$'Starting aisandbox-ai.service - aiSandbox AI service...\n'
check 0 "starting line"
JOURNAL=$'Failed to start aisandbox-cm.service - aiSandbox container manager.\n'
check 0 "failed start"
JOURNAL=$'Stopping aisandbox-gateway.service...\nStopped aisandbox-gateway.service.\n'
check 1 "stops only"
JOURNAL=""
check 1 "empty journal"
CURSOR=""
check 2 "no cursor"
CURSOR=c1
JOURNAL_RC=1
check 2 "journalctl failure"
printf 'journal writer start PASS\n'
