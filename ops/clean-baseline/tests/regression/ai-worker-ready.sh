#!/bin/bash
# Worker readiness. Mocked commands only. Does not start Redis, a worker, or a service.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/../.." && pwd)
# shellcheck source=/dev/null
source "$ROOT/lib/ops-lib.sh"
pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }
secret='super-secret-redis'
good_clients=$'id=1 addr=127.0.0.1:40001 fd=8 name=bull:YWktZXhlY3V0aW9u:qe idle=0\nid=2 addr=127.0.0.1:40002 fd=9 name= idle=0\nid=3 addr=127.0.0.1:40003 fd=10 name=bull:YWktZXhlY3V0aW9u idle=0'
good_ss='0 0 127.0.0.1:40003 127.0.0.1:6379 users:(("node",pid=4242,fd=11))'

run_ready() {
  local name="$1" want="$2"
  local tmp rc
  tmp="$(mktemp -d)"
  mkdir -p "$tmp/etc"
  printf 'REDIS_URL=redis://:%s@127.0.0.1:6379\n' "$secret" > "$tmp/etc/gateway.env"
  set +e
  (
    set -euo pipefail
    export AISB_ETC="$tmp/etc"
    export MOCK_ACTIVE MOCK_PID MOCK_PID2 MOCK_PID_FLIP MOCK_CLIENTS MOCK_TTL MOCK_SS MOCK_REDIS_RC MOCK_SS_RC
    timeout() { shift; "$@"; }
    systemctl() {
      if [[ "$1" == "is-active" ]]; then
        [[ "${MOCK_ACTIVE:-1}" == "1" ]]
        return
      fi
      if [[ "$1" == "show" ]]; then
        local n=0
        if [[ -f "$AISB_ETC/pidcalls" ]]; then
          n="$(cat "$AISB_ETC/pidcalls")"
        fi
        n=$((n + 1))
        printf '%s\n' "$n" > "$AISB_ETC/pidcalls"
        if [[ "${MOCK_PID_FLIP:-}" == "1" && "$n" -ge 2 ]]; then
          printf '%s\n' "${MOCK_PID2:-0}"
        else
          printf '%s\n' "${MOCK_PID:-0}"
        fi
        return 0
      fi
      return 99
    }
    redis-cli() {
      [[ "$*" != *"$secret"* ]] || return 97
      if [[ "${MOCK_REDIS_RC:-0}" -ne 0 ]]; then
        return "$MOCK_REDIS_RC"
      fi
      if [[ "$*" == *"CLIENT LIST"* ]]; then
        printf '%s\n' "$MOCK_CLIENTS"
        return 0
      fi
      if [[ "$*" == *"TTL bull:ai-execution:stalled-check"* ]]; then
        printf '%s\n' "$MOCK_TTL"
        return 0
      fi
      return 98
    }
    ss() {
      if [[ "${MOCK_SS_RC:-0}" -ne 0 ]]; then
        return "$MOCK_SS_RC"
      fi
      printf '%s\n' "$MOCK_SS"
    }
    journalctl() { printf 'CALLED\n'; return 99; }
    ai_worker_ready "$((SECONDS + 120))"
  ) >"$tmp/out" 2>"$tmp/err"
  rc=$?
  set -e
  if [[ "$rc" -eq "$want" ]] && ! grep -F -q -- "$secret" "$tmp/out" "$tmp/err" && ! grep -F -q 'name=' "$tmp/out" "$tmp/err" && ! grep -F -q 'CALLED' "$tmp/out" "$tmp/err"; then
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s want=%s\n' "$rc" "$want" >&2
    printf 'out:\n' >&2; cat "$tmp/out" >&2 || true
    printf 'err:\n' >&2; cat "$tmp/err" >&2 || true
  fi
  rm -rf -- "$tmp"
}

