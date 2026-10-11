#!/bin/bash
# S9 maint exit. Mocked commands only. Does not start a service.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/../.." && pwd)
# shellcheck source=/dev/null
source "$ROOT/lib/ops-lib.sh"
pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }

order_ok() {
  local file="$ROOT/bin/aisandbox-maint"
  local n_root n_path n_lock n_tree n_phase n_sample n_start
  n_root=$(grep -n -F 'ops_require_root || exit 10' "$file" | head -n 1 | cut -d: -f1)
  n_path=$(grep -n -F 'ops_refuse_override || exit 10' "$file" | head -n 1 | cut -d: -f1)
  n_lock=$(grep -n -F 'ops_lock || exit 10' "$file" | head -n 1 | cut -d: -f1)
  n_tree=$(grep -n -F 'assert_tree_and_schema_unchanged || exit 10' "$file" | head -n 1 | cut -d: -f1)
  n_phase=$(grep -n -F 'phase_allows_maint_exit ' "$file" | head -n 1 | cut -d: -f1)
  n_sample=$(grep -n -F 'quiesce_sample S9' "$file" | head -n 1 | cut -d: -f1)
  n_start=$(grep -n -F 'start_units_after_marker_removed' "$file" | head -n 1 | cut -d: -f1)
  if [[ -n "$n_root" && "$n_root" -lt "$n_path" && "$n_path" -lt "$n_lock" && "$n_lock" -lt "$n_phase" && "$n_phase" -lt "$n_tree" && "$n_tree" -lt "$n_sample" && "$n_sample" -lt "$n_start" ]]; then
    ok order-before-restart
  else
    bad order-before-restart
  fi
  if grep -n -F '[[ "$phase" == "work-detected" ]]' "$file" >/dev/null; then
    ok sample-only-for-work-detected
  else
    bad sample-only-for-work-detected
  fi
}
order_ok

