#!/bin/bash
# Shared operations library for CLEAN-BASELINE-OPS-01.
# Sourced by entry points. Direct execution does not perform an operation.
# Locked runtime: Node 24. Workspace image: node:24-alpine.
# Closed phase vocabulary is phase_is_known. Recovery lists are subsets of it.

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  printf '%s\n' 'ops-lib.sh is a library and is not an entry point' >&2
  exit 2
fi

ops_paths() {
  AISB_ROOT=${AISB_ROOT:-/opt/aisandbox}
  AISB_ETC=${AISB_ETC:-/etc/aisandbox}
  AISB_MARKER=${AISB_MARKER:-/var/lib/aisandbox-ops/maintenance}
  AISB_OP=${AISB_OP:-/var/lib/aisandbox-ops/current-op}
  AISB_LOCK=${AISB_LOCK:-/run/aisandbox/ops.lock}
  AISB_PREPARED=${AISB_PREPARED:-/etc/aisandbox/PREPARED}
  AISB_DEPLOYED=${AISB_DEPLOYED:-/etc/aisandbox/DEPLOYED}
  AISB_BACKUPS=${AISB_BACKUPS:-/var/backups/aisandbox}
  AISB_OFFHOST=${AISB_OFFHOST:-/var/backups/aisandbox-offhost}
  AISB_UID=${AISB_UID:-7300}
  AISB_GID=${AISB_GID:-7300}
  AISB_IMAGE=${AISB_IMAGE:-node:24-alpine}
  AISB_LOCK_FD=${AISB_LOCK_FD:-}
  AISB_PG_HBA=${AISB_PG_HBA:-/etc/postgresql/15/main/pg_hba.conf}
  AISB_REDIS_CONF=${AISB_REDIS_CONF:-/etc/redis/redis.conf}
  AISB_CADDYFILE=${AISB_CADDYFILE:-/etc/caddy/Caddyfile}
  AISB_CADDY_ENV=${AISB_CADDY_ENV:-/etc/caddy/aisandbox-operator.env}
  AISB_UNIT_DIR=${AISB_UNIT_DIR:-/etc/systemd/system}
  AISB_PG_CONF=${AISB_PG_CONF:-/etc/postgresql/15/main/postgresql.conf}
}

note() {
  printf 'aisandbox-ops: %s\n' "$*" >&2
}

phase_is_known() {
  case "$1" in
    preparing|prepare-failed|prepared|first-start-pre|first-start-failed|restore-pre|restore-failed|quiescing|quiesced|prepared-for-backup|work-detected|mutating|mutating-failed|migrating|migrating-failed|starting|starting-failed)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

phase_allows_maint_exit() {
  case "$1" in
    quiescing|quiesced|prepared-for-backup|work-detected)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

phase_allows_from_maintenance() {
  case "$1" in
    mutating|mutating-failed|migrating|migrating-failed|starting|starting-failed)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

phase_allows_automatic_restart() {
  case "$1" in
    quiescing|quiesced|prepared-for-backup)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

git_as_owner() {
  [[ -d "$AISB_ROOT/.git" ]] || return 1
  runuser -u aisandbox -- git -C "$AISB_ROOT" "$@"
}

copy_file_if_distinct() {
  local src="$1" dest="$2" src_real dest_real
  [[ -f "$src" ]] || return 20
  src_real="$(cd "$(dirname -- "$src")" && pwd)/$(basename -- "$src")" || return 20
  if [[ -e "$dest" ]]; then
    dest_real="$(cd "$(dirname -- "$dest")" && pwd)/$(basename -- "$dest")" || return 20
    if [[ "$src_real" == "$dest_real" ]]; then
      return 0
    fi
  fi
  cp -p -- "$src" "$dest" || return 20
}

read_env_literal() {
  local file="$1" key="$2" line
  [[ -f "$file" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      "${key}="*)
        printf '%s' "${line#"${key}"=}"
        return 0
        ;;
    esac
  done < "$file"
  return 1
}

confirm_shared_value() {
  local key="$1" file="$2" expect="$3" got
  got="$(env_file_value "$file" "$key")" || return 30
  [[ -n "$got" && "$got" == "$expect" ]] || return 30
}
reconcile_pair() {
  local key="$1" left="$2" right="$3" a b gen
  a="$(env_file_value "$left" "$key")" || return 30
  b="$(env_file_value "$right" "$key")" || return 30
  if [[ -n "$a" && -n "$b" && "$a" != "$b" ]]; then
    note "configuration ${key} disagrees between $(basename -- "$left") and $(basename -- "$right")"
    return 30
  fi
  if [[ -n "$a" && -z "$b" ]]; then
    kv_set "$right" "$key" "$a" || return 30
    confirm_shared_value "$key" "$right" "$a" || return 30
    return 0
  fi
  if [[ -z "$a" && -n "$b" ]]; then
    kv_set "$left" "$key" "$b" || return 30
    confirm_shared_value "$key" "$left" "$b" || return 30
    return 0
  fi
  if [[ -z "$a" && -z "$b" ]]; then
    gen="$(openssl rand -hex 32)" || return 30
    [[ "$gen" =~ ^[0-9a-f]{64}$ ]] || return 30
    kv_set "$left" "$key" "$gen" || return 30
    kv_set "$right" "$key" "$gen" || return 30
    confirm_shared_value "$key" "$left" "$gen" || return 30
    confirm_shared_value "$key" "$right" "$gen" || return 30
  fi
}
fill_shared_url() {
  local key="$1" left="$2" right="$3" a b val pass
  a="$(env_file_value "$left" "$key")" || return 30
  b="$(env_file_value "$right" "$key")" || return 30
  if [[ -n "$a" && -n "$b" && "$a" != "$b" ]]; then
    note "configuration ${key} disagrees"
    return 30
  fi
  if [[ -n "$a" && -z "$b" ]]; then
    kv_set "$right" "$key" "$a" || return 30
    confirm_shared_value "$key" "$right" "$a" || return 30
    return 0
  fi
  if [[ -z "$a" && -n "$b" ]]; then
    kv_set "$left" "$key" "$b" || return 30
    confirm_shared_value "$key" "$left" "$b" || return 30
    return 0
  fi
  if [[ -z "$a" && -z "$b" ]]; then
    pass="$(openssl rand -hex 32)" || return 30
    [[ "$pass" =~ ^[0-9a-f]{64}$ ]] || return 30
    case "$key" in
      DATABASE_URL) val="postgresql://aisandbox:${pass}@127.0.0.1:5432/aisandbox" ;;
      REDIS_URL) val="redis://:${pass}@127.0.0.1:6379/0" ;;
      *) note "unsupported url key ${key}"; return 30 ;;
    esac
    kv_set "$left" "$key" "$val" || return 30
    kv_set "$right" "$key" "$val" || return 30
    confirm_shared_value "$key" "$left" "$val" || return 30
    confirm_shared_value "$key" "$right" "$val" || return 30
  fi
}

load_caddy_operator_env() {
  local file="${1:-$AISB_CADDY_ENV}"
  AISB_OPERATOR_USER="$(read_env_literal "$file" AISB_OPERATOR_USER)" || return 30
  AISB_OPERATOR_HASH="$(read_env_literal "$file" AISB_OPERATOR_HASH)" || return 30
  export AISB_OPERATOR_USER AISB_OPERATOR_HASH
}

install_staged_tree() {
  local tree dest tree_real dest_real
  tree="$(ops_tree)" || return 30
  dest="${AISB_INSTALL_TREE:-/usr/local/lib/aisandbox/clean-baseline}"
  install -d -o root -g root -m 0755 "$dest" || return 30
  tree_real="$(cd "$tree" && pwd -P)" || return 30
  dest_real="$(cd "$dest" && pwd -P)" || return 30
  if [[ "$tree_real" == "$dest_real" ]]; then
    return 0
  fi
  cp -a "$tree/." "$dest/" || return 30
}

roles_restrict_pairs_match() {
  local src="$1"
  awk '
    /^\\restrict[[:space:]]/ {
      if (open != "") exit 2
      open = $2
      if (open == "") exit 2
      next
    }
    /^\\unrestrict[[:space:]]/ {
      if (open == "" || $2 != open) exit 3
      open = ""
      next
    }
    END { if (open != "") exit 4 }
  ' "$src"
}

prepare_roles_session_script() {
  local src="$1" dest="$2"
  roles_restrict_pairs_match "$src" || return 40
  awk '
    /^[[:space:]]*CREATE ROLE[[:space:]]/ {
      print "DO $aisb_role$"
      print "BEGIN"
      print $0
      print "EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE;"
      print "END"
      print "$aisb_role$;"
      next
    }
    { print }
  ' "$src" > "$dest" || return 40
}