export MOCK_ACTIVE=1 MOCK_PID=4242 MOCK_PID_FLIP= MOCK_CLIENTS="$good_clients" MOCK_TTL=15 MOCK_SS="$good_ss" MOCK_REDIS_RC=0 MOCK_SS_RC=0
run_ready success 0

export MOCK_CLIENTS='id=1 addr=127.0.0.1:40001 fd=8 name=bull:YWktZXhlY3V0aW9u:qe idle=0'
run_ready wrong-client 1

export MOCK_CLIENTS="$good_clients" MOCK_SS='0 0 127.0.0.1:40003 127.0.0.1:6379 users:(("node",pid=9999,fd=11))'
run_ready wrong-pid 1

export MOCK_SS="$good_ss" MOCK_PID_FLIP=1 MOCK_PID2=4343
run_ready pid-changed 1

export MOCK_PID_FLIP= MOCK_SS='0 0 127.0.0.1:40003 127.0.0.1:6380 users:(("node",pid=4242,fd=11))'
run_ready wrong-peer 1

export MOCK_SS='0 0 127.0.0.1:6379 127.0.0.1:40003 users:(("node",pid=4242,fd=11))'
run_ready reversed-endpoints 1

export MOCK_SS='0 0 127.0.0.1:40003 users:(("node",pid=4242,fd=11))'
run_ready malformed-socket 1

export MOCK_SS="$good_ss" MOCK_TTL=-2
run_ready ttl-missing 1

export MOCK_TTL=0
run_ready ttl-zero 1

export MOCK_TTL=-1
run_ready ttl-no-expire 1

export MOCK_TTL=abc
run_ready ttl-malformed 1

export MOCK_TTL=15 MOCK_REDIS_RC=1
run_ready redis-failed 1

export MOCK_REDIS_RC=0 MOCK_SS_RC=1
run_ready socket-command-failed 1

export MOCK_SS_RC=0 MOCK_ACTIVE=0
run_ready inactive 1

export MOCK_ACTIVE=1 MOCK_PID=0
run_ready mainpid-zero 1

