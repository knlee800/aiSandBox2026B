#!/bin/bash
# Executable T1.1-T1.6. Prepared until operational execution is authorized.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=/dev/null
source "$HERE/../lib/operational-gate.sh"
operational_gate
# shellcheck source=/dev/null
source "${AISB_OPS_LIB:-/usr/local/lib/aisandbox/ops-lib.sh}"
# shellcheck source=/dev/null
source "$HERE/../lib/case-helpers.sh"
ops_paths
AISB_CASE_NAME=${1:-t1}
case_begin "$AISB_CASE_NAME"
sha=${2:?sha}
sbin=${AISB_SBIN:-/usr/local/sbin}
evidence="$(case_evidence "$(case_run_id "$1")")"

refuse_case() {
  local plant_cleanup="$1"
  prepare_snapshot "$evidence.before"
  set +e
  "$sbin/aisandbox-prepare" "$sha" --site localhost >"$evidence.out" 2>"$evidence.err"
  local rc=$?
  set -e
  printf 'rc=%s\n' "$rc" > "$evidence.rc"
  [[ "$rc" -eq 10 ]]
  prepare_snapshot "$evidence.after"
  assert_same_snapshot "$evidence.before" "$evidence.after"
  eval "$plant_cleanup"
}

case ${1:?case} in
  t1.1)
    "$sbin/aisandbox-prepare" "$sha" --site localhost >"$evidence.log" 2>&1
    if prepare_log_probes_application "$evidence.log"; then
      printf '%s\n' 'prepare log contains a health probe' >&2
      exit 1
    fi
    assert_t1_prepared_postconditions "$sha"
    ;;
  t1.2-database)
    runuser -u postgres -- psql -d postgres -c 'CREATE DATABASE aisandbox;'
    refuse_case "runuser -u postgres -- psql -d postgres -c 'DROP DATABASE aisandbox;'"
    ;;
  t1.2-role)
    runuser -u postgres -- psql -d postgres -c "CREATE ROLE aisandbox LOGIN;"
    refuse_case "runuser -u postgres -- psql -d postgres -c 'DROP ROLE aisandbox;'"
    ;;
  t1.2-untracked)
    printf 'x\n' > /opt/aisandbox/workspaces/untracked.txt
    refuse_case "rm -f -- /opt/aisandbox/workspaces/untracked.txt"
    ;;
  t1.2-sqlite)
    printf 'x\n' > /opt/aisandbox/database/aisandbox.db
    refuse_case "rm -f -- /opt/aisandbox/database/aisandbox.db"
    ;;
  t1.2-ignored)
    printf 'x\n' > /opt/aisandbox/projects/ignored.tmp
    refuse_case "rm -f -- /opt/aisandbox/projects/ignored.tmp"
    ;;
  t1.2-snapshot)
    printf 'x\n' > /opt/aisandbox/services/snapshot-store/extra
    refuse_case "rm -f -- /opt/aisandbox/services/snapshot-store/extra"
    ;;
  t1.2-redis)
    redis_auth_env
    redis-cli -h 127.0.0.1 --no-auth-warning SET ops-test 1
    unset REDISCLI_AUTH
    refuse_case "redis_auth_env; redis-cli -h 127.0.0.1 --no-auth-warning DEL ops-test; unset REDISCLI_AUTH"
    ;;
  t1.2-enabled)
    systemctl enable aisandbox-gateway
    refuse_case "systemctl disable aisandbox-gateway"
    ;;
  t1.2-deployed)
    printf 'sha=abc\n' > /etc/aisandbox/DEPLOYED
    refuse_case "rm -f -- /etc/aisandbox/DEPLOYED"
    ;;
  t1.3)
    printf 'FAULT=prepare-build\nDISPOSABLE_NAMESPACE=1\n' > /etc/aisandbox/ops-test-mode
    chmod 0600 /etc/aisandbox/ops-test-mode
    set +e
    "$sbin/aisandbox-prepare" "$sha" --site localhost >"$evidence.fail" 2>&1
    rc=$?
    set -e
    [[ "$rc" -eq 30 ]]
    grep -q '^phase=prepare-failed$' /var/lib/aisandbox-ops/maintenance
    [[ -s /etc/aisandbox/prepare-npm-ci.interrupted ]]
    [[ -f /etc/aisandbox/prepare-npm-ci.log ]]
    [[ "$(git_as_owner rev-parse HEAD)" == "$sha" ]]
    [[ ! -e /opt/aisandbox/services/api-gateway/dist/src/main.js ]]
    clear_injected_fault
    "$sbin/aisandbox-prepare" "$sha" --site localhost
    assert_t1_prepared_postconditions "$sha"
    ;;
  t1.4)
    [[ -f /var/lib/aisandbox-ops/maintenance ]]
    before="$(writer_stamp aisandbox-gateway)"
    set +e
    systemctl start aisandbox-gateway
    rc=$?
    set -e
    [[ "$rc" -ne 0 ]]
    [[ "$(systemctl is-active aisandbox-gateway || true)" != "active" ]]
    [[ "$(writer_stamp aisandbox-gateway)" == "$before" ]]
    printf 'reboot-required\n' > "$evidence"
    case_reboot
    ;;
  t1.4-after-reboot)
    grep -qx 'reboot-required' "$evidence"
    assert_writers_not_active
    rm -f -- "$evidence"
    ;;
  t1.5)
    "$sbin/aisandbox-restore" "$3" "$4"
    [[ -f /etc/aisandbox/DEPLOYED ]]
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      [[ "$(systemctl is-active "$unit")" == "active" ]]
    done
    curl -fsS --max-time 3 http://127.0.0.1:4000/api/health/ready >/dev/null
    curl -fsS --max-time 3 http://127.0.0.1:4002/api/health >/dev/null
    curl -fsS --max-time 3 http://127.0.0.1:3002/en >/dev/null
    sample="$(quiesce_sample Q-post /var/lib/aisandbox-ops/t1.5)"
    [[ "$sample" == "ZERO" ]]
    ;;
  t1.5-repeat)
    set +e
    "$sbin/aisandbox-restore" "$3" "$4"
    rc=$?
    set -e
    [[ "$rc" -eq 10 ]]
    ;;
  t1.5-unprepared)
    [[ ! -f /etc/aisandbox/PREPARED ]]
    prepare_snapshot "$evidence.before"
    set +e
    "$sbin/aisandbox-restore" "$3" "$4"
    rc=$?
    set -e
    [[ "$rc" -eq 10 ]]
    prepare_snapshot "$evidence.after"
    assert_same_snapshot "$evidence.before" "$evidence.after"
    ;;
  t1.5-sha)
    require_prepared_idle
    printf 'sha=0000000000000000000000000000000000000000\n' > /etc/aisandbox/PREPARED
    set +e
    "$sbin/aisandbox-restore" "$3" "$4"
    rc=$?
    set -e
    [[ "$rc" -eq 10 ]]
    [[ ! -f /etc/aisandbox/DEPLOYED ]]
    ;;
  t1.5-redis)
    require_prepared_idle
    redis_auth_env
    redis-cli -h 127.0.0.1 --no-auth-warning SET ops-test 1
    set +e
    "$sbin/aisandbox-restore" "$3" "$4"
    rc=$?
    set -e
    [[ "$rc" -eq 10 ]]
    [[ "$(redis-cli -h 127.0.0.1 --no-auth-warning GET ops-test)" == "1" ]]
    redis-cli -h 127.0.0.1 --no-auth-warning DEL ops-test
    unset REDISCLI_AUTH
    [[ ! -f /etc/aisandbox/DEPLOYED ]]
    ;;
  t1.6)
    "$sbin/aisandbox-first-start"
    [[ -f /etc/aisandbox/DEPLOYED ]]
    [[ "$(runuser -u postgres -- psql -d postgres -Atc "SELECT 1 FROM pg_roles WHERE rolname='aisandbox'")" == "1" ]]
    [[ "$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT count(*) FROM migrations")" -ge 1 ]]
    files="$(count_executable_migrations HEAD)"
    applied="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT count(*) FROM migrations")"
    [[ "$files" == "$applied" ]]
    curl -fsS --max-time 3 http://127.0.0.1:4000/api/health/ready >/dev/null
    curl -fsS --max-time 3 http://127.0.0.1:4002/api/health >/dev/null
    curl -fsS --max-time 3 http://127.0.0.1:3002/en >/dev/null
    ;;
  t1.6-repeat)
    run_t16_repeat "$sha" "$sbin/aisandbox-first-start" "$evidence"
    ;;
  *)
    printf '%s\n' 'unknown T1 case' >&2
    exit 2
    ;;
esac