role_name_from_create() {
  local stmt="$1"
  if [[ "$stmt" =~ ^[[:space:]]*CREATE[[:space:]]+ROLE[[:space:]]+\"([^\"]+)\" ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$stmt" =~ ^[[:space:]]*CREATE[[:space:]]+ROLE[[:space:]]+([A-Za-z_][A-Za-z0-9_]*) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

apply_roles_sql() {
  local sqlfile="$1" script out rc name names quoted ere=0
  [[ -f "$sqlfile" ]] || return 40
  script="$(mktemp)"
  names="$(mktemp)"
  prepare_roles_session_script "$sqlfile" "$script" || {
    rm -f -- "$script" "$names"
    return 40
  }
  case $- in *e*) ere=1 ;; esac
  set +e
  out="$(runuser -u postgres -- psql -d postgres -v ON_ERROR_STOP=1 -f /dev/stdin < "$script" 2>&1)"
  rc=$?
  if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
  if printf '%s\n' "$out" | grep -E -q 'FATAL:|PANIC:' || [[ "$rc" -ne 0 ]]; then
    note "roles.sql failed"
    rm -f -- "$script" "$names"
    return 40
  fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    if name="$(role_name_from_create "$line")"; then
      printf '%s\n' "$name" >> "$names"
    fi
  done < "$sqlfile"
  [[ -s "$names" ]] || {
    note "roles.sql named no roles"
    rm -f -- "$script" "$names"
    return 40
  }
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    quoted="${name//\'/\'\'}"
    out="$(runuser -u postgres -- psql -d postgres -Atc "SELECT 1 FROM pg_roles WHERE rolname='${quoted}'")" || {
      rm -f -- "$script" "$names"
      return 40
    }
    [[ "$out" == "1" ]] || {
      note "role ${name} was not restored"
      rm -f -- "$script" "$names"
      return 40
    }
  done < "$names"
  rm -f -- "$script" "$names"
}

hook_enabled() {
  [[ -f "${AISB_ETC}/ops-test-mode" ]] || return 1
  ops_test_gate_ok
}

restore_bind_preflight() {
  local verified="$1"
  [[ "$verified" == "pass" ]] || return 10
  op_begin restore || return 10
  op_set empty_target pass || return 10
}

apply_q3_inject() {
  local expect out
  hook_enabled || return 0
  [[ -f "$AISB_ETC/q3-inject.sql" ]] || return 0
  runuser -u postgres -- psql -d aisandbox -v ON_ERROR_STOP=1 -f /dev/stdin < "$AISB_ETC/q3-inject.sql" || return 12
  expect="$(awk -F= '/^Q3_EXPECT_ID=/{print substr($0,14)}' "$AISB_ETC/ops-test-mode")"
  if [[ -n "$expect" ]]; then
    out="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT 1 FROM usage_records WHERE execution_id='${expect}'")" || return 12
    [[ "$out" == "1" ]] || return 12
  fi
}

applied_blobs_file() {
  printf '%s\n' "$(dirname -- "$AISB_OP")/applied-migration-blobs.txt"
}

record_migration_blobs() {
  merge_applied_blobs "${2:-HEAD}" "${1:-$(applied_blobs_file)}"
}

ledger_blob_for() {
  local file="$1" ts="$2" line blob
  line="$(grep -E "^ts=${ts} " "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1
  blob="${line#* blob=}"
  blob="${blob%% *}"
  printf '%s' "$blob"
}

# TypeORM loader at 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c,
# services/api-gateway/data-source.ts:
#   migrations: [__dirname + '/src/migrations/*.{ts,js}']
# The star does not cross a slash, so only direct children ending in .ts or .js
# are executable migrations. README.md and nested tests are not loaded.
migration_path_selected() {
  local path="$1" rest
  local prefix="services/api-gateway/src/migrations/"
  [[ "$path" == "$prefix"* ]] || return 1
  rest="${path#"$prefix"}"
  [[ -n "$rest" && "$rest" != */* ]] || return 1
  case "$rest" in
    *.ts|*.js) return 0 ;;
    *) return 1 ;;
  esac
}

migration_timestamp_ok() {
  local base="$1" ts
  ts="${base%%-*}"
  [[ "$ts" =~ ^[0-9]+$ ]]
}

merge_applied_blobs() {
  local commit="$1" dest="${2:-$(applied_blobs_file)}" out line mode typ blob path base ts old tmp
  if [[ -d "$dest" ]]; then
    dest="$dest/migration-blobs.txt"
  fi
  mkdir -p "$(dirname -- "$dest")" || return 30
  out="$(git_as_owner ls-tree -r "$commit" -- services/api-gateway/src/migrations)" || return 30
  tmp="$(mktemp)" || return 30
  if [[ -f "$dest" ]]; then
    cp -p "$dest" "$tmp" || { rm -f -- "$tmp"; return 30; }
  fi
  while read -r mode typ blob path; do
    [[ "$mode" == "source="* || -z "$blob" || -z "$path" ]] && continue
    migration_path_selected "$path" || continue
    base="$(basename -- "$path")"
    ts="${base%%-*}"
    if ! migration_timestamp_ok "$base"; then
      note "malformed executable migration ${path}"
      rm -f -- "$tmp"
      return 30
    fi
    if [[ -f "$tmp" ]] && grep -E -q "^ts=${ts} " "$tmp"; then
      old="$(ledger_blob_for "$tmp" "$ts")" || { rm -f -- "$tmp"; return 30; }
      if [[ "$old" != "$blob" ]]; then
        note "refusing to replace applied migration ${ts}"
        rm -f -- "$tmp"
        return 10
      fi
    else
      printf 'ts=%s blob=%s path=%s source=%s\n' "$ts" "$blob" "$path" "$commit" >> "$tmp" || {
        rm -f -- "$tmp"
        return 30
      }
    fi
  done <<< "$out"
  mv "$tmp" "$dest" || { rm -f -- "$tmp"; return 30; }
  op_set migration_blobs "$dest" || return 30
}

require_ledger_covers_applied() {
  local applied rc ts ledger ere=0
  case $- in *e*) ere=1 ;; esac
  set +e
  applied="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT timestamp FROM migrations ORDER BY timestamp" 2>/dev/null)"
  rc=$?
  if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
  if [[ "$rc" -ne 0 ]]; then
    note "applied migration list is unavailable"
    return 10
  fi
  [[ -n "${applied//[[:space:]]/}" ]] || return 0
  ledger="$(applied_blobs_file)"
  [[ -s "$ledger" ]] || {
    note "applied migration evidence is absent"
    return 10
  }
  while IFS= read -r ts; do
    [[ -n "$ts" ]] || continue
    if [[ ! "$ts" =~ ^[0-9]+$ ]]; then
      note "applied migration list is malformed"
      return 10
    fi
    grep -E -q "^ts=${ts} " "$ledger" || {
      note "applied migration ${ts} has no retained content evidence"
      return 10
    }
  done <<< "$applied"
}

guard_migration_evidence() {
  local target="$1"
  require_ledger_covers_applied || return 10
  if [[ ! -s "$(applied_blobs_file)" ]]; then
    return 0
  fi
  op_set migration_blobs "$(applied_blobs_file)" || return 10
  applied_migration_content_unchanged "$target"
}

attempted_blobs_file() {
  printf '%s\n' "$(dirname -- "$AISB_OP")/attempted-migration-blobs.txt"
}

write_blob_lines_from_tree() {
  local commit="$1" dest="$2" out tmp line mode typ blob path base ts
  out="$(git_as_owner ls-tree -r "$commit" -- services/api-gateway/src/migrations)" || return 30
  tmp="$(mktemp)" || return 30
  while read -r mode typ blob path; do
    [[ -z "$blob" || -z "$path" ]] && continue
    migration_path_selected "$path" || continue
    base="$(basename -- "$path")"
    ts="${base%%-*}"
    if ! migration_timestamp_ok "$base"; then
      note "malformed executable migration ${path}"
      rm -f -- "$tmp"
      return 30
    fi
    printf 'ts=%s blob=%s path=%s source=%s\n' "$ts" "$blob" "$path" "$commit" >> "$tmp" || {
      rm -f -- "$tmp"
      return 30
    }
  done <<< "$out"
  mkdir -p "$(dirname -- "$dest")" || { rm -f -- "$tmp"; return 30; }
  mv "$tmp" "$dest" || { rm -f -- "$tmp"; return 30; }
}

stage_attempted_blobs() {
  local commit="$1" dest
  dest="$(attempted_blobs_file)"
  write_blob_lines_from_tree "$commit" "$dest" || return 30
  op_set attempted_blobs "$dest" || return 30
}

commit_attempted_blobs() {
  local attempt dest tmp line ts blob old
  attempt="$(attempted_blobs_file)"
  [[ -s "$attempt" ]] || {
    note "attempted migration evidence is absent"
    return 30
  }
  dest="$(applied_blobs_file)"
  mkdir -p "$(dirname -- "$dest")" || return 30
  tmp="$(mktemp)" || return 30
  if [[ -f "$dest" ]]; then
    cp -p "$dest" "$tmp" || { rm -f -- "$tmp"; return 30; }
  fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == ts=* ]] || continue
    ts="${line%% *}"
    ts="${ts#ts=}"
    blob="${line#* blob=}"
    blob="${blob%% *}"
    [[ "$ts" =~ ^[0-9]+$ && -n "$blob" ]] || { rm -f -- "$tmp"; return 30; }
    if [[ -f "$tmp" ]] && grep -E -q "^ts=${ts} " "$tmp"; then
      old="$(ledger_blob_for "$tmp" "$ts")" || { rm -f -- "$tmp"; return 30; }
      if [[ "$old" != "$blob" ]]; then
        note "refusing to replace applied migration ${ts}"
        rm -f -- "$tmp"
        return 10
      fi
    else
      printf '%s\n' "$line" >> "$tmp" || { rm -f -- "$tmp"; return 30; }
    fi
  done < "$attempt"
  mv "$tmp" "$dest" || { rm -f -- "$tmp"; return 30; }
  op_set migration_blobs "$dest" || return 30
}

reconcile_attempted_after_interruption() {
  local applied rc ts ledger attempt ere=0 line blob old tmp promoted
  case $- in *e*) ere=1 ;; esac
  set +e
  applied="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT timestamp FROM migrations ORDER BY timestamp" 2>/dev/null)"
  rc=$?
  if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
  if [[ "$rc" -ne 0 ]]; then
    note "applied migration list is unavailable"
    return 10
  fi
  ledger="$(applied_blobs_file)"
  attempt="$(attempted_blobs_file)"
  if [[ -s "$ledger" ]]; then
    tmp="$(mktemp)" || return 30
    awk '
      $1 ~ /^ts=/ {
        ts=$1
        blob=$2
        if (ts in seen && seen[ts] != blob) {
          print ts > "/dev/stderr"
          exit 2
        }
        seen[ts]=blob
      }
    ' "$ledger" > "$tmp"
    rc=$?
    rm -f -- "$tmp"
    if [[ "$rc" -ne 0 ]]; then
      note "applied migration ledger conflicts"
      return 10
    fi
  fi
  promoted="$(mktemp)" || return 30
  : > "$promoted"
  while IFS= read -r ts || [[ -n "$ts" ]]; do
    [[ -n "$ts" ]] || continue
    if [[ ! "$ts" =~ ^[0-9]+$ ]]; then
      note "applied migration list is malformed"
      rm -f -- "$promoted"
      return 10
    fi
    if [[ -s "$ledger" ]] && grep -E -q "^ts=${ts} " "$ledger"; then
      old="$(ledger_blob_for "$ledger" "$ts")" || {
        rm -f -- "$promoted"
        return 10
      }
      if [[ -s "$attempt" ]] && grep -E -q "^ts=${ts} " "$attempt"; then
        blob="$(ledger_blob_for "$attempt" "$ts")" || {
          rm -f -- "$promoted"
          return 10
        }
        if [[ "$blob" != "$old" ]]; then
          note "attempted migration ${ts} conflicts with the applied ledger"
          rm -f -- "$promoted"
          return 10
        fi
      fi
      continue
    fi
    if [[ ! -s "$attempt" ]] || ! grep -E -q "^ts=${ts} " "$attempt"; then
      note "applied migration ${ts} has no attempted content evidence"
      rm -f -- "$promoted"
      return 10
    fi
    line="$(grep -E "^ts=${ts} " "$attempt" | tail -n 1)"
    blob="${line#* blob=}"
    blob="${blob%% *}"
    [[ -n "$blob" ]] || {
      note "attempted migration ${ts} has no content identity"
      rm -f -- "$promoted"
      return 10
    }
    if [[ "$(grep -E -c "^ts=${ts} " "$attempt" || true)" -gt 1 ]]; then
      earlier="$(grep -E "^ts=${ts} " "$attempt" | head -n 1)"
      earlier="${earlier#* blob=}"
      earlier="${earlier%% *}"
      if [[ "$earlier" != "$blob" ]]; then
        note "attempted migration ${ts} conflicts with itself"
        rm -f -- "$promoted"
        return 10
      fi
    fi
    if grep -E -q "^ts=${ts} " "$promoted"; then
      continue
    fi
    printf '%s\n' "$line" >> "$promoted" || {
      rm -f -- "$promoted"
      return 30
    }
  done <<< "$applied"
  if [[ ! -s "$promoted" ]]; then
    rm -f -- "$promoted"
    return 0
  fi
  tmp="$(mktemp)" || { rm -f -- "$promoted"; return 30; }
  if [[ -s "$ledger" ]]; then
    cp -p "$ledger" "$tmp" || { rm -f -- "$promoted" "$tmp"; return 30; }
  else
    : > "$tmp"
  fi
  cat "$promoted" >> "$tmp" || { rm -f -- "$promoted" "$tmp"; return 30; }
  rm -f -- "$promoted"
  if [[ -n "$ledger" ]]; then
    mkdir -p "$(dirname -- "$ledger")" || { rm -f -- "$tmp"; return 30; }
  fi
  mv "$tmp" "$ledger" || { rm -f -- "$tmp"; return 30; }
  op_set migration_blobs "$ledger" || return 30
}

install_restored_migration_ledger() {
  local work="$1" src dest
  src="$work/applied-migration-blobs.txt"
  [[ -s "$src" ]] || {
    note "backup has no applied migration ledger"
    return 40
  }
  dest="$(applied_blobs_file)"
  mkdir -p "$(dirname -- "$dest")" || return 40
  cp -p "$src" "$dest" || return 40
  cmp -s "$src" "$dest" || return 40
  op_set migration_blobs "$dest" || return 40
  if [[ -s "$work/attempted-migration-blobs.txt" ]]; then
    dest="$(attempted_blobs_file)"
    cp -p "$work/attempted-migration-blobs.txt" "$dest" || return 40
    cmp -s "$work/attempted-migration-blobs.txt" "$dest" || return 40
    op_set attempted_blobs "$dest" || return 40
  fi
}

restore_applied_blob_key() {
  local dest
  dest="$(applied_blobs_file)"
  [[ -s "$dest" ]] || return 0
  op_set migration_blobs "$dest"
}

capture_attempt_blobs() {
  local ledger
  ledger="$(applied_blobs_file)"
  [[ -s "$ledger" ]] || return 0
  op_set migration_blobs "$ledger"
}

applied_migration_content_unchanged() {
  local target="$1" blobs line mode typ blob path base ts target_path one target_blob
  blobs="$(op_field migration_blobs)"
  [[ -n "$blobs" && -f "$blobs" ]] || blobs="$(applied_blobs_file)"
  [[ -s "$blobs" ]] || {
    note "applied migration blobs are absent"
    return 10
  }
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    if [[ "$line" == ts=* ]]; then
      ts="${line%% *}"
      ts="${ts#ts=}"
      blob="${line#* blob=}"
      blob="${blob%% *}"
      path="${line#* path=}"
      path="${path%% *}"
    elif [[ "$line" == source=* ]]; then
      continue
    else
      read -r mode typ blob path <<< "$line"
      [[ -n "$blob" && -n "$path" ]] || continue
      base="$(basename -- "$path")"
      ts="${base%%-*}"
    fi
    [[ "$ts" =~ ^[0-9]+$ && -n "$blob" ]] || continue
    target_path="$(git_as_owner ls-tree -r --name-only "$target" -- services/api-gateway/src/migrations)" || return 10
    one=""
    while IFS= read -r path; do
      [[ -n "$path" ]] || continue
      migration_path_selected "$path" || continue
      base="$(basename -- "$path")"
      if ! migration_timestamp_ok "$base"; then
        note "malformed executable migration ${path}"
        return 10
      fi
      if [[ "$base" == "${ts}-"* ]]; then
        [[ -z "$one" ]] || return 10
        one="$path"
      fi
    done <<< "$target_path"
    [[ -n "$one" ]] || continue
    target_blob="$(git_as_owner rev-parse "${target}:${one}")" || return 10
    if [[ "$target_blob" != "$blob" ]]; then
      note "applied migration content changed: ${one}"
      return 10
    fi
  done < "$blobs"
}

op_begin() {
  local op="$1" id dir cursor
  id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
  dir="$(dirname -- "$AISB_OP")"
  mkdir -p "$dir/history" || return 10
  if [[ -f "$AISB_OP" ]]; then
    cp -p "$AISB_OP" "$dir/history/${id}.previous" || return 10
  fi
  cat > "$AISB_OP" <<EOF
op_id=${id}
owner_op=${op}
owner_pid=$$
writer_started=0
failure_class=none
journal_cursor=
start_cursor=
record_dir=
pre_sha=
pre_migrations=
target_sha=
empty_target=
prior_owner_pid=
prior_owner_op=
EOF
  cursor="$(journalctl -n 0 -o cat --show-cursor 2>/dev/null | sed -n 's/^-- cursor: //p' | tail -n 1 || true)"
  if [[ -z "$cursor" ]]; then
    op_set journal_cursor unavailable
  else
    op_set journal_cursor "$cursor"
  fi
}

marker_handoff() {
  local new_owner="$1" pid op
  [[ -f "$AISB_MARKER" ]] || return 10
  pid="$(marker_field owner_pid)"
  op="$(marker_field owner_op)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    note "marker owner ${pid} is still alive"
    return 10
  fi
  op_set prior_owner_pid "$pid"
  op_set prior_owner_op "$op"
  kv_set "$AISB_MARKER" prior_owner_pid "$pid"
  kv_set "$AISB_MARKER" prior_owner_op "$op"
  kv_set "$AISB_MARKER" owner_pid "$$"
  kv_set "$AISB_MARKER" owner_op "$new_owner"
  op_set owner_pid "$$"
  op_set owner_op "$new_owner"
}

backup_stage_fault() {
  local point="$1" f want
  hook_enabled || return 0
  f="${AISB_ETC}/ops-test-mode"
  want="$(awk -F= '/^FAULT=/{print substr($0,7)}' "$f")"
  [[ "$want" == "$point" ]] || return 0
  note "backup stage fault ${point}"
  return 20
}

run_bounded() {
  command -v timeout >/dev/null 2>&1 || return 97
  timeout 10 "$@"
}

kv_get() {
  local file="$1" key="$2" line
  [[ -f "$file" ]] || return 0
  line=$(grep -E "^${key}=" "$file" | tail -n 1 || true)
  printf '%s' "${line#${key}=}"
}

kv_set() {
  local file="$1" key="$2" value="$3" dir tmp got
  [[ -n "$file" && -n "$key" ]] || return 30
  dir=$(dirname -- "$file") || return 30
  mkdir -p "$dir" || return 30
  tmp=$(mktemp "${dir}/.kv.XXXXXX") || return 30
  if [[ -f "$file" ]]; then
    local ere=0 filter_rc
    case $- in *e*) ere=1 ;; esac
    set +e
    grep -v -E "^${key}=" "$file" > "$tmp"
    filter_rc=$?
    if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
    if [[ "$filter_rc" -gt 1 ]]; then
      rm -f -- "$tmp"
      return 30
    fi
  fi
  printf '%s=%s\n' "$key" "$value" >> "$tmp" || { rm -f -- "$tmp"; return 30; }
  mv "$tmp" "$file" || { rm -f -- "$tmp"; return 30; }
  got="$(kv_get "$file" "$key")" || return 30
  [[ "$got" == "$value" ]] || return 30
}

marker_field() {
  kv_get "$AISB_MARKER" "$1"
}

op_field() {
  kv_get "$AISB_OP" "$1"
}

op_set() {
  kv_set "$AISB_OP" "$1" "$2"
}

marker_set_phase() {
  local phase="$1"
  phase_is_known "$phase" || return 10
  kv_set "$AISB_MARKER" phase "$phase"
  op_set phase "$phase"
}

marker_create() {
  local owner="$1" phase="$2" reason="$3"
  phase_is_known "$phase" || return 10
  mkdir -p "$(dirname -- "$AISB_MARKER")"
  cat > "$AISB_MARKER" <<EOF
owner_op=${owner}
owner_pid=$$
started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
phase=${phase}
pre_active_units=${4:-}
pre_sha=${5:-}
pre_migrations=${6:-}
target_sha=${7:-}
reason=${reason}
EOF
  op_set owner_op "$owner"
  op_set owner_pid "$$"
  op_set phase "$phase"
  op_set failure_class none
  op_set writer_started 0
}

marker_remove() {
  if [[ -f "$AISB_MARKER" ]]; then
    local pid
    pid=$(marker_field owner_pid)
    if [[ -n "$pid" && "$pid" != "$$" && "${AISB_ADOPTED:-0}" != "1" ]]; then
      note "refusing to remove a marker owned by pid ${pid}"
      return 10
    fi
  fi
  rm -f -- "$AISB_MARKER"
}

mark_post_start() {
  op_set writer_started 1
  op_set failure_class post-start
  local cursor
  cursor=$(journalctl -n 0 -o cat --show-cursor 2>/dev/null | sed -n 's/^-- cursor: //p' | tail -n 1 || true)
  op_set start_cursor "$cursor"
}

env_file_value() {
  local file="$1" key="$2" line
  line=$(grep -E "^${key}=" "$file" | tail -n 1 || true)
  printf '%s' "${line#${key}=}"
}

redis_password() {
  local url="$1" rest auth
  rest=${url#redis://}
  rest=${rest#rediss://}
  if [[ "$rest" == *"@"* ]]; then
    auth=${rest%%@*}
    auth=${auth#*:}
    printf '%s' "$auth"
  fi
}

require_node24() {
  local v
  v=$(node -v)
  case "$v" in
    v24.*)
      printf '%s\n' "$v"
      ;;
    *)
      note "locked runtime is Node 24; found ${v}"
      return 30
      ;;
  esac
}

migration_hash() {
  local out rc err
  err="$(mktemp)"
  set +e
  out="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT timestamp || ' ' || name FROM migrations ORDER BY timestamp, name" 2>"$err")"
  rc=$?
  set -e
  if [[ "$rc" -ne 0 ]]; then
    if grep -q 'does not exist' "$err"; then
      rm -f -- "$err"
      printf 'absent'
      return 0
    fi
    rm -f -- "$err"
    printf 'unavailable'
    return 2
  fi
  rm -f -- "$err"
  printf '%s' "$out" | sha256sum | awk '{print $1}'
}

store_migration_hash() {
  local mig
  if ! mig="$(migration_hash)"; then
    note "schema evidence is unavailable"
    return 12
  fi
  if [[ "$mig" == "unavailable" ]]; then
    note "schema evidence is unavailable"
    return 12
  fi
  op_set pre_migrations "$mig" || return 12
}

assert_tree_and_schema_unchanged() {
  local head pre hash prehash
  head="$(git_as_owner rev-parse HEAD)" || return 30
  pre="$(op_field pre_sha)"
  if ! hash="$(migration_hash)"; then
    note "schema evidence is unavailable"
    return 30
  fi
  if [[ "$hash" == "unavailable" ]]; then
    note "schema evidence is unavailable"
    return 30
  fi
  prehash="$(op_field pre_migrations)"
  if [[ "$head" != "$pre" || "$hash" != "$prehash" ]]; then
    note "tree or schema differs from the pre-operation record"
    return 30
  fi
}

writers_inactive() {
  local u
  for u in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
    if systemctl is-active --quiet "$u"; then
      return 1
    fi
  done
  return 0
}

sessions_inactive() {
  local ids
  if ! ids=$(docker ps -q --filter 'name=^/sandbox-session-'); then
    return 1
  fi
  [[ -z "${ids//[[:space:]]/}" ]]
}

persistent_present() {
  local rel out="$1"
  : > "$out"
  for rel in workspaces database projects services/snapshot-store snapshot-store; do
    if [[ -e "$AISB_ROOT/$rel" ]]; then
      printf '%s\n' "$rel" >> "$out"
    fi
  done
}

count_sockets() {
  local rel n=0 hit
  for rel in workspaces database projects services/snapshot-store snapshot-store; do
    [[ -e "$AISB_ROOT/$rel" ]] || continue
    hit=$(find "$AISB_ROOT/$rel" -type s | wc -l)
    n=$((n + hit))
  done
  printf '%s\n' "$n"
}

backup_tar() {
  local dest="$1" list rc
  list="$(mktemp)" || return 20
  (
    cd "$AISB_ROOT" || exit 20
    : > "$list" || exit 20
    : > "$dest/sockets.paths" || exit 20
    for rel in workspaces database projects services/snapshot-store snapshot-store; do
      [[ -e "$rel" ]] || continue
      find "$rel" ! -type s -print >> "$list" || exit 20
      find "$rel" -type s -print >> "$dest/sockets.paths" || exit 20
    done
    sort -o "$dest/sockets.paths" "$dest/sockets.paths" || exit 20
    tar --create --no-recursion --format=posix --numeric-owner --acls --xattrs --xattrs-include='*' -f "$dest/files.tar" --files-from "$list" || exit 20
  )
  rc=$?
  rm -f -- "$list"
  return "$rc"
}

sort_attribute_records() {
  local dir index keyfile key path
  dir="$(mktemp -d)" || return 20
  index="$dir/index"
  : > "$index"
  awk -v dir="$dir" '
    function flush() {
      if (rec == "") return
      n++
      fn = sprintf("%s/rec.%05d", dir, n)
      printf "%s", rec > fn
      close(fn)
      rec = ""
    }
    BEGIN { n = 0; rec = "" }
    /^$/ { flush(); next }
    { rec = rec $0 "\n" }
    END { flush() }
  ' || { rm -rf -- "$dir"; return 20; }
  : > "$index"
  for keyfile in "$dir"/rec.*; do
    [[ -f "$keyfile" ]] || continue
    key="$(grep -m1 '^# file:' "$keyfile" || printf '%s\n' '~')"
    printf '%s\t%s\n' "$key" "$keyfile" >> "$index"
  done
  if [[ ! -s "$index" ]]; then
    rm -rf -- "$dir"
    return 0
  fi
  sort -t "$(printf '\t')" -k1,1 "$index" | while IFS="$(printf '\t')" read -r key path; do
    cat "$path" || exit 20
    printf '\n'
  done || { rm -rf -- "$dir"; return 20; }
  rm -rf -- "$dir"
}

backup_owners() {
  local dest="$1" rc
  (
    cd "$AISB_ROOT" || exit 20
    set -o pipefail
    paths=()
    for rel in workspaces database projects services/snapshot-store snapshot-store; do
      [[ -e "$rel" ]] && paths+=("$rel")
    done
    if [[ ${#paths[@]} -eq 0 ]]; then
      : > "$dest/owners.tsv"
      exit 0
    fi
    find "${paths[@]}" ! -type s -printf '%U\t%G\t%#m\t%y\t%p\n' | sort > "$dest/owners.tsv" || exit 20
  )
  rc=$?
  return "$rc"
}

backup_acls() {
  local dest="$1" rc
  (
    cd "$AISB_ROOT" || exit 20
    set -o pipefail
    paths=()
    for rel in workspaces database projects services/snapshot-store snapshot-store; do
      [[ -e "$rel" ]] && paths+=("$rel")
    done
    if [[ ${#paths[@]} -eq 0 ]]; then
      : > "$dest/acls.txt"
      exit 0
    fi
    getfacl -R -P -n --skip-base "${paths[@]}" | sort_attribute_records > "$dest/acls.txt" || exit 20
  )
  rc=$?
  return "$rc"
}

backup_xattrs() {
  local dest="$1" rc
  (
    cd "$AISB_ROOT" || exit 20
    set -o pipefail
    paths=()
    for rel in workspaces database projects services/snapshot-store snapshot-store; do
      [[ -e "$rel" ]] && paths+=("$rel")
    done
    if [[ ${#paths[@]} -eq 0 ]]; then
      : > "$dest/xattrs.txt"
      exit 0
    fi
    getfattr -R -h -d -m - -e hex "${paths[@]}" | sort_attribute_records > "$dest/xattrs.txt" || exit 20
  )
  rc=$?
  return "$rc"
}

backup_git_status() {
  local dest="$1" raw
  raw="$(mktemp)" || return 20
  if ! git_as_owner status --porcelain=v1 --ignored=matching --untracked-files=all -- workspaces database projects > "$raw"; then
    rm -f -- "$raw"
    return 20
  fi
  if [[ -s "$dest/sockets.paths" ]]; then
    awk 'NR==FNR { sock[$0]=1; next } { path=$0; sub(/^.. /,"",path); if (!(path in sock)) print }' "$dest/sockets.paths" "$raw" > "$dest/git-status-persistent.txt" || {
      rm -f -- "$raw"
      return 20
    }
  else
    cp "$raw" "$dest/git-status-persistent.txt" || { rm -f -- "$raw"; return 20; }
  fi
  rm -f -- "$raw"
}

backup_postgres() {
  local dest="$1"
  runuser -u postgres -- pg_dump -Fc --create aisandbox > "$dest/db.dump" || return 20
  runuser -u postgres -- pg_dumpall --roles-only --no-role-passwords > "$dest/roles.sql" || return 20
  pg_restore -l "$dest/db.dump" > "$dest/db.toc" || return 20
}

backup_sqlite() {
  local db="$AISB_ROOT/database/aisandbox.db" chk
  if [[ ! -f "$db" ]]; then
    printf 'absent\n' > "$1/sqlite-integrity.txt" || return 20
    return 0
  fi
  chk="$(sqlite3 "$db" 'PRAGMA integrity_check')" || return 20
  printf '%s\n' "$chk" > "$1/sqlite-integrity.txt" || return 20
  [[ "$chk" == "ok" ]] || return 20
}

backup_env_names() {
  local dest="$1" f base
  : > "$dest/env-names.txt" || return 20
  : > "$dest/env-sha256.txt" || return 20
  for f in "$AISB_ETC"/*.env; do
    [[ -e "$f" ]] || continue
    [[ -f "$f" ]] || return 20
    base="$(basename -- "$f")"
    sed -n 's/^\([A-Z0-9_]*\)=.*/\1/p' "$f" | sed "s/^/${base} /" >> "$dest/env-names.txt" || return 20
    sha256sum "$f" >> "$dest/env-sha256.txt" || return 20
  done
  sort -o "$dest/env-names.txt" "$dest/env-names.txt" || return 20
}

backup_row_counts() {
  local dest="$1"
  runuser -u postgres -- psql -d aisandbox -Atc "SELECT 'users', count(*) FROM users UNION ALL SELECT 'projects', count(*) FROM projects UNION ALL SELECT 'sessions', count(*) FROM sessions UNION ALL SELECT 'git_checkpoints', count(*) FROM git_checkpoints UNION ALL SELECT 'credit_balances', count(*) FROM credit_balances UNION ALL SELECT 'credit_deduction_records', count(*) FROM credit_deduction_records UNION ALL SELECT 'usage_records', count(*) FROM usage_records ORDER BY 1" > "$dest/row-counts.txt" || return 20
}

backup_manifest() {
  local dest="$1" sockets uid gid docker_gid node sha kind digest
  sockets="$(wc -l < "$dest/sockets.paths" | tr -d ' ')" || return 20
  uid="$(id -u aisandbox)" || return 20
  gid="$(id -g aisandbox)" || return 20
  docker_gid="$(getent group docker | awk -F: '{print $3}')"
  [[ -n "$docker_gid" ]] || docker_gid=absent
  node="$(node -v)" || return 20
  sha="$(git_as_owner rev-parse HEAD)" || return 20
  kind="${AISB_BACKUP_KIND:-nightly}"
  if ! digest="$(docker image inspect "$AISB_IMAGE" --format '{{.Id}}' 2>/dev/null)"; then
    digest=unavailable
  fi
  [[ -n "$digest" ]] || digest=unavailable
  printf '%s\n' "$digest" > "$dest/image-digest.txt" || return 20
  cat > "$dest/MANIFEST" <<EOF
sha=${sha}
time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
aisandbox_uid=${uid}
aisandbox_gid=${gid}
docker_gid=${docker_gid}
sockets_skipped=${sockets}
node=${node}
sandbox_image=${AISB_IMAGE}
sandbox_image_digest=${digest}
kind=${kind}
EOF
}

backup_copy_recovery_files() {
  local dest="$1" unit
  mkdir -p "$dest/config/units" || return 20
  if [[ -f "$AISB_DEPLOYED" ]]; then
    cp -p "$AISB_DEPLOYED" "$dest/deployed-copy" || return 20
  else
    printf 'absent\n' > "$dest/deployed-copy" || return 20
  fi
  runuser -u postgres -- psql -d aisandbox -Atc "SELECT timestamp || ' ' || name FROM migrations ORDER BY timestamp, name" > "$dest/migrations.txt" || return 20
  local record src
  record="$(op_field record_dir)"
  if [[ -n "$record" && -f "$record/quiescence.json" ]]; then
    copy_file_if_distinct "$record/quiescence.json" "$dest/quiescence.json" || return 20
  elif [[ -f "$dest/quiescence.json" ]]; then
    :
  else
    note "quiescence.json is missing from the operation record"
    return 20
  fi
  [[ -f "$AISB_PG_HBA" ]] || return 20
  [[ -f "$AISB_REDIS_CONF" ]] || return 20
  [[ -f "$AISB_CADDYFILE" ]] || return 20
  cp -p "$AISB_PG_HBA" "$dest/config/pg_hba.conf" || return 20
  cp -p "$AISB_REDIS_CONF" "$dest/config/redis.conf" || return 20
  cp -p "$AISB_CADDYFILE" "$dest/config/Caddyfile" || return 20
  for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend aisandbox-migrate aisandbox-backup; do
    [[ -f "$AISB_UNIT_DIR/${unit}.service" ]] || return 20
    cp -p "$AISB_UNIT_DIR/${unit}.service" "$dest/config/units/${unit}.service" || return 20
  done
  [[ -f "$AISB_UNIT_DIR/aisandbox-backup.timer" ]] || return 20
  cp -p "$AISB_UNIT_DIR/aisandbox-backup.timer" "$dest/config/units/aisandbox-backup.timer" || return 20
  if [[ -f "$AISB_DEPLOYED" ]]; then
    [[ -s "$(applied_blobs_file)" ]] || {
      note "applied migration ledger is absent"
      return 20
    }
    cp -p "$(applied_blobs_file)" "$dest/applied-migration-blobs.txt" || return 20
    if [[ -s "$(attempted_blobs_file)" ]]; then
      cp -p "$(attempted_blobs_file)" "$dest/attempted-migration-blobs.txt" || return 20
    fi
  fi
}

backup_checksums() {
  local dest="$1"
  (
    cd "$dest" || exit 20
    find . -type f ! -name SHA256SUMS ! -name COMPLETE ! -name members.list -printf '%P\n' | sort > members.list || exit 20
    : > SHA256SUMS
    while IFS= read -r member; do
      [[ -n "$member" ]] || continue
      sha256sum -- "$member" >> SHA256SUMS || exit 20
    done < members.list
    sha256sum -c SHA256SUMS || exit 20
  )
}

backup_age() {
  local dest="$1" ts recipient bundle sum
  ts="${AISB_BACKUP_TS:-$(basename -- "$dest")}"
  [[ -f "$AISB_ETC/age-recipient.txt" ]] || return 20
  recipient="$(tr -d '[:space:]' < "$AISB_ETC/age-recipient.txt")"
  [[ -n "$recipient" ]] || return 20
  mkdir -p "$AISB_OFFHOST" || return 20
  bundle="$AISB_OFFHOST/${ts}.tar.age.partial"
  {
    cat "$dest/members.list"
    printf '%s\n' SHA256SUMS
  } > "$dest/bundle.list" || return 20
  (
    set -o pipefail
    cd "$dest" || exit 20
    tar --create --no-recursion --files-from bundle.list -f - | age -r "$recipient" > "$bundle"
  ) || return 20
  sum="$(sha256sum "$bundle" | awk '{print $1}')" || return 20
  local sha uid gid
  sha="$(git_as_owner rev-parse HEAD)" || return 20
  uid="$(id -u aisandbox)" || return 20
  gid="$(id -g aisandbox)" || return 20
  {
    printf 'sha=%s\n' "$sha"
    printf 'aisandbox_uid=%s\n' "$uid"
    printf 'aisandbox_gid=%s\n' "$gid"
    printf 'bundle_sha256=%s\n' "$sum"
  } > "$AISB_OFFHOST/${ts}.identity" || return 20
  mv "$bundle" "$AISB_OFFHOST/${ts}.tar.age" || return 20
}

backup_write_set() {
  local dest="$1"
  ops_paths
  [[ -n "$dest" ]] || return 20
  [[ -f "$AISB_MARKER" ]] || return 20
  [[ "$(marker_field owner_pid)" == "$$" ]] || return 20
  writers_inactive || return 20
  sessions_inactive || return 20
  mkdir -p "$dest" || return 20
  chmod 0700 "$dest" || return 20
  backup_stage_fault backup-tar || return 20
  backup_tar "$dest" || return 20
  backup_stage_fault backup-metadata || return 20
  backup_owners "$dest" || return 20
  backup_acls "$dest" || return 20
  backup_xattrs "$dest" || return 20
  backup_git_status "$dest" || return 20
  backup_stage_fault backup-postgres || return 20
  backup_postgres "$dest" || return 20
  backup_stage_fault backup-sqlite || return 20
  backup_sqlite "$dest" || return 20
  backup_env_names "$dest" || return 20
  backup_row_counts "$dest" || return 20
  backup_copy_recovery_files "$dest" || return 20
  backup_manifest "$dest" || return 20
  backup_stage_fault backup-checksum || return 20
  backup_checksums "$dest" || return 20
  backup_stage_fault backup-encrypt || return 20
  backup_age "$dest" || return 20
  printf 'COMPLETE\n' > "$dest/COMPLETE" || return 20
}

persistent_git_clean() {
  local rel="$1" out first
  out="$(git_as_owner status --porcelain=v1 --ignored=matching --untracked-files=all -- "$rel")" || return 1
  if [[ -n "$out" ]]; then
    first=$(printf '%s\n' "$out" | head -n 1)
    note "empty-target failed path=${rel} entry=${first}"
    return 1
  fi
}

snapshot_path_empty() {
  local rel="$1" hit
  if [[ ! -e "$AISB_ROOT/$rel" ]]; then
    return 0
  fi
  if [[ ! -d "$AISB_ROOT/$rel" ]]; then
    note "empty-target failed path=${rel} entry=${rel}"
    return 1
  fi
  hit=$(find "$AISB_ROOT/$rel" -mindepth 1 -print -quit)
  if [[ -n "$hit" ]]; then
    note "empty-target failed path=${rel} entry=${hit}"
    return 1
  fi
}

database_sidecars_absent() {
  local s
  for s in database/aisandbox.db database/aisandbox.db-journal database/aisandbox.db-wal database/aisandbox.db-shm; do
    if [[ -e "$AISB_ROOT/$s" ]]; then
      note "empty-target failed path=${s} entry=${s}"
      return 1
    fi
  done
}

role_absent() {
  local row
  if ! command -v psql >/dev/null 2>&1; then
    if [[ "${AISB_OBSERVE_STRICT:-0}" == "1" ]]; then
      note "empty-target failed path=role entry=psql-missing"
      return 1
    fi
    return 0
  fi
  row="$(runuser -u postgres -- psql -d postgres -Atc "SELECT rolname FROM pg_roles WHERE rolname='aisandbox'")" || return 1
  if [[ -n "$row" ]]; then
    note "empty-target failed path=role entry=aisandbox"
    return 1
  fi
}

database_absent() {
  local row
  if ! command -v psql >/dev/null 2>&1; then
    if [[ "${AISB_OBSERVE_STRICT:-0}" == "1" ]]; then
      note "empty-target failed path=database entry=psql-missing"
      return 1
    fi
    return 0
  fi
  row="$(runuser -u postgres -- psql -d postgres -Atc "SELECT datname FROM pg_database WHERE datname='aisandbox'")" || return 1
  if [[ -n "$row" ]]; then
    note "empty-target failed path=database entry=aisandbox"
    return 1
  fi
}

redis_is_empty() {
  local url pass n
  if ! command -v redis-cli >/dev/null 2>&1 || ! command -v timeout >/dev/null 2>&1; then
    if [[ "${AISB_OBSERVE_STRICT:-0}" == "1" ]]; then
      note "empty-target failed path=redis entry=tool-missing"
      return 1
    fi
    return 0
  fi
  if [[ -f "$AISB_ETC/gateway.env" ]]; then
    url="$(env_file_value "$AISB_ETC/gateway.env" REDIS_URL)"
    pass="$(redis_password "$url")"
    REDISCLI_AUTH="$pass"
    export REDISCLI_AUTH
    if ! n="$(timeout 10 redis-cli -h 127.0.0.1 --no-auth-warning DBSIZE)"; then
      unset REDISCLI_AUTH
      note "empty-target failed path=redis entry=query"
      return 1
    fi
    unset REDISCLI_AUTH
  elif ! n="$(timeout 10 redis-cli -h 127.0.0.1 --no-auth-warning DBSIZE)"; then
    note "empty-target failed path=redis entry=query"
    return 1
  fi
  if [[ "$n" != "0" ]]; then
    note "empty-target failed path=redis entry=DBSIZE"
    return 1
  fi
}

writers_not_enabled_or_active() {
  local u state enabled
  for u in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
    if systemctl is-active --quiet "$u"; then
      note "empty-target failed path=unit entry=${u}"
      return 1
    fi
    state=$(systemctl is-enabled "$u" 2>/dev/null || true)
    if [[ "$state" == "enabled" ]]; then
      note "empty-target failed path=unit entry=${u}"
      return 1
    fi
  done
}

target_is_empty() {
  if [[ -d "$AISB_ROOT/.git" ]]; then
    persistent_git_clean workspaces || return 10
    persistent_git_clean database || return 10
    persistent_git_clean projects || return 10
  else
    snapshot_path_empty workspaces || return 10
    snapshot_path_empty database || return 10
    snapshot_path_empty projects || return 10
  fi
  database_sidecars_absent || return 10
  snapshot_path_empty services/snapshot-store || return 10
  snapshot_path_empty snapshot-store || return 10
  database_absent || return 10
  role_absent || return 10
  redis_is_empty || return 10
  writers_not_enabled_or_active || return 10
  if [[ -f "$AISB_DEPLOYED" ]]; then
    note "empty-target failed path=DEPLOYED entry=DEPLOYED"
    return 10
  fi
  op_set empty_target pass
}

journal_has_writer_start() {
  local cursor out
  cursor=$(op_field journal_cursor)
  [[ -n "$cursor" ]] || return 2
  if ! out=$(journalctl -u aisandbox-gateway -u aisandbox-ai -u aisandbox-cm -u aisandbox-frontend --after-cursor "$cursor" -o cat --no-pager 2>/dev/null); then
    return 2
  fi
  if printf '%s\n' "$out" | grep -E -q 'Starting |Started |Failed to start'; then
    return 0
  fi
  return 1
}

classify_failure() {
  local marker=0 js flag
  [[ -f "$AISB_MARKER" ]] && marker=1
  journal_has_writer_start
  js=$?
  flag="$(op_field writer_started)"
  if [[ "$js" -eq 2 ]]; then
    if [[ "$marker" -eq 0 ]]; then
      printf 'post-start'
      return 0
    fi
    printf 'unknown'
    return 0
  fi
  if [[ "$js" -eq 0 || "$marker" -eq 0 ]]; then
    printf 'post-start'
    return 0
  fi
  if [[ "$flag" == "1" ]]; then
    printf 'unknown'
    return 0
  fi
  printf 'pre-start'
}

pre_start_summary() {
  printf '%s\n' 'failure_class=pre-start'
  printf '%s\n' 'The marker is present and no writer start is in the journal for this operation.'
}

post_start_recovery_text() {
  cat <<'EOF'
failure_class=post-start
A writer start is in scope for this operation, or the maintenance marker is already gone.
This record does not say that the writers never started.
With the marker absent, enabled writer units can start at boot. That boot start is expected.
Do not restore onto this host. Do not overwrite the primary.
Do not invent DEPLOYED from status output.
Read health, and compare HEAD with the recorded target_sha and the applied migrations with that target.
If health passes and HEAD equals the recorded target_sha and the applied migrations match that target, leave that observation in the operation record.
The later authorized recovery is a normal aisandbox-deploy of that target_sha. It keeps every existing deploy guard.
Do not use aisandbox-deploy --from-maintenance when the marker is absent.
If health fails, or the tree or schema evidence differs or is unavailable, keep this host as evidence.
Use a separately authorized fresh recovery target at the recorded pre_sha and restore the pre-migration bundle there.
EOF
}

q3_recover() {
  local code="$1"
  assert_tree_and_schema_unchanged
  marker_remove
  mark_post_start
  systemctl start aisandbox-gateway
  systemctl start aisandbox-frontend
  exit "$code"
}

start_units_after_marker_removed() {
  marker_remove
  mark_post_start
  if hook_enabled && grep -qx 'FAULT=marker-removed' "$AISB_ETC/ops-test-mode"; then
    note "interrupted after the marker was removed and before writer start"
    exit 30
  fi
  local unit
  for unit in "$@"; do
    systemctl start "$unit"
  done
}

start_migrate() {
  if [[ ! -f "$AISB_MARKER" ]]; then
    note "migrations run only while the maintenance marker exists"
    return 10
  fi
  systemctl start aisandbox-migrate
}

stop_session_containers() {
  local id
  while read -r id; do
    [[ -n "$id" ]] || continue
    docker stop -t 10 "$id"
  done < <(docker ps -q --filter 'name=^/sandbox-session-')
  sessions_inactive
}

quiesce_sample() {
  local phase="$1" result=ZERO dest q1 q2 q3 q4 q5 q6 l1 l2 l3 ledger pass n count
  dest="${2:-$(op_field record_dir)}"
  [[ -n "$dest" ]] || dest="${AISB_OP}.d"
  mkdir -p "$dest" || return 12
  if hook_enabled && grep -qx 'FAULT=quiesce-unknown' "$AISB_ETC/ops-test-mode"; then
    printf '{"time":"%s","phase":"%s","result":"UNKNOWN","queue":["na","na","na","na","na","na"],"ledger":["na","na","na"]}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$phase" >> "$dest/quiescence.json"
    printf 'UNKNOWN'
    return 0
  fi
  q1=na; q2=na; q3=na; q4=na; q5=na; q6=na; l1=na; l2=na; l3=na
  if [[ ! -f "$AISB_ETC/gateway.env" ]]; then
    result=UNKNOWN
  else
    pass="$(redis_password "$(env_file_value "$AISB_ETC/gateway.env" REDIS_URL)")"
    REDISCLI_AUTH="$pass"
    export REDISCLI_AUTH
    q1="$(run_bounded redis-cli -h 127.0.0.1 --no-auth-warning LLEN bull:ai-execution:wait)" || result=UNKNOWN
    q2="$(run_bounded redis-cli -h 127.0.0.1 --no-auth-warning LLEN bull:ai-execution:paused)" || result=UNKNOWN
    q3="$(run_bounded redis-cli -h 127.0.0.1 --no-auth-warning LLEN bull:ai-execution:active)" || result=UNKNOWN
    q4="$(run_bounded redis-cli -h 127.0.0.1 --no-auth-warning ZCARD bull:ai-execution:delayed)" || result=UNKNOWN
    q5="$(run_bounded redis-cli -h 127.0.0.1 --no-auth-warning ZCARD bull:ai-execution:prioritized)" || result=UNKNOWN
    q6="$(run_bounded redis-cli -h 127.0.0.1 --no-auth-warning ZCARD bull:ai-execution:waiting-children)" || result=UNKNOWN
    unset REDISCLI_AUTH
  fi
  if [[ "$result" != UNKNOWN ]]; then
    if ! ledger="$(run_bounded runuser -u postgres -- psql -d aisandbox -At -F '|' -c "SELECT (SELECT count(*) FROM usage_records WHERE execution_status IN ('pending','running','cancel_requested')), (SELECT count(*) FROM collaboration_runs WHERE status='active'), (SELECT count(*) FROM collaboration_referrals WHERE status IN ('pending_approval','approved','in_progress'))")"; then
      result=UNKNOWN
    fi
  fi
  if [[ "$result" != UNKNOWN ]]; then
    IFS='|' read -r l1 l2 l3 <<< "$ledger"
    count=0
    for n in "$q1" "$q2" "$q3" "$q4" "$q5" "$q6" "$l1" "$l2" "$l3"; do
      count=$((count + 1))
      if [[ ! "$n" =~ ^[0-9]+$ ]]; then
        result=UNKNOWN
        break
      fi
      if [[ "$n" -gt 0 ]]; then
        result=ACTIVE
      fi
    done
    if [[ "$count" -ne 9 ]]; then
      result=UNKNOWN
    fi
  fi
  if [[ "$result" == UNKNOWN ]]; then
    q1=na; q2=na; q3=na; q4=na; q5=na; q6=na; l1=na; l2=na; l3=na
  fi
  printf '{"time":"%s","phase":"%s","result":"%s","queue":["%s","%s","%s","%s","%s","%s"],"ledger":["%s","%s","%s"]}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$phase" "$result" \
    "$q1" "$q2" "$q3" "$q4" "$q5" "$q6" "$l1" "$l2" "$l3" >> "$dest/quiescence.json"
  printf '%s' "$result"
}

append_ids_only() {
  run_bounded runuser -u postgres -- psql -d aisandbox -Atc "SELECT id FROM usage_records WHERE execution_status IN ('pending','running','cancel_requested') UNION ALL SELECT id FROM collaboration_runs WHERE status='active' UNION ALL SELECT id FROM collaboration_referrals WHERE status IN ('pending_approval','approved','in_progress')" || true
}

execution_disabled() {
  [[ "$(env_file_value "$AISB_ETC/gateway.env" GLOBAL_EXECUTION_ENABLED)" == "false" ]]
}

quiesce_and_stop() {
  local owner="$1" allow_retry="${2:-0}" attempt=0 sample
  local pre_units="" u
  for u in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
    if systemctl is-active --quiet "$u"; then
      pre_units+="${pre_units:+,}${u}"
    fi
  done
  op_set pre_active_units "$pre_units"
  op_set pre_sha "$(git_as_owner rev-parse HEAD)" || return 12
  local mig
  if ! mig="$(migration_hash)"; then
    note "schema evidence is unavailable"
    return 12
  fi
  if [[ "$mig" == "unavailable" || -z "$mig" ]]; then
    note "schema evidence is unavailable"
    return 12
  fi
  op_set pre_migrations "$mig" || return 12
  local cursor
  cursor=$(journalctl -n 0 -o cat --show-cursor 2>/dev/null | sed -n 's/^-- cursor: //p' | tail -n 1 || true)
  op_set journal_cursor "$cursor"
  if [[ "$owner" == "deploy" ]]; then
    execution_disabled || return 11
  fi
  while true; do
    sample=$(quiesce_sample Q1a)
    sleep 15
    local sample2
    sample2=$(quiesce_sample Q1b)
    if [[ "$sample" == "ZERO" && "$sample2" == "ZERO" ]]; then
      break
    fi
    if [[ "$sample" == "UNKNOWN" || "$sample2" == "UNKNOWN" ]]; then
      note "quiescence unknown"
      append_ids_only >&2
      return 12
    fi
    if [[ "$allow_retry" == "1" && "$attempt" -lt 3 ]]; then
      attempt=$((attempt + 1))
      sleep 600
      continue
    fi
    note "quiescence active"
    append_ids_only >&2
    return 11
  done
  marker_create "$owner" quiescing "$owner" "$pre_units" "$(op_field pre_sha)" "$(op_field pre_migrations)" "$(op_field target_sha)" || return 30
  systemctl stop aisandbox-frontend aisandbox-gateway || return 30
  if hook_enabled && [[ -f "$AISB_ETC/q3-inject.sql" ]]; then
    apply_q3_inject || return 12
  fi
  sample="$(quiesce_sample Q3)"
  if [[ "$sample" != "ZERO" ]]; then
    local code=11
    [[ "$sample" == "UNKNOWN" ]] && code=12
    q3_recover "$code"
  fi
  systemctl stop aisandbox-ai || return 30
  systemctl stop aisandbox-cm || return 30
  stop_session_containers || return 30
  writers_inactive || return 12
  sessions_inactive || return 12
  if hook_enabled && grep -qx 'FAULT=q6' "$AISB_ETC/ops-test-mode"; then
    local qpass
    qpass="$(redis_password "$(env_file_value "$AISB_ETC/gateway.env" REDIS_URL)")"
    REDISCLI_AUTH="$qpass" redis-cli -h 127.0.0.1 --no-auth-warning LPUSH bull:ai-execution:wait ops-test-q6 || return 12
    unset REDISCLI_AUTH
  fi
  sample="$(quiesce_sample Q6)"
  if [[ "$sample" != "ZERO" ]]; then
    marker_set_phase work-detected || return 30
    local code=11
    [[ "$sample" == "UNKNOWN" ]] && code=12
    note "work detected after writers stopped; staying in maintenance"
    return "$code"
  fi
  marker_set_phase quiesced || return 30
}

health_call_budget() {
  local deadline="$1" cap="$2" left
  left=$((deadline - SECONDS))
  if (( left <= 0 )); then
    return 1
  fi
  if (( left > cap )); then
    left=$cap
  fi
  printf '%s\n' "$left"
}

health_wait() {
  local deadline=$((SECONDS + 120)) ok budget
  while (( SECONDS < deadline )); do
    ok=1
    if budget="$(health_call_budget "$deadline" 3)"; then
      curl -fsS --max-time "$budget" http://127.0.0.1:4000/api/health/ready >/dev/null || ok=0
    else
      ok=0
    fi
    if budget="$(health_call_budget "$deadline" 3)"; then
      curl -fsS --max-time "$budget" http://127.0.0.1:4002/api/health >/dev/null || ok=0
    else
      ok=0
    fi
    if budget="$(health_call_budget "$deadline" 3)"; then
      curl -fsS --max-time "$budget" http://127.0.0.1:3002/en >/dev/null || ok=0
    else
      ok=0
    fi
    ai_worker_ready "$deadline" || ok=0
    if [[ "$ok" -eq 1 ]] && (( SECONDS < deadline )); then
      return 0
    fi
    if (( SECONDS >= deadline )); then
      return 21
    fi
    budget="$(health_call_budget "$deadline" 2)" || return 21
    sleep "$budget"
  done
  return 21
}

# BullMQ 5.70.1, prefix bull, unnamed queue ai-execution. QueueEvents appends :qe.
ai_worker_mainpid() {
  local deadline="$1" budget pid
  AI_WORKER_PID=""
  command -v timeout >/dev/null 2>&1 || return 1
  budget="$(health_call_budget "$deadline" 3)" || return 1
  timeout "$budget" systemctl is-active --quiet aisandbox-ai || return 1
  budget="$(health_call_budget "$deadline" 3)" || return 1
  pid="$(timeout "$budget" systemctl show -p MainPID --value aisandbox-ai 2>/dev/null)" || return 1
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
  AI_WORKER_PID="$pid"
  return 0
}

ai_worker_redis_query() {
  local deadline="$1"
  shift
  local budget pass out
  command -v timeout >/dev/null 2>&1 || return 1
  command -v redis-cli >/dev/null 2>&1 || return 1
  [[ -f "${AISB_ETC:-/etc/aisandbox}/gateway.env" ]] || return 1
  budget="$(health_call_budget "$deadline" 3)" || return 1
  pass="$(redis_password "$(env_file_value "${AISB_ETC:-/etc/aisandbox}/gateway.env" REDIS_URL)")"
  REDISCLI_AUTH="$pass"
  export REDISCLI_AUTH
  if ! out="$(timeout "$budget" redis-cli -h 127.0.0.1 --no-auth-warning "$@" 2>/dev/null)"; then
    unset REDISCLI_AUTH
    return 1
  fi
  unset REDISCLI_AUTH
  printf '%s\n' "$out"
}

ai_worker_client_ports() {
  local line field addr port name_ok found=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    name_ok=0
    port=""
    for field in $line; do
      if [[ "$field" == "name=bull:YWktZXhlY3V0aW9u" ]]; then
        name_ok=1
      elif [[ "$field" == addr=* ]]; then
        addr="${field#addr=}"
        port="${addr##*:}"
      fi
    done
    if [[ "$name_ok" -eq 1 && "$port" =~ ^[0-9]+$ && "$port" -gt 0 && "$addr" == "127.0.0.1:${port}" ]]; then
      printf '%s\n' "$port"
      found=1
    fi
  done
  [[ "$found" -eq 1 ]]
}

ai_worker_socket_matches() {
  local port="$1" pid="$2" line field local_ep="" peer_ep="" seen=0 pid_ok=0 token
  local -a fields=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    read -r -a fields <<< "$line"
    local_ep=""
    peer_ep=""
    seen=0
    pid_ok=0
    for field in "${fields[@]}"; do
      if [[ "$field" =~ ^127\.0\.0\.1:[0-9]+$ ]]; then
        if [[ "$seen" -eq 0 ]]; then
          local_ep="$field"
          seen=1
        elif [[ "$seen" -eq 1 ]]; then
          peer_ep="$field"
          seen=2
        fi
      fi
      if [[ "$field" =~ pid=([0-9]+) ]]; then
        token="${BASH_REMATCH[1]}"
        if [[ "$token" == "$pid" ]]; then
          pid_ok=1
        fi
      fi
    done
    [[ "$seen" -eq 2 && "$pid_ok" -eq 1 ]] || continue
    [[ "$local_ep" == "127.0.0.1:${port}" && "$peer_ep" == "127.0.0.1:6379" ]] || continue
    return 0
  done
  return 1
}

ai_worker_ready() {
  local deadline="${1:-}"
  local pid1 pid2 clients port sockets ttl matched=0 budget
  [[ "$deadline" =~ ^[0-9]+$ ]] || return 1
  ai_worker_mainpid "$deadline" || return 1
  pid1="$AI_WORKER_PID"
  clients="$(ai_worker_redis_query "$deadline" CLIENT LIST)" || return 1
  budget="$(health_call_budget "$deadline" 3)" || return 1
  sockets="$(timeout "$budget" ss -Htnp state established 2>/dev/null)" || return 1
  while IFS= read -r port; do
    [[ -n "$port" ]] || continue
    if printf '%s\n' "$sockets" | ai_worker_socket_matches "$port" "$pid1"; then
      matched=1
      break
    fi
  done < <(printf '%s\n' "$clients" | ai_worker_client_ports) || return 1
  [[ "$matched" -eq 1 ]] || return 1
  ttl="$(ai_worker_redis_query "$deadline" TTL bull:ai-execution:stalled-check)" || return 1
  ttl="${ttl//$'\r'/}"
  [[ "$ttl" =~ ^[1-9][0-9]*$ ]] || return 1
  ai_worker_mainpid "$deadline" || return 1
  pid2="$AI_WORKER_PID"
  [[ "$pid2" == "$pid1" ]] || return 1
  (( SECONDS < deadline )) || return 1
  return 0
}

ops_lock() {
  mkdir -p "$(dirname -- "$AISB_LOCK")"
  exec {AISB_LOCK_FD}>"$AISB_LOCK"
  if ! flock -n "$AISB_LOCK_FD"; then
    note "operations lock held"
    return 10
  fi
  printf '%s\n' "$$" >> "$(dirname -- "$AISB_LOCK")/lock-owner.trace"
}

ops_require_root() {
  [[ "$(id -u)" == "0" ]] || {
    note "root is required"
    return 10
  }
}

ops_require_activation() {
  local f="${AISB_ETC:-/etc/aisandbox}/ACTIVATION"
  local owner="" mode="" line=""
  local -a lines=()
  if [[ -L "$f" ]]; then
    note "ACTIVATION is a symlink"
    return 10
  fi
  if [[ ! -e "$f" ]]; then
    note "ACTIVATION is absent"
    return 10
  fi
  if [[ ! -f "$f" ]]; then
    note "ACTIVATION is not a regular file"
    return 10
  fi
  owner="$(stat -c '%u' -- "$f" 2>/dev/null)" || {
    note "ACTIVATION could not be inspected"
    return 10
  }
  mode="$(stat -c '%a' -- "$f" 2>/dev/null)" || {
    note "ACTIVATION could not be inspected"
    return 10
  }
  if [[ "$owner" != "0" || ! "$mode" =~ ^0*600$ ]]; then
    note "ACTIVATION must be root-owned mode 0600"
    return 10
  fi
  if ! mapfile -t lines < "$f"; then
    note "ACTIVATION is unreadable"
    return 10
  fi
  if [[ "${#lines[@]}" -ne 1 ]]; then
    note "ACTIVATION must contain one line"
    return 10
  fi
  line="${lines[0]}"
  if [[ "$line" == *$'\r'* || ! "$line" =~ [^[:space:]] ]]; then
    note "ACTIVATION line is empty or malformed"
    return 10
  fi
  return 0
}

refuse_uid_collision() {
  local row gid uid
  row="$(getent group 7300 || true)"
  if [[ -n "$row" && "$row" != aisandbox:* ]]; then
    note "gid 7300 is taken by another group"
    return 10
  fi
  row="$(getent passwd 7300 || true)"
  if [[ -n "$row" && "$row" != aisandbox:* ]]; then
    note "uid 7300 is taken by another account"
    return 10
  fi
  if getent group aisandbox >/dev/null; then
    gid="$(getent group aisandbox | awk -F: '{print $3}')"
    [[ "$gid" == "7300" ]] || {
      note "group aisandbox is not gid 7300"
      return 10
    }
  fi
  if id aisandbox >/dev/null 2>&1; then
    uid="$(id -u aisandbox)"
    gid="$(id -g aisandbox)"
    [[ "$uid" == "7300" && "$gid" == "7300" ]] || {
      note "user aisandbox is not uid/gid 7300"
      return 10
    }
  fi
}

ops_refuse_override() {
  if [[ "$AISB_ROOT" == "/opt/aisandbox" && "$AISB_ETC" == "/etc/aisandbox" ]]; then
    return 0
  fi
  note "a path override is not isolation; operational entry points stay on the production paths unless this process is inside a disposable namespace"
  return 10
}

ops_test_gate_ok() {
  local f owner mode
  f="${AISB_ETC}/ops-test-mode"
  [[ -f "$f" ]] || return 1
  owner="$(stat -c '%u' "$f" 2>/dev/null || true)"
  mode="$(stat -c '%a' "$f" 2>/dev/null || true)"
  [[ "$owner" == "0" && ( "$mode" == "600" || "$mode" == "400" ) ]] || return 1
  grep -qx 'DISPOSABLE_NAMESPACE=1' "$f" || return 1
}

ops_test_fault() {
  local point="$1" f want
  hook_enabled || return 0
  f="$AISB_ETC/ops-test-mode"
  want=$(awk -F= '/^FAULT=/{print substr($0,7)}' "$f")
  [[ "$want" == "$point" ]] || return 0
  case "$point" in
    mutating|migrating|starting)
      marker_set_phase "${point}-failed"
      ;;
    after-migrate)
      marker_set_phase migrating-failed
      ;;
  esac
  note "test fault at ${point}"
  exit 30
}

assert_no_dotenv() {
  local hit
  hit=$(find "$AISB_ROOT" -name '.env*' ! -name '*.example' ! -name '*.template' -not -path '*/node_modules/*' -print -quit)
  if [[ -n "$hit" ]]; then
    note "dotenv present entry=${hit}"
    return 30
  fi
}

run_npm_ci_bounded() {
  local pid rc delay evidence ere=0
  case $- in *e*) ere=1 ;; esac
  evidence="${AISB_ETC}/prepare-npm-ci.interrupted"
  rm -f -- "$evidence"
  set +e
  runuser -u aisandbox -- env -u NODE_ENV npm --prefix "$AISB_ROOT" ci >"${AISB_ETC}/prepare-npm-ci.log" 2>&1 &
  pid=$!
  if hook_enabled && grep -qx 'FAULT=prepare-build' "$AISB_ETC/ops-test-mode"; then
    delay="${AISB_NPM_INTERRUPT_DELAY:-1}"
    sleep "$delay"
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" || true
      if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
      note "npm ci was not in progress at the interruption point"
      return 30
    fi
    if ! kill -TERM "$pid" 2>/dev/null; then
      if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
      note "npm ci could not be interrupted"
      return 30
    fi
    wait "$pid" || true
    if kill -0 "$pid" 2>/dev/null; then
      if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
      note "npm ci was still running after the interruption"
      return 30
    fi
    if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
    printf 'pid=%s state=stopped\n' "$pid" > "$evidence" || return 30
    note "prepare build fault during npm ci"
    return 30
  fi
  wait "$pid"
  rc=$?
  if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
  [[ "$rc" -eq 0 ]] || return 30
}

