#!/bin/bash
# Executable T3.1-T3.6. T3.7 stays an AI-SERVICE gap.
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
AISB_CASE_NAME=${1:-t3}
case_begin "$AISB_CASE_NAME"
op_set record_dir /var/lib/aisandbox-ops/t3
mkdir -p /var/lib/aisandbox-ops/t3
evidence="$(case_evidence "t3-${1}")"
psql_ais() { runuser -u postgres -- psql -d aisandbox -v ON_ERROR_STOP=1 "$@"; }

insert_usage() {
  local id="$1" status="$2"
  psql_ais -c "INSERT INTO usage_records (execution_id, api_key_id, user_id, session_id, conversation_id, provider, adapter, execution_status) VALUES ('${id}', 'k', 'u', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', 'stub', 'stub', '${status}')"
}
delete_usage() {
  psql_ais -c "DELETE FROM usage_records WHERE execution_id='${1}'"
}
insert_run() {
  local id="$1" status="$2"
  psql_ais -c "INSERT INTO collaboration_runs (collaboration_run_id, user_id, project_id, initiator_agent_role, initiator_builder_profile_id, orchestration_mode, status, referral_ids, active_builder_profile_ids, timeout_ms, created_at, updated_at) VALUES ('${id}', 'u', 'p', 'builder', 'profile', 'read_only', '${status}', '[]'::jsonb, '[\"profile\"]'::jsonb, 60000, now(), now())"
}
insert_referral() {
  local id="$1" run="$2" status="$3"
  psql_ais -c "INSERT INTO collaboration_referrals (referral_id, collaboration_run_id, referral_trace_id, source_agent_role, source_builder_profile_id, target_agent_role, target_builder_profile_id, status, cancel_status, idempotency_key, referral_chain, depth, max_depth, visited_builder_profile_ids, timeout_ms, constraint_timeout_ms, constraint_max_depth, constraint_max_agents_per_collaboration, constraint_read_only, constraint_allow_write_tools, constraint_allowed_tools, created_at, updated_at) VALUES ('${id}', '${run}', '${id}-trace', 'builder', 'profile', 'technology-advisor', 'profile', '${status}', 'not_requested', '${id}-idem', '[]'::jsonb, 0, 2, '[\"profile\"]'::jsonb, 60000, 60000, 2, 2, true, false, '[]'::jsonb, now(), now())"
}
bull_node() {
  redis_auth_env
  node --input-type=commonjs - /opt/aisandbox/services/api-gateway/package.json "$1" <<'NODE'
const { createRequire } = require('module');
const req = createRequire(process.argv[2]);
const resolved = req.resolve('bullmq/package.json');
if (!resolved.startsWith('/opt/aisandbox/')) {
  console.error('bullmq resolved outside the prepared tree');
  process.exit(1);
}
const { Queue } = req('bullmq');
const q = new Queue('ai-execution', {
  connection: { host: '127.0.0.1', port: 6379, password: process.env.REDISCLI_AUTH },
});
const mode = process.argv[3];
(async () => {
  if (mode === 'wait') await q.add('ops-t3', { probe: 'wait' });
  if (mode === 'delay') await q.add('ops-t3', { probe: 'delay' }, { delay: 600000 });
  if (mode === 'counts') {
    const c = await q.getJobCounts('wait', 'paused', 'active', 'delayed', 'prioritized', 'waiting-children');
    process.stdout.write([c.wait, c.paused, c.active, c.delayed, c.prioritized, c['waiting-children']].join(' '));
  }
  if (mode === 'drain') await q.drain(true);
  await q.close();
})().catch((err) => { console.error(err); process.exit(1); });
NODE
  unset REDISCLI_AUTH
}