run_health() {
  local name="$1" want="$2"
  local tmp rc
  tmp="$(mktemp -d)"
  mkdir -p "$tmp/etc"
  printf 'REDIS_URL=redis://:%s@127.0.0.1:6379\n' "$secret" > "$tmp/etc/gateway.env"
  set +e
  (
    set -euo pipefail
    export AISB_ETC="$tmp/etc"
    export MOCK_ACTIVE MOCK_PID MOCK_CLIENTS MOCK_TTL MOCK_SS MOCK_CURL_FAIL MOCK_WORKER_FAIL MOCK_EXPIRE MOCK_BURN
    timeout() {
      printf '%s\n' "$1" >> "$AISB_ETC/timeouts"
      shift
      "$@"
    }
    sleep() {
      printf '%s\n' "$1" >> "$AISB_ETC/sleeps"
      SECONDS=$((SECONDS + 1000))
    }
    curl() {
      local arg prev=""
      for arg in "$@"; do
        if [[ "$prev" == "--max-time" ]]; then
          printf '%s\n' "$arg" >> "$AISB_ETC/curls"
        fi
        prev="$arg"
      done
      if [[ "${MOCK_BURN:-}" == "1" && ! -f "$AISB_ETC/burned" ]]; then
        printf x > "$AISB_ETC/burned"
        SECONDS=$((SECONDS + 119))
      fi
      if [[ "${MOCK_CURL_FAIL:-}" == "1" ]]; then
        return 1
      fi
      return 0
    }
    systemctl() {
      if [[ "$1" == "is-active" ]]; then
        local n=0
        if [[ -f "$AISB_ETC/activecalls" ]]; then
          n="$(cat "$AISB_ETC/activecalls")"
        fi
        n=$((n + 1))
        printf '%s\n' "$n" > "$AISB_ETC/activecalls"
        if [[ "${MOCK_EXPIRE:-}" == "1" && "$n" -ge 2 ]]; then
          SECONDS=$((SECONDS + 120))
        fi
        return 0
      fi
      if [[ "$1" == "show" ]]; then
        local n=0
        if [[ -f "$AISB_ETC/pidcalls" ]]; then
          n="$(cat "$AISB_ETC/pidcalls")"
        fi
        n=$((n + 1))
        printf '%s\n' "$n" > "$AISB_ETC/pidcalls"
        if [[ "${MOCK_EXPIRE:-}" == "1" && "$n" -ge 2 ]]; then
          SECONDS=$((SECONDS + 120))
        fi
        printf '%s\n' "$MOCK_PID"
        return 0
      fi
      return 99
    }
    redis-cli() {
      if [[ "${MOCK_WORKER_FAIL:-}" == "1" ]]; then
        return 1
      fi
      if [[ "$*" == *"CLIENT LIST"* ]]; then
        printf '%s\n' "$MOCK_CLIENTS"
        return 0
      fi
      if [[ "$*" == *"TTL bull:ai-execution:stalled-check"* ]]; then
        printf '%s\n' "$MOCK_TTL"
        return 0
      fi
      return 98
    }
    ss() { printf '%s\n' "$MOCK_SS"; }
    journalctl() { printf 'CALLED\n'; return 99; }
    health_wait
  ) >"$tmp/out" 2>"$tmp/err"
  rc=$?
  set -e
  if [[ "$rc" -eq "$want" ]] && ! grep -F -q -- "$secret" "$tmp/out" "$tmp/err" && ! grep -F -q 'CALLED' "$tmp/out" "$tmp/err"; then
    if [[ "${MOCK_BURN:-}" == "1" ]]; then
      local later
      later="$(tail -n +2 "$tmp/etc/curls" 2>/dev/null || true)"
      if [[ -z "$later" ]] || grep -v -x '1' <<< "$later" >/dev/null; then
        bad "$name"
        printf 'curl budgets:\n' >&2
        cat "$tmp/etc/curls" >&2 || true
        rm -rf -- "$tmp"
        return
      fi
      if [[ ! -f "$tmp/etc/sleeps" ]] || grep -v -x '1' "$tmp/etc/sleeps" >/dev/null; then
        bad "$name"
        printf 'sleep budgets:\n' >&2
        cat "$tmp/etc/sleeps" >&2 || true
        rm -rf -- "$tmp"
        return
      fi
      if [[ ! -f "$tmp/etc/timeouts" ]] || grep -v -x '1' "$tmp/etc/timeouts" >/dev/null; then
        bad "$name"
        printf 'timeout budgets:\n' >&2
        cat "$tmp/etc/timeouts" >&2 || true
        rm -rf -- "$tmp"
        return
      fi
    fi
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s want=%s\n' "$rc" "$want" >&2
    cat "$tmp/out" >&2 || true
    cat "$tmp/err" >&2 || true
  fi
  rm -rf -- "$tmp"
}

export MOCK_ACTIVE=1 MOCK_PID=4242 MOCK_PID_FLIP= MOCK_CLIENTS="$good_clients" MOCK_TTL=15 MOCK_SS="$good_ss" MOCK_REDIS_RC=0 MOCK_SS_RC=0 MOCK_CURL_FAIL= MOCK_WORKER_FAIL= MOCK_EXPIRE= MOCK_BURN=
run_health health-success 0
export MOCK_WORKER_FAIL=1
run_health health-worker-timeout 21
export MOCK_WORKER_FAIL= MOCK_CURL_FAIL=1
run_health health-http-timeout 21
export MOCK_CURL_FAIL= MOCK_EXPIRE=1
run_health health-expires-during-success 21
export MOCK_EXPIRE= MOCK_BURN=1 MOCK_WORKER_FAIL=1
run_health health-bounds-remaining 21

if grep -n -F 'Worker connected to ai-execution queue' "$ROOT/lib/ops-lib.sh"; then
  bad journal-line-removed
else
  ok journal-line-removed
fi

printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