checkout_and_build() {
  local sha="$1"
  require_node24 >/dev/null || return 30
  runuser -u aisandbox -- git -C "$AISB_ROOT" checkout --detach "$sha" || return 30
  assert_no_dotenv || return 30
  run_npm_ci_bounded || return 30
  runuser -u aisandbox -- npm --prefix "$AISB_ROOT/services/api-gateway" run build
  runuser -u aisandbox -- npm --prefix "$AISB_ROOT/services/ai-service" run build
  runuser -u aisandbox -- npm --prefix "$AISB_ROOT/services/container-manager" run build
  systemd-run --wait --pipe --uid=aisandbox -p "EnvironmentFile=${AISB_ETC}/frontend.env" -p "WorkingDirectory=${AISB_ROOT}/frontend" /usr/bin/npm run build
  local rel
  for rel in services/api-gateway/dist/src/main.js services/ai-service/dist/main.js services/container-manager/dist/main.js frontend/.next/BUILD_ID node_modules/next/dist/bin/next node_modules/typeorm/cli.js; do
    [[ -e "$AISB_ROOT/$rel" ]] || {
      note "missing artifact ${rel}"
      return 30
    }
  done
}

migration_history_protected() {
  local pre="$1" target="$2" allow="$3" line status path base diff_out path1 path2 consider
  diff_out="$(git_as_owner diff --name-status "$pre" "$target" -- services/api-gateway/src/migrations)" || return 10
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    IFS=$'\t' read -r status path1 path2 <<< "$line"
    consider=0
    for path in "$path1" "$path2"; do
      [[ -n "$path" ]] || continue
      if migration_path_selected "$path"; then
        base="$(basename -- "$path")"
        if ! migration_timestamp_ok "$base"; then
          note "malformed executable migration ${path}"
          return 10
        fi
        consider=1
      fi
    done
    [[ "$consider" -eq 1 ]] || continue
    case "$status" in
      A)
        ;;
      D)
        if [[ "$allow" != "1" ]]; then
          note "migration removed without schema-ahead approval: ${line}"
          return 10
        fi
        ;;
      *)
        note "historical migration content changed: ${line}"
        return 10
        ;;
    esac
  done <<< "$diff_out"
}

