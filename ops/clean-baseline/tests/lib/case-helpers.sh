# Helpers for prepared operational cases. Not an entry point.
# Evidence files for one case stay on one run id across reboot and rollback.
case_run_id() {
  local mode="$1"
  case "$mode" in
    t1.4|t1.4-after-reboot) printf '%s\n' t1.4-run ;;
    t2.3|t2.3-after-reboot|t2.3-rollback) printf '%s\n' t2.3-run ;;
    t2.5-source|t2.5-target|t2.5-source-recheck) printf '%s\n' t2.5-run ;;
    *) printf '%s\n' "$mode" ;;
  esac
}

case_evidence() {
  local name="$1" dir
  dir="${AISB_CASE_EVIDENCE:-/var/lib/aisandbox-ops/case-evidence}"
  mkdir -p "$dir" || return 30
  printf '%s\n' "$dir/$name"
}

clear_injected_fault() {
  local f tmp
  f="${AISB_ETC:-/etc/aisandbox}/ops-test-mode"
  [[ -f "$f" ]] || return 0
  tmp="$(mktemp)" || return 30
  grep -v -E '^FAULT=' "$f" > "$tmp" || true
  grep -qx 'DISPOSABLE_NAMESPACE=1' "$tmp" || printf '%s\n' 'DISPOSABLE_NAMESPACE=1' >> "$tmp"
  mv "$tmp" "$f" || return 30
  chmod 600 "$f" || return 30
}