case ${1:?case} in
  t3.1-zero)
    sample="$(quiesce_sample T3-zero)"
    [[ "$sample" == "ZERO" ]]
    ;;
  t3.1-waiting)
    systemctl stop aisandbox-ai
    bull_node wait
    sample="$(quiesce_sample T3-waiting)"
    bull_node drain
    [[ ! -f /var/lib/aisandbox-ops/maintenance ]] && systemctl start aisandbox-ai
    [[ "$sample" == "ACTIVE" ]]
    ;;
  t3.1-delayed)
    systemctl stop aisandbox-ai
    bull_node delay
    sample="$(quiesce_sample T3-delayed)"
    bull_node drain
    [[ ! -f /var/lib/aisandbox-ops/maintenance ]] && systemctl start aisandbox-ai
    [[ "$sample" == "ACTIVE" ]]
    ;;
  t3.1-ledger-pending|t3.1-ledger-running|t3.1-ledger-cancel)
    status="${1#t3.1-ledger-}"
    [[ "$status" == "cancel" ]] && status=cancel_requested
    id="00000000-0000-4000-8000-0000000000a1"
    insert_usage "$id" "$status"
    sample="$(quiesce_sample "T3-${status}")"
    delete_usage "$id"
    [[ "$sample" == "ACTIVE" ]]
    ;;
  t3.1-collab-run)
    insert_run ops-t3-run active
    sample="$(quiesce_sample T3-collab-run)"
    psql_ais -c "DELETE FROM collaboration_runs WHERE collaboration_run_id='ops-t3-run'"
    [[ "$sample" == "ACTIVE" ]]
    ;;
  t3.1-referral-pending|t3.1-referral-approved|t3.1-referral-progress)
    status="${1#t3.1-referral-}"
    case "$status" in
      pending) status=pending_approval ;;
      progress) status=in_progress ;;
    esac
    insert_run ops-t3-run completed
    insert_referral ops-t3-ref ops-t3-run "$status"
    sample="$(quiesce_sample "T3-${status}")"
    psql_ais -c "DELETE FROM collaboration_referrals WHERE referral_id='ops-t3-ref'"
    psql_ais -c "DELETE FROM collaboration_runs WHERE collaboration_run_id='ops-t3-run'"
    [[ "$sample" == "ACTIVE" ]]
    ;;
  t3.1-bad-auth)
    cp -a /etc/aisandbox/gateway.env "$evidence.env"
    bad="$(env_file_value /etc/aisandbox/gateway.env REDIS_URL | sed 's#redis://:[^@]*@#redis://:wrong-password@#')"
    kv_set /etc/aisandbox/gateway.env REDIS_URL "$bad"
    sample="$(quiesce_sample T3-bad-auth)"
    cp -a "$evidence.env" /etc/aisandbox/gateway.env
    [[ "$sample" == "UNKNOWN" ]]
    ;;
  t3.1-stopped-db)
    systemctl stop postgresql
    sample="$(quiesce_sample T3-stopped-db)"
    systemctl start postgresql
    [[ "$sample" == "UNKNOWN" ]]
    ;;
  t3.1-missing-table)
    psql_ais -c 'ALTER TABLE usage_records RENAME TO usage_records_ops_t3'
    sample="$(quiesce_sample T3-missing-table)"
    psql_ais -c 'ALTER TABLE usage_records_ops_t3 RENAME TO usage_records'
    [[ "$sample" == "UNKNOWN" ]]
    ;;
  t3.1-wrongtype)
    redis_auth_env
    redis-cli -h 127.0.0.1 --no-auth-warning RENAMENX bull:ai-execution:wait bull:ai-execution:wait.ops-t3 || true
    redis-cli -h 127.0.0.1 --no-auth-warning SET bull:ai-execution:wait wrong-type
    unset REDISCLI_AUTH
    sample="$(quiesce_sample T3-wrongtype)"
    redis_auth_env
    redis-cli -h 127.0.0.1 --no-auth-warning DEL bull:ai-execution:wait
    redis-cli -h 127.0.0.1 --no-auth-warning RENAMENX bull:ai-execution:wait.ops-t3 bull:ai-execution:wait || true
    unset REDISCLI_AUTH
    [[ "$sample" == "UNKNOWN" ]]
    ;;
  t3.2)
    sample="$(quiesce_sample T3-bull)"
    [[ "$sample" == "ZERO" || "$sample" == "ACTIVE" ]]
    resolved="$(node -e 'const r=require("module").createRequire(process.argv[1]); process.stdout.write(r.resolve("bullmq/package.json"))' /opt/aisandbox/services/api-gateway/package.json)"
    [[ "$resolved" == /opt/aisandbox/* ]]
    got="$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version)' "$resolved")"
    pinned="$(node -e 'const l=require(process.argv[1]); process.stdout.write(l.packages["node_modules/bullmq"].version)' /opt/aisandbox/package-lock.json)"
    [[ "$got" == "$pinned" ]]
    bull_node counts > /tmp/aisb-bull-counts.json
    last="$(tail -n 1 /var/lib/aisandbox-ops/t3/quiescence.json)"
    queue="$(printf '%s\n' "$last" | sed -n 's/.*"queue":\[\([^]]*\)\].*/\1/p' | tr -d '"')"
    bull="$(tr ' ' ',' < /tmp/aisb-bull-counts.json)"
    [[ "$queue" == "$bull" ]]
    rm -f -- /tmp/aisb-bull-counts.json
    ;;
  t3.3)
    declare -A before=()
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      before[$unit]="$(writer_stamp "$unit")"
    done
    insert_usage 00000000-0000-4000-8000-0000000000a9 pending
    set +e
    /usr/local/sbin/aisandbox-deploy "$2"
    rc=$?
    set -e
    delete_usage 00000000-0000-4000-8000-0000000000a9
    [[ "$rc" -eq 11 ]]
    [[ ! -f /var/lib/aisandbox-ops/maintenance ]]
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      [[ "$(writer_stamp "$unit")" == "${before[$unit]}" ]]
    done
    ;;
  t3.4)
    printf 'DISPOSABLE_NAMESPACE=1\nQ3_EXPECT_ID=00000000-0000-4000-8000-0000000000a2\n' > /etc/aisandbox/ops-test-mode
    cat > /etc/aisandbox/q3-inject.sql <<'SQL'