require_schema_ahead_approval() {
  local sha="$1" pre="$2" f
  f="$AISB_ETC/schema-ahead-approval"
  [[ -f "$f" ]] || {
    note "schema-ahead approval file is absent"
    return 10
  }
  grep -qx "target_sha=${sha}" "$f" || return 10
  grep -qx "pre_sha=${pre}" "$f" || return 10
  grep -q '^reason=.' "$f" || return 10
}

target_covers_applied_migrations() {
  local sha="$1" allow_ahead="$2" ts files applied rc path base found
  files="$(git_as_owner ls-tree -r --name-only "$sha" -- services/api-gateway/src/migrations)" || return 10
  set +e
  applied="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT timestamp FROM migrations ORDER BY timestamp")"
  rc=$?
  set -e
  if [[ "$rc" -ne 0 ]]; then
    note "applied migration list is unavailable"
    return 10
  fi
  while IFS= read -r ts || [[ -n "$ts" ]]; do
    [[ -n "$ts" ]] || continue
    found=0
    while IFS= read -r path || [[ -n "$path" ]]; do
      [[ -n "$path" ]] || continue
      migration_path_selected "$path" || continue
      base="$(basename -- "$path")"
      if ! migration_timestamp_ok "$base"; then
        note "malformed executable migration ${path}"
        return 10
      fi
      if [[ "${base%%-*}" == "$ts" ]]; then
        found=1
      fi
    done <<< "$files"
    if [[ "$found" -eq 0 && "$allow_ahead" != "1" ]]; then
      note "applied migration ${ts} is missing from the target"
      return 10
    fi
  done <<< "$applied"
}