case_resolved_is_safe() {
  local resolved="$1"
  [[ "$resolved" == /* ]] || return 1
  case "$resolved" in
    /|/.|/etc|/etc/*|/usr|/usr/*|/opt|/opt/*|/var|/var/lib) return 1 ;;
    /var/lib/aisandbox-ops|/var/lib/aisandbox-ops/*) return 0 ;;
    /*) return 0 ;;
    *) return 1 ;;
  esac
}

# Canonical destination. Existing parent symlinks are followed. A missing tail is
# kept only after that resolution. Broken links and non-directory parents fail.
case_resolve_destination() {
  local input="$1"
  local rest part acc="/" next tail
  [[ -n "$input" && "$input" == /* ]] || return 1
  case "$input" in
    *$'\n'*|*$'\r'*) return 1 ;;
  esac
  rest="${input#/}"
  while [[ -n "$rest" ]]; do
    part="${rest%%/*}"
    if [[ "$rest" == */* ]]; then
      rest="${rest#*/}"
    else
      rest=""
    fi
    [[ -n "$part" && "$part" != "." ]] || continue
    if [[ "$part" == ".." ]]; then
      if [[ -d "$acc" ]]; then
        acc="$(cd -P -- "$acc" && pwd -P)" || return 1
      fi
      if [[ "$acc" != "/" ]]; then
        acc="$(dirname -- "$acc")"
      fi
      [[ -n "$acc" ]] || acc=/
      continue
    fi
    if [[ "$acc" == "/" ]]; then
      next="/$part"
    else
      next="$acc/$part"
    fi
    if [[ -L "$next" && ! -e "$next" ]]; then
      return 1
    fi
    if [[ -e "$next" || -L "$next" ]]; then
      if [[ ! -d "$next" ]]; then
        return 1
      fi
      acc="$(cd -P -- "$next" && pwd -P)" || return 1
      [[ "$acc" == /* ]] || return 1
    else
      tail="$part"
      if [[ -n "$rest" ]]; then
        tail="$tail/$rest"
      fi
      if [[ "$acc" == "/" ]]; then
        acc="$(realpath -m -- "/$tail" 2>/dev/null)" || return 1
      else
        acc="$(realpath -m -- "$acc/$tail" 2>/dev/null)" || return 1
      fi
      [[ "$acc" == /* ]] || return 1
      rest=""
    fi
  done
  [[ "$acc" == /* ]] || return 1
  printf '%s\n' "$acc"
}

case_state_is_safe() {
  local state="${AISB_CASE_STATE:-}" resolved
  [[ -n "$state" ]] || return 1
  resolved="$(case_resolve_destination "$state")" || return 1
  case_resolved_is_safe "$resolved"
}

case_recording_allowed() {
  [[ "${AISB_OPS_OPERATIONAL_TEST:-}" == "1" ]] || return 1
  [[ "${AISB_CASE_RECORDING:-}" == "1" ]] || return 1
  case_state_is_safe
}

case_contamination_file() {
  printf '%s\n' "${AISB_CASE_STATE}/case-contaminated"
}

case_mark_contaminated() {
  local f resolved dir
  case_recording_allowed || return 2
  f="$(case_contamination_file)"
  resolved="$(case_resolve_destination "$f")" || return 2
  dir="$(dirname -- "$resolved")"
  case_resolved_is_safe "$dir" || return 2
  mkdir -p -- "$dir" || return 30
  printf 'case=%s\nreason=%s\n' "$1" "$2" > "$resolved"
}

case_begin() {
  AISB_CASE_NAME="${1:-${AISB_CASE_NAME:-unknown}}"
  if [[ -z "${AISB_CASE_STATE:-}" ]]; then
    AISB_CASE_STATE=/var/lib/aisandbox-ops
  fi
  trap 'case_finish' EXIT
  if ! case_recording_allowed; then
    printf '%s\n' 'failure recording is not armed for this context' >&2
    AISB_CASE_RECORDING=0
    return 2
  fi
}

case_finish() {
  local rc=$? cleanup_rc=0 noted="${AISB_CASE_CLEANUP_RC:-0}"
  local ere=0
  if declare -F case_cleanup >/dev/null; then
    case $- in *e*) ere=1 ;; esac
    set +e
    case_cleanup
    cleanup_rc=$?
    if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
    if [[ "$cleanup_rc" -ne 0 ]]; then
      printf '%s\n' "aisandbox-ops: case cleanup failed rc=${cleanup_rc}" >&2
    fi
  fi
  if [[ "$noted" -ne 0 && "$cleanup_rc" -eq 0 ]]; then
    cleanup_rc=$noted
  fi
  if [[ "${AISB_CASE_REBOOT:-0}" == "1" && "$rc" -eq 0 && "$cleanup_rc" -eq 0 ]]; then
    return 0
  fi
  if [[ "$rc" -ne 0 || "$cleanup_rc" -ne 0 ]]; then
    case_mark_contaminated "${AISB_CASE_NAME:-unknown}" "exit ${rc}; cleanup ${cleanup_rc}; discard this disposable host before another case" || true
  fi
  if [[ "$rc" -ne 0 ]]; then
    exit "$rc"
  fi
  if [[ "$cleanup_rc" -ne 0 ]]; then
    exit "$cleanup_rc"
  fi
}

case_reboot() {
  local rc ere=0
  AISB_CASE_REBOOT=1
  case $- in *e*) ere=1 ;; esac
  set +e
  reboot
  rc=$?
  if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
  if [[ "$rc" -ne 0 ]]; then
    exit "$rc"
  fi
}

case_on_exit() {
  case_finish
}

redis_auth_env() {
  local url
  url="$(env_file_value "${AISB_ETC:-/etc/aisandbox}/gateway.env" REDIS_URL)"
  REDISCLI_AUTH="$(redis_password "$url")"
  export REDISCLI_AUTH
}

prepare_snapshot() {
  local out="$1" unit path key val db role redis_size
  redis_auth_env || return 1
  db="$(runuser -u postgres -- psql -d postgres -Atc "SELECT COALESCE(string_agg(datname, ',' ORDER BY datname), '') FROM pg_database WHERE datname='aisandbox'")" || return 1
  role="$(runuser -u postgres -- psql -d postgres -Atc "SELECT COALESCE(string_agg(rolname, ',' ORDER BY rolname), '') FROM pg_roles WHERE rolname='aisandbox'")" || return 1
  redis_size="$(redis-cli -h 127.0.0.1 --no-auth-warning DBSIZE)" || return 1
  {
    printf 'db=%s\n' "$db"
    printf 'role=%s\n' "$role"
    printf 'redis=%s\n' "$redis_size"
    git_as_owner status --porcelain=v1 --ignored=matching --untracked-files=all -- workspaces database projects || return 1
    find /opt/aisandbox/services/snapshot-store /opt/aisandbox/snapshot-store -mindepth 1 -print 2>/dev/null | sort
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      printf 'unit=%s enabled=%s active=%s\n' "$unit" "$(systemctl is-enabled "$unit" 2>/dev/null || true)" "$(systemctl is-active "$unit" 2>/dev/null || true)"
    done
    if [[ -f /etc/aisandbox/PREPARED ]]; then sha256sum /etc/aisandbox/PREPARED; else printf 'prepared=absent\n'; fi
    if [[ -f /etc/aisandbox/DEPLOYED ]]; then sha256sum /etc/aisandbox/DEPLOYED; else printf 'deployed=absent\n'; fi
    if [[ -f /var/lib/aisandbox-ops/maintenance ]]; then sha256sum /var/lib/aisandbox-ops/maintenance; else printf 'marker=absent\n'; fi
    sha256sum /etc/aisandbox/gateway.env /etc/aisandbox/ai.env /etc/aisandbox/cm.env /etc/aisandbox/frontend.env
    if [[ -n "${AISB_SNAPSHOT_FILES:-}" ]]; then
      while IFS= read -r path; do
        [[ -n "$path" ]] || continue
        [[ -f "$path" ]] || return 1
        sha256sum -- "$path" || return 1
      done <<< "$AISB_SNAPSHOT_FILES"
    fi
    if [[ -n "${AISB_SNAPSHOT_REDIS_KEYS:-}" ]]; then
      while IFS= read -r key; do
        [[ -n "$key" ]] || continue
        val="$(redis-cli -h 127.0.0.1 --no-auth-warning --raw GET "$key")" || return 1
        printf 'redis_key=%s value=%s\n' "$key" "$val"
      done <<< "$AISB_SNAPSHOT_REDIS_KEYS"
    fi
  } > "$out"
  unset REDISCLI_AUTH
}

assert_same_snapshot() {
  cmp -s "$1" "$2"
}

writer_stamp() {
  systemctl show -p ActiveEnterTimestamp --value "$1"
}

assert_writers_not_active() {
  local unit state
  for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
    state="$(systemctl is-active "$unit" 2>/dev/null || true)"
    [[ "$state" != "active" ]]
  done
}

assert_no_listeners() {
  local hit
  hit="$(ss -ltn | awk '{print $4}' | grep -E '[:.](3002|4000|4001|4002)$' || true)"
  [[ -z "$hit" ]]
}

require_prepared_idle() {
  [[ -f /etc/aisandbox/PREPARED ]]
  [[ ! -f /etc/aisandbox/DEPLOYED ]]
  grep -q '^phase=prepared$' /var/lib/aisandbox-ops/maintenance
  grep -q '^owner_op=prepare$' /var/lib/aisandbox-ops/maintenance
}

# Return 0 when the prepare log records an application health probe.
# The prepare success notice and installer downloads are not probes.
prepare_log_probes_application() {
  local log="$1" line
  [[ -f "$log" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^aisandbox-ops:\ prepared\ [0-9a-f]{40}\;\ no\ health\ check\ is\ required$ ]]; then
      continue
    fi
    if printf '%s\n' "$line" | grep -E -q '/api/health|(127\.0\.0\.1|localhost):(3002|4000|4001|4002)([^0-9]|$)'; then
      return 0
    fi
    if printf '%s\n' "$line" | grep -E -q 'https://www\.postgresql\.org/media/keys/ACCC4CF8\.asc|https://download\.docker\.com/linux/ubuntu/gpg|https://dl\.cloudsmith\.io/public/caddy/stable/|https://deb\.nodesource\.com/setup_24\.x'; then
      continue
    fi
    if printf '%s\n' "$line" | grep -E -q -i 'health'; then
      return 0
    fi
  done < "$log"
  return 1
}

load_caddy_inspections() {
  declare -F caddy_assert_masked >/dev/null && return 0
  local here
  here=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
  # shellcheck source=/dev/null
  source "$here/../../bin/aisandbox-prepare"
}

assert_unit_pair() {
  local unit="$1" want_enabled="$2" want_active="$3" enabled active
  load_caddy_inspections
  enabled="$(caddy_probe_enabled "$unit")" || return $?
  active="$(caddy_probe_active "$unit")" || return $?
  [[ "$enabled" == "$want_enabled" && "$active" == "$want_active" ]] || return 1
}

assert_prepared_caddy_and_group() {
  local etc="${AISB_ETC:-/etc/aisandbox}" unit
  load_caddy_inspections
  grep -qx 'caddy=masked' "$etc/PREPARED" || return 1
  caddy_assert_masked || return $?
  for unit in aisandbox.target aisandbox-watchdog; do
    assert_unit_pair "$unit" disabled 'inactive|3' || return $?
  done
}

record_sha_field() {
  local file="$1" value
  [[ -f "$file" && ! -L "$file" ]] || return 1
  value="$(awk -F= '/^sha=/{print $2; found=1; exit} END{if (!found) exit 1}' "$file")" || return 1
  [[ "$value" =~ ^[0-9a-f]{40}$ ]] || return 1
  printf '%s\n' "$value"
}

snapshot_running_writers() {
  local dest="$1" unit enabled active
  : > "$dest"
  for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
    enabled="$(caddy_probe_enabled "$unit")" || return $?
    active="$(caddy_probe_active "$unit")" || return $?
    printf '%s %s %s\n' "$unit" "$enabled" "$active" >> "$dest"
  done
}

assert_t16_repeat_prerequisite() {
  local sha="$1" prepared deployed head snap line
  load_caddy_inspections
  ops_require_activation || return 1
  prepared="$(record_sha_field "$AISB_PREPARED")" || return 1
  deployed="$(record_sha_field "$AISB_DEPLOYED")" || return 1
  head="$(git_as_owner rev-parse HEAD)" || return 1
  [[ "$prepared" == "$sha" && "$deployed" == "$sha" && "$head" == "$sha" ]] || return 1
  [[ ! -e "$AISB_MARKER" && ! -L "$AISB_MARKER" ]] || return 1
  snap="$(mktemp)"
  snapshot_running_writers "$snap" || {
    rm -f -- "$snap"
    return 1
  }
  [[ "$(grep -c . "$snap")" -eq 4 ]] || {
    rm -f -- "$snap"
    return 1
  }
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *" enabled active|0" ]] || {
      rm -f -- "$snap"
      return 1
    }
  done < "$snap"
  rm -f -- "$snap"
}

run_t16_repeat() {
  local sha="$1" cmd="$2" evidence="$3"
  local rc=0 ere=0 pre_p pre_d pre_a before after
  assert_t16_repeat_prerequisite "$sha" || return 1
  pre_p="$(mktemp)"
  pre_d="$(mktemp)"
  pre_a="$(mktemp)"
  before="$(mktemp)"
  after="$(mktemp)"
  repeat_release() {
    rm -f -- "$pre_p" "$pre_d" "$pre_a" "$before" "$after"
    unset -f repeat_release
  }
  cp -p -- "$AISB_PREPARED" "$pre_p" || { repeat_release; return 1; }
  cp -p -- "$AISB_DEPLOYED" "$pre_d" || { repeat_release; return 1; }
  cp -p -- "${AISB_ETC:-/etc/aisandbox}/ACTIVATION" "$pre_a" || { repeat_release; return 1; }
  snapshot_running_writers "$before" || { repeat_release; return 1; }
  case $- in *e*) ere=1 ;; esac
  set +e
  "$cmd" >"$evidence.out" 2>"$evidence.err"
  rc=$?
  if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
  printf 'rc=%s\n' "$rc" > "$evidence.rc" || { repeat_release; return 1; }
  [[ "$rc" -eq 10 ]] || { repeat_release; return 1; }
  grep -qx 'aisandbox-ops: phase is not prepared' "$evidence.err" || { repeat_release; return 1; }
  cmp -s -- "$pre_p" "$AISB_PREPARED" || { repeat_release; return 1; }
  cmp -s -- "$pre_d" "$AISB_DEPLOYED" || { repeat_release; return 1; }
  cmp -s -- "$pre_a" "${AISB_ETC:-/etc/aisandbox}/ACTIVATION" || { repeat_release; return 1; }
  [[ ! -e "$AISB_MARKER" && ! -L "$AISB_MARKER" ]] || { repeat_release; return 1; }
  snapshot_running_writers "$after" || { repeat_release; return 1; }
  cmp -s -- "$before" "$after" || { repeat_release; return 1; }
  repeat_release
}

assert_t1_prepared_postconditions() {
  local sha="$1" unit enabled active
  local etc="${AISB_ETC:-/etc/aisandbox}"
  local root="${AISB_ROOT:-/opt/aisandbox}"
  local marker="${AISB_MARKER:-/var/lib/aisandbox-ops/maintenance}"
  [[ -f "$etc/PREPARED" ]]
  grep -q "^sha=${sha}$" "$etc/PREPARED"
  [[ ! -f "$etc/DEPLOYED" ]]
  [[ -z "$(runuser -u postgres -- psql -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='aisandbox'")" ]]
  [[ -z "$(runuser -u postgres -- psql -d postgres -Atc "SELECT 1 FROM pg_roles WHERE rolname='aisandbox'")" ]]
  [[ -z "$(git_as_owner status --porcelain=v1 --ignored=matching --untracked-files=all -- workspaces database projects)" ]]
  [[ ! -e "$root/database/aisandbox.db" ]]
  [[ ! -e "$root/database/aisandbox.db-journal" ]]
  [[ ! -e "$root/database/aisandbox.db-wal" ]]
  [[ ! -e "$root/database/aisandbox.db-shm" ]]
  [[ -z "$(find "$root/services/snapshot-store" -mindepth 1 -print -quit)" ]]
  [[ -z "$(find "$root/snapshot-store" -mindepth 1 -print -quit)" ]]
  redis_auth_env
  [[ "$(redis-cli -h 127.0.0.1 --no-auth-warning DBSIZE)" == "0" ]]
  unset REDISCLI_AUTH
  for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
    enabled="$(systemctl is-enabled "$unit" || true)"
    active="$(systemctl is-active "$unit" || true)"
    [[ "$enabled" == "disabled" && "$active" == "inactive" ]]
  done
  [[ -z "$(journalctl -u aisandbox-gateway -u aisandbox-ai -u aisandbox-cm -u aisandbox-frontend -q --no-pager || true)" ]]
  assert_no_listeners
  grep -q '^phase=prepared$' "$marker"
  assert_prepared_caddy_and_group || return $?
}

assert_restore_wrote_nothing() {
  local before="$1" after="$2"
  assert_same_snapshot "$before" "$after"
  [[ ! -f /etc/aisandbox/DEPLOYED ]]
}