run_exit() {
  local name="$1" want="$2" phase="$3"
  local tmp rc
  tmp="$(mktemp -d)"
  mkdir -p "$tmp/etc" "$tmp/state" "$tmp/bin"
  printf ':\n' > "$tmp/stub.sh"
  cat > "$tmp/state/maintenance" <<EOF
owner_op=${MOCK_OWNER:-backup}
owner_pid=1
phase=${phase}
pre_active_units=aisandbox-gateway
pre_sha=abc
pre_migrations=hash
EOF
  printf 'pre_active_units=aisandbox-gateway\npre_sha=abc\npre_migrations=hash\nrecord_dir=%s\n' "$tmp/state" > "$tmp/state/current-op"
  set +e
  (
    set -euo pipefail
    export AISB_ETC="$tmp/etc" AISB_MARKER="$tmp/state/maintenance" AISB_OP="$tmp/state/current-op"
    export AISB_LOCK="$tmp/state/lock" AISB_ROOT="$tmp/root" AISB_OPS_LIB="$tmp/stub.sh"
    export TRACE="$tmp/trace" RECORD="$tmp/state" MOCK_SAMPLE MOCK_SAMPLE_RC MOCK_TREE_RC
    : > "$TRACE"
    ops_require_root() { return 0; }
    ops_refuse_override() { return 0; }
    ops_lock() { printf 'lock\n' >> "$TRACE"; return 0; }
    assert_tree_and_schema_unchanged() {
      printf 'tree\n' >> "$TRACE"
      return "${MOCK_TREE_RC:-0}"
    }
    quiesce_sample() {
      printf 'sample %s\n' "$1" >> "$TRACE"
      mkdir -p "$RECORD"
      printf '%s\n' "$MOCK_SAMPLE" >> "$RECORD/quiescence.json"
      if [[ "${MOCK_SAMPLE_RC:-0}" -ne 0 ]]; then
        return "$MOCK_SAMPLE_RC"
      fi
      printf '%s' "$MOCK_SAMPLE"
    }
    start_units_after_marker_removed() {
      printf 'start %s\n' "$*" >> "$TRACE"
      rm -f -- "$AISB_MARKER"
    }
    marker_remove() {
      printf 'remove\n' >> "$TRACE"
      rm -f -- "$AISB_MARKER"
    }
    health_wait() { printf 'health\n' >> "$TRACE"; return 0; }
    append_ids_only() { printf '111\n222\n'; }
    systemctl() { printf 'systemctl %s\n' "$*" >> "$TRACE"; return 0; }
    set -- exit
    # shellcheck source=/dev/null
    source "$ROOT/bin/aisandbox-maint"
  ) >"$tmp/out" 2>"$tmp/err"
  rc=$?
  set -e
  local good=0
  if [[ "$rc" -eq "$want" ]]; then
    good=1
  fi
  if [[ "$good" -eq 1 && "${EXPECT_MARKER:-keep}" == "keep" && ! -f "$tmp/state/maintenance" ]]; then
    good=0
  fi
  if [[ "$good" -eq 1 && "${EXPECT_MARKER:-keep}" == "gone" && -f "$tmp/state/maintenance" ]]; then
    good=0
  fi
  if [[ "$good" -eq 1 && "${EXPECT_START:-no}" == "no" ]] && grep -q '^start ' "$tmp/trace"; then
    good=0
  fi
  if [[ "$good" -eq 1 && "${EXPECT_START:-no}" == "yes" ]] && ! grep -q '^start ' "$tmp/trace"; then
    good=0
  fi
  if [[ "$good" -eq 1 && "${EXPECT_SAMPLE:-yes}" == "yes" ]] && ! grep -q '^sample S9$' "$tmp/trace"; then
    good=0
  fi
  if [[ "$good" -eq 1 && "${EXPECT_SAMPLE:-yes}" == "no" ]] && grep -q '^sample ' "$tmp/trace"; then
    good=0
  fi
  if [[ "$good" -eq 1 && "${EXPECT_IDS:-no}" == "yes" ]]; then
    if ! grep -qx '111' "$tmp/err" || ! grep -qx '222' "$tmp/err"; then
      good=0
    fi
    if grep -E -q 'payload|SELECT |replay|delete' "$tmp/err"; then
      good=0
    fi
  fi
  if [[ "$good" -eq 1 && -f "$tmp/state/quiescence.json" ]]; then
    :
  elif [[ "$good" -eq 1 && "${EXPECT_EVIDENCE:-no}" == "yes" ]]; then
    good=0
  fi
  if [[ "$good" -eq 1 ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s want=%s\n' "$rc" "$want" >&2
    printf 'trace:\n' >&2; cat "$tmp/trace" >&2 || true
    printf 'err:\n' >&2; cat "$tmp/err" >&2 || true
  fi
  rm -rf -- "$tmp"
}

export MOCK_SAMPLE=ZERO MOCK_SAMPLE_RC=0 MOCK_TREE_RC=0 EXPECT_MARKER=gone EXPECT_START=yes EXPECT_SAMPLE=yes EXPECT_IDS=no EXPECT_EVIDENCE=yes
run_exit zero-continues 0 work-detected

export MOCK_TREE_RC=30 EXPECT_MARKER=keep EXPECT_START=no EXPECT_SAMPLE=no EXPECT_EVIDENCE=no
run_exit zero-tree-still-refuses 10 work-detected

export MOCK_TREE_RC=0 MOCK_SAMPLE=ACTIVE EXPECT_MARKER=keep EXPECT_START=no EXPECT_SAMPLE=yes EXPECT_IDS=yes EXPECT_EVIDENCE=yes
run_exit active-refuses 11 work-detected

export MOCK_SAMPLE=UNKNOWN EXPECT_IDS=yes
run_exit unknown-refuses 12 work-detected

export MOCK_SAMPLE='ZERO extra' EXPECT_IDS=no
run_exit malformed-refuses 12 work-detected

export MOCK_SAMPLE='' MOCK_SAMPLE_RC=12 EXPECT_EVIDENCE=yes
run_exit sample-failure-refuses 12 work-detected

export MOCK_SAMPLE_RC=0 MOCK_SAMPLE=ZERO EXPECT_MARKER=gone EXPECT_START=yes EXPECT_SAMPLE=no EXPECT_EVIDENCE=no EXPECT_IDS=no
run_exit other-phase-skips-sample 0 quiesced

printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