count_executable_migrations() {
  local commit="$1" out path n=0
  out="$(git_as_owner ls-tree -r --name-only "$commit" -- services/api-gateway/src/migrations)" || return 30
  while IFS= read -r path || [[ -n "$path" ]]; do
    [[ -n "$path" ]] || continue
    migration_path_selected "$path" || continue
    if ! migration_timestamp_ok "${path##*/}"; then
      note "malformed executable migration ${path}"
      return 30
    fi
    n=$((n + 1))
  done <<< "$out"
  printf '%s\n' "$n"
}

count_added_executable_migrations() {
  local pre="$1" target="$2" diff_out line status path n=0
  diff_out="$(git_as_owner diff --name-status "$pre" "$target" -- services/api-gateway/src/migrations)" || return 10
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    status="${line%%$'\t'*}"
    path="${line#*$'\t'}"
    path="${path##*$'\t'}"
    migration_path_selected "$path" || continue
    if ! migration_timestamp_ok "${path##*/}"; then
      note "malformed executable migration ${path}"
      return 30
    fi
    [[ "$status" == "A" ]] || continue
    n=$((n + 1))
  done <<< "$diff_out"
  printf '%s\n' "$n"
}

verify_migrations_applied() {
  local file base ts applied rc files
  set +e
  applied="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT timestamp FROM migrations ORDER BY timestamp")"
  rc=$?
  set -e
  if [[ "$rc" -ne 0 ]]; then
    note "cannot read applied migrations"
    return 30
  fi
  files="$(git_as_owner ls-tree -r --name-only HEAD -- services/api-gateway/src/migrations)" || return 30
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    migration_path_selected "$file" || continue
    base="$(basename -- "$file")"
    if ! migration_timestamp_ok "$base"; then
      note "malformed executable migration ${file}"
      return 30
    fi
    ts="${base%%-*}"
    printf '%s\n' "$applied" | grep -qx "$ts" || {
      note "migration file ${base} is not applied"
      return 30
    }
  done <<< "$files"
}