INSERT INTO usage_records (execution_id, api_key_id, user_id, session_id, conversation_id, provider, adapter, execution_status)
VALUES ('00000000-0000-4000-8000-0000000000a2', 'k', 'u', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c2', 'stub', 'stub', 'pending');
SQL
    chmod 0600 /etc/aisandbox/ops-test-mode /etc/aisandbox/q3-inject.sql
    set +e
    /usr/local/sbin/aisandbox-deploy "$2"
    rc=$?
    set -e
    [[ "$rc" -eq 11 ]]
    [[ ! -f /var/lib/aisandbox-ops/maintenance ]]
    [[ "$(systemctl is-active aisandbox-gateway)" == "active" ]]
    [[ "$(systemctl is-active aisandbox-frontend)" == "active" ]]
    [[ "$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT execution_status FROM usage_records WHERE execution_id='00000000-0000-4000-8000-0000000000a2'")" == "pending" ]]
    delete_usage 00000000-0000-4000-8000-0000000000a2
    ;;
  t3.5)
    printf 'FAULT=q6\nDISPOSABLE_NAMESPACE=1\n' > /etc/aisandbox/ops-test-mode
    chmod 0600 /etc/aisandbox/ops-test-mode
    set +e
    /usr/local/sbin/aisandbox-backup
    rc=$?
    set -e
    [[ "$rc" -eq 11 ]]
    grep -q '^phase=work-detected$' /var/lib/aisandbox-ops/maintenance
    [[ "$(systemctl is-active aisandbox-ai || true)" != "active" ]]
    set +e
    /usr/local/sbin/aisandbox-maint exit
    exit_rc=$?
    set -e
    [[ "$exit_rc" -eq 11 ]]
    grep -q '^phase=work-detected$' /var/lib/aisandbox-ops/maintenance
    [[ "$(systemctl is-active aisandbox-ai || true)" != "active" ]]
    redis_auth_env
    redis-cli -h 127.0.0.1 --no-auth-warning DEL bull:ai-execution:wait
    unset REDISCLI_AUTH
    clear_injected_fault
    /usr/local/sbin/aisandbox-maint exit
    [[ ! -f /var/lib/aisandbox-ops/maintenance ]]
    ;;
  t3.6)
    [[ "$(env_file_value /etc/aisandbox/gateway.env GLOBAL_EXECUTION_ENABLED)" == "false" ]]
    /usr/local/sbin/aisandbox-backup
    /usr/local/sbin/aisandbox-deploy "$2"
    set_path="$(find /var/backups/aisandbox -path '*/records/*' -prune -o -name quiescence.json -printf '%T@ %p\n' | sort -n | tail -n 1 | cut -d' ' -f2-)"
    record="$(find /var/backups/aisandbox/records -name quiescence.json -printf '%T@ %p\n' | sort -n | tail -n 1 | cut -d' ' -f2-)"
    [[ -n "$set_path" && -n "$record" && "$record" != "$set_path" ]]
    for phase in Q1a Q1b Q3 Q6; do
      grep -q "\"phase\":\"${phase}\"" "$set_path"
      grep -q "\"phase\":\"${phase}\"" "$record"
    done
    ;;
  *)
    printf '%s\n' 'unknown T3 case' >&2
    exit 2
    ;;
esac