filesystem_supports_restore() {
  local fstype
  fstype="$(findmnt -T "$AISB_ROOT" -no FSTYPE,OPTIONS)" || return 10
  [[ "$fstype" == ext4* ]] || {
    note "filesystem is not ext4"
    return 10
  }
  [[ "$fstype" != *noacl* ]] || {
    note "filesystem has noacl"
    return 10
  }
  [[ "$fstype" != *nouser_xattr* ]] || {
    note "filesystem has nouser_xattr"
    return 10
  }
}

tar_lacks_file() {
  local archive="$1" rel="$2" list
  list="$(mktemp)" || return 2
  if ! tar -tf "$archive" > "$list"; then
    rm -f -- "$list"
    return 2
  fi
  if grep -Fxq -- "$rel" "$list"; then
    rm -f -- "$list"
    return 1
  fi
  rm -f -- "$list"
  return 0
}

reconcile_deleted_tracked_files() {
  local archive="$1" rel f files
  [[ "$(op_field empty_target)" == "pass" ]] || {
    note "reconciliation refused because the empty-target check did not pass"
    return 10
  }
  if [[ -f "$AISB_DEPLOYED" ]]; then
    note "reconciliation refused on a populated primary"
    return 10
  fi
  for rel in workspaces database projects; do
    files="$(git_as_owner ls-files -- "$rel")" || return 40
    while IFS= read -r f; do
      [[ -n "$f" ]] || continue
      if tar_lacks_file "$archive" "$f"; then
        rm -f -- "$AISB_ROOT/$f" || return 40
      else
        if [[ "$?" -eq 2 ]]; then
          note "archive listing failed; reconciliation stopped"
          return 40
        fi
      fi
    done <<< "$files"
  done
}

exact_metadata_match() {
  local dest="$1" tmp
  tmp="$(mktemp -d)"
  backup_owners "$tmp" || return 40
  backup_acls "$tmp" || return 40
  backup_xattrs "$tmp" || return 40
  cp -p "$dest/sockets.paths" "$tmp/sockets.paths" || return 40
  backup_git_status "$tmp" || return 40
  cmp -s "$dest/owners.tsv" "$tmp/owners.tsv" || return 40
  cmp -s "$dest/acls.txt" "$tmp/acls.txt" || return 40
  cmp -s "$dest/xattrs.txt" "$tmp/xattrs.txt" || return 40
  cmp -s "$dest/git-status-persistent.txt" "$tmp/git-status-persistent.txt" || return 40
  rm -rf -- "$tmp"
}

write_deployed() {
  local sha digest hash
  sha="$(git_as_owner rev-parse HEAD)" || return 30
  if ! digest="$(docker image inspect "$AISB_IMAGE" --format '{{.Id}}' 2>/dev/null)"; then
    digest=unavailable
  fi
  [[ -n "$digest" ]] || digest=unavailable
  if ! hash="$(migration_hash)"; then
    note "schema evidence is unavailable"
    return 30
  fi
  cat > "$AISB_DEPLOYED" <<EOF
sha=${sha}
time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
node=$(node -v)
migration_hash=${hash}
sandbox_image=${AISB_IMAGE}
sandbox_image_digest=${digest}
EOF
}

ops_tree() {
  if [[ -n "${AISB_OPS_TREE:-}" ]]; then
    printf '%s\n' "$AISB_OPS_TREE"
    return 0
  fi
  local here
  here=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
  if [[ -d "$here/../systemd" ]]; then
    CDPATH= cd -- "$here/.." && pwd
    return 0
  fi
  printf '%s\n' /usr/local/lib/aisandbox/clean-baseline
}

listen_clear() {
  local port
  for port in 3002 4000 4001 4002; do
    if ss -ltn | awk '{print $4}' | grep -E -q "[:.]${port}$"; then
      note "listener present port=${port}"
      return 31
    fi
  done
}

journal_writers_empty() {
  local out
  out=$(journalctl -u aisandbox-gateway -u aisandbox-ai -u aisandbox-cm -u aisandbox-frontend -q --no-pager 2>/dev/null || true)
  if [[ -n "$out" ]]; then
    note "writer journal is not empty"
    return 31
  fi
}
