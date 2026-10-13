#!/bin/bash
# Shell-only regressions for R1-R6. Sources the implementation. Mocks external commands.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
LIB="$HERE/../../lib/ops-lib.sh"
# shellcheck source=/dev/null
source "$LIB"
PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); printf 'PASS %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1" >&2; }
tmp=$(mktemp -d)
cleanup() { rm -rf -- "$tmp"; }
trap cleanup EXIT

# R1 defect class: same-file cp fails.
same="$tmp/same.json"
printf '%s\n' '{}' > "$same"
if cp -p "$same" "$same" >/dev/null 2>&1; then
  bad r1-defect-same-cp
else
  ok r1-defect-same-cp
fi

setup_backup_files() {
  local dest="$1"
  mkdir -p "$dest/config/units" "$tmp/units" "$tmp/etc"
  printf '%s\n' host > "$tmp/pg_hba"
  printf '%s\n' redis > "$tmp/redis.conf"
  printf '%s\n' caddy > "$tmp/Caddyfile"
  local unit
  for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend aisandbox-migrate aisandbox-backup; do
    printf '%s\n' "[Service]" > "$tmp/units/${unit}.service"
  done
  printf '%s\n' "[Timer]" > "$tmp/units/aisandbox-backup.timer"
  AISB_PG_HBA="$tmp/pg_hba"
  AISB_REDIS_CONF="$tmp/redis.conf"
  AISB_CADDYFILE="$tmp/Caddyfile"
  AISB_UNIT_DIR="$tmp/units"
  AISB_OP="$tmp/op"
  AISB_DEPLOYED=""
  : > "$AISB_OP"
}
runuser() { printf '%s\n' '1 AddM'; }

setup_backup_files "$tmp/dest-a"
printf '%s\n' '{"result":"ZERO"}' > "$tmp/dest-a/quiescence.json"
op_set record_dir "$tmp/dest-a"
cp() {
  if [[ "$1" == "-p" && "$2" == "$3" ]]; then
    printf '%s\n' SAME >> "$tmp/cp-log"
    return 1
  fi
  command cp "$@"
}
if backup_copy_recovery_files "$tmp/dest-a"; then
  if grep -q SAME "$tmp/cp-log" 2>/dev/null; then
    bad r1-inplace-called-same-cp
  else
    ok r1-inplace-quiescence
  fi
else
  bad r1-inplace-quiescence
fi

unset -f cp
setup_backup_files "$tmp/dest-b"
mkdir -p "$tmp/record"
printf '%s\n' '{"result":"ZERO"}' > "$tmp/record/quiescence.json"
op_set record_dir "$tmp/record"
if backup_copy_recovery_files "$tmp/dest-b" && cmp -s "$tmp/record/quiescence.json" "$tmp/dest-b/quiescence.json"; then
  ok r1-distinct-copy
else
  bad r1-distinct-copy
fi

setup_backup_files "$tmp/dest-c"
op_set record_dir "$tmp/missing-record"
if backup_copy_recovery_files "$tmp/dest-c"; then
  bad r1-missing-quiescence
else
  ok r1-missing-quiescence
fi

cp() { return 1; }
setup_backup_files "$tmp/dest-d"
mkdir -p "$tmp/record2"
printf '%s\n' '{}' > "$tmp/record2/quiescence.json"
op_set record_dir "$tmp/record2"
if backup_copy_recovery_files "$tmp/dest-d"; then
  bad r1-copy-failure
else
  ok r1-copy-failure
fi
unset -f cp

# backup_age must not publish when identity capture fails.
unset -f runuser
AISB_ROOT="$tmp/root"
mkdir -p "$AISB_ROOT/.git" "$tmp/age-dest" "$tmp/off" "$tmp/etc"
printf '%s\n' 'age1public' > "$tmp/etc/age-recipient.txt"
AISB_ETC="$tmp/etc"
AISB_OFFHOST="$tmp/off"
printf '%s\n' MANIFEST > "$tmp/age-dest/members.list"
printf '%s\n' 'abc  MANIFEST' > "$tmp/age-dest/SHA256SUMS"
printf '%s\n' manifest-body > "$tmp/age-dest/MANIFEST"
AISB_BACKUP_TS="case1"
tar() { printf '%s\n' archive; }
age() { cat; }
git_as_owner() { return 1; }
id() { printf '%s\n' 7300; }
if backup_age "$tmp/age-dest"; then
  bad r1-age-identity-failure
else
  if [[ -e "$tmp/off/case1.tar.age" ]]; then
    bad r1-age-published-after-failure
  else
    ok r1-age-identity-failure
  fi
fi
unset -f tar age git_as_owner id

# R2 defect class: a bare non-zero function return aborts under set -e.
probe_out="$tmp/r2-probe.out"
bash -c 'set -e; defect_fn() { return 1; }; defect_fn; printf survived' >"$probe_out"
probe_rc=$?
if [[ "$probe_rc" -ne 0 ]] && ! grep -q survived "$probe_out"; then
  ok r2-defect-errexit
else
  bad r2-defect-errexit
fi
kept_out="$tmp/r2-kept.out"
bash -c 'set -e; defect_fn() { return 1; }; if defect_fn; then printf removed; else printf kept; fi; printf survived' >"$kept_out"
if grep -q kept "$kept_out" && grep -q survived "$kept_out"; then
  ok r2-conditional-preserves-status
else
  bad r2-conditional-preserves-status
fi

repo="$tmp/repo"
mkdir -p "$repo/database" "$repo/workspaces" "$repo/projects"
printf '%s\n' tracked > "$repo/database/keep.sql"
printf '%s\n' gone > "$repo/database/drop.sql"
git -C "$repo" init >/dev/null
git -C "$repo" add database/keep.sql database/drop.sql
git -C "$repo" -c user.email=ops@example.invalid -c user.name=ops commit -m fixture >/dev/null
AISB_ROOT="$repo"
AISB_DEPLOYED="$tmp/no-deployed"
AISB_OP="$tmp/op-r2"
: > "$AISB_OP"
git_as_owner() { git -C "$AISB_ROOT" "$@"; }
op_set empty_target pass
tar -C "$repo" -cf "$tmp/full.tar" database/keep.sql database/drop.sql
if reconcile_deleted_tracked_files "$tmp/full.tar"; then
  if [[ -f "$repo/database/keep.sql" && -f "$repo/database/drop.sql" ]]; then
    ok r2-present-tracked-file
  else
    bad r2-present-tracked-file
  fi
else
  bad r2-present-tracked-file
fi
rm -f -- "$repo/database/drop.sql"
tar -C "$repo" -cf "$tmp/deleted.tar" database/keep.sql
if reconcile_deleted_tracked_files "$tmp/deleted.tar"; then
  if [[ ! -e "$repo/database/drop.sql" && -f "$repo/database/keep.sql" ]]; then
    ok r2-deleted-tracked-file
  else
    bad r2-deleted-tracked-file
  fi
else
  bad r2-deleted-tracked-file
fi
printf '%s\n' back > "$repo/database/drop.sql"
git -C "$repo" add database/drop.sql
git -C "$repo" -c user.email=ops@example.invalid -c user.name=ops commit -m restore-drop >/dev/null
if reconcile_deleted_tracked_files "$tmp/missing.tar"; then
  bad r2-unreadable-archive
else
  if [[ -f "$repo/database/drop.sql" ]]; then
    ok r2-unreadable-archive
  else
    bad r2-unreadable-archive
  fi
fi
git_as_owner() { return 9; }
if reconcile_deleted_tracked_files "$tmp/full.tar"; then
  bad r2-failed-enumeration
else
  ok r2-failed-enumeration
fi
git_as_owner() { git -C "$AISB_ROOT" "$@"; }
op_set empty_target pass
op_begin restore
if [[ "$(op_field empty_target)" == "pass" ]]; then
  bad r2-op-begin-clears-preflight
else
  ok r2-op-begin-clears-preflight
fi
restore_bind_preflight pass
if [[ "$(op_field empty_target)" == "pass" ]]; then
  ok r2-bind-preflight
else
  bad r2-bind-preflight
fi
cat > "$tmp/roles.sql" <<'SQL'
\restrict TOKEN
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS;
CREATE ROLE aisandbox;
ALTER ROLE aisandbox WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE "ops-role";
GRANT pg_read_all_stats TO aisandbox;
\unrestrict TOKEN
SQL
SCRIPT_CALLS="$tmp/roles-calls"
: > "$SCRIPT_CALLS"
runuser() {
  if [[ "$*" == *"-f -"* ]]; then
    printf 'script\n' >> "$SCRIPT_CALLS"
    cat > "$tmp/roles-session.sql"
    return 0
  fi
  if [[ "$*" == *pg_roles* ]]; then
    printf 'query\n' >> "$SCRIPT_CALLS"
    printf '%s\n' 1
    return 0
  fi
  return 1
}
if apply_roles_sql "$tmp/roles.sql" \
  && [[ "$(grep -c '^script$' "$SCRIPT_CALLS")" -eq 1 && "$(grep -c '^query$' "$SCRIPT_CALLS")" -eq 3 ]] \
  && grep -q 'duplicate_object' "$tmp/roles-session.sql" \
  && awk '
      /\\restrict TOKEN/ { if (seen++) exit 1; r=NR }
      /SET client_encoding/ { if (!r || s) exit 1; s=NR }
      /CREATE ROLE "ops-role"/ { if (!s || q) exit 1; q=NR }
      /\\unrestrict TOKEN/ { if (!q || u) exit 1; u=NR }
      END { if (!(r && s && q && u && r < s && s < q && q < u)) exit 1 }
    ' "$tmp/roles-session.sql"; then
  ok r2-roles-one-session-dump
else
  bad r2-roles-one-session-dump
fi
runuser() {
  if [[ "$*" == *"-f -"* ]]; then
    cat > /dev/null
    printf '%s\n' 'connection reset by peer'
    return 2
  fi
  printf '%s\n' 1
}
if apply_roles_sql "$tmp/roles.sql"; then
  bad r2-roles-nonzero-without-error
else
  ok r2-roles-nonzero-without-error
fi
ROLE_QUERIES="$tmp/roles-fatal-queries"
: > "$ROLE_QUERIES"
runuser() {
  if [[ "$*" == *"-f -"* ]]; then
    cat > /dev/null
    printf '%s\n' 'FATAL:  connection to server was lost'
    return 2
  fi
  printf 'query\n' >> "$ROLE_QUERIES"
  printf '%s\n' 1
}
if apply_roles_sql "$tmp/roles.sql"; then
  bad r2-roles-fatal-stops-session
elif [[ ! -s "$ROLE_QUERIES" ]]; then
  ok r2-roles-fatal-stops-session
else
  bad r2-roles-fatal-stops-session
fi
unset -f runuser git_as_owner

# R3
hash='$2a$10$abcdef'
envf="$tmp/operator.env"
printf 'AISB_OPERATOR_USER=aisboperator\nAISB_OPERATOR_HASH=%s\n' "$hash" > "$envf"
if (
  set -u
  # shellcheck disable=SC1090
  source "$envf"
); then
  bad r3-defect-source-expands-bcrypt
else
  ok r3-defect-source-expands-bcrypt
fi
got="$(read_env_literal "$envf" AISB_OPERATOR_HASH)"
if [[ "$got" == "$hash" ]]; then
  ok r3-literal-bcrypt
else
  bad r3-literal-bcrypt
fi

src="$tmp/stage-src"
dest="$tmp/stage-dest"
mkdir -p "$src/systemd" "$dest"
printf '%s\n' payload > "$src/marker.txt"
AISB_OPS_TREE="$src"
AISB_INSTALL_TREE="$dest"
COPIES=0
install() { if [[ "$1" == "-d" ]]; then mkdir -p "${!#}"; fi; }
cp() { COPIES=$((COPIES + 1)); command cp "$@"; }
install_staged_tree
first=$COPIES
COPIES=0
AISB_OPS_TREE="$dest"
install_staged_tree
if [[ "$first" -ge 1 && "$COPIES" -eq 0 && -f "$dest/marker.txt" ]]; then
  ok r3-installed-tree-rerun
else
  bad r3-installed-tree-rerun
fi
unset -f install cp

left="$tmp/gw.env"
right="$tmp/ai.env"
printf '%s\n' 'DATABASE_URL=postgresql://aisandbox:keep@127.0.0.1:5432/aisandbox' > "$left"
printf '%s\n' 'DATABASE_URL=' > "$right"
fill_shared_url DATABASE_URL "$left" "$right"
if grep -qx 'DATABASE_URL=postgresql://aisandbox:keep@127.0.0.1:5432/aisandbox' "$right"; then
  ok r3-partial-copy
else
  bad r3-partial-copy
fi
printf '%s\n' 'DATABASE_URL=postgresql://aisandbox:other@127.0.0.1:5432/aisandbox' > "$right"
if fill_shared_url DATABASE_URL "$left" "$right"; then
  bad r3-partial-disagree
else
  ok r3-partial-disagree
fi
empty_l="$tmp/empty-gw.env"
empty_r="$tmp/empty-ai.env"
: > "$empty_l"
: > "$empty_r"
if fill_shared_url DATABASE_URL "$empty_l" "$empty_r"; then
  generated="$(env_file_value "$empty_l" DATABASE_URL)"
  copied="$(env_file_value "$empty_r" DATABASE_URL)"
  if [[ "$generated" == postgresql://aisandbox:* && "$generated" == "$copied" ]]; then
    ok r3-empty-database-url
  else
    bad r3-empty-database-url
  fi
else
  bad r3-empty-database-url
fi
gen_l="$tmp/gen-l.env"
gen_r="$tmp/gen-r.env"
openssl() { return 1; }
: > "$gen_l"
: > "$gen_r"
if fill_shared_url DATABASE_URL "$gen_l" "$gen_r"; then
  bad r3-generator-failure
elif [[ -n "$(env_file_value "$gen_l" DATABASE_URL)" || -n "$(env_file_value "$gen_r" DATABASE_URL)" ]]; then
  bad r3-generator-failure
else
  ok r3-generator-failure
fi
openssl() { printf ''; return 0; }
if fill_shared_url DATABASE_URL "$gen_l" "$gen_r"; then
  bad r3-empty-generated-secret
else
  ok r3-empty-generated-secret
fi
unset -f openssl
eval "$(declare -f kv_set | sed '1s/^kv_set/kv_set_impl/')"
KV_CALLS=0
KV_FAIL_AT=1
kv_set() {
  KV_CALLS=$((KV_CALLS + 1))
  if [[ "$KV_CALLS" -eq "$KV_FAIL_AT" ]]; then
    return 30
  fi
  kv_set_impl "$@"
}
: > "$gen_l"
: > "$gen_r"
if fill_shared_url DATABASE_URL "$gen_l" "$gen_r"; then
  bad r3-first-write-failure
elif [[ -n "$(env_file_value "$gen_r" DATABASE_URL)" ]]; then
  bad r3-first-write-failure
else
  ok r3-first-write-failure
fi
KV_CALLS=0
KV_FAIL_AT=2
if fill_shared_url DATABASE_URL "$gen_l" "$gen_r"; then
  bad r3-second-write-failure
elif [[ "$(env_file_value "$gen_l" DATABASE_URL)" == "$(env_file_value "$gen_r" DATABASE_URL)" && -n "$(env_file_value "$gen_r" DATABASE_URL)" ]]; then
  bad r3-second-write-failure
else
  ok r3-second-write-failure
fi
eval "$(declare -f kv_set_impl | sed '1s/^kv_set_impl/kv_set/')"
unset -f kv_set_impl
kept="$tmp/kv-keep.env"
printf 'KEEP=original\nCHANGE=old\n' > "$kept"
before_kv="$(cat "$kept")"
grep() {
  if [[ "$1" == "-v" ]]; then
    return 2
  fi
  command grep "$@"
}
if kv_set "$kept" CHANGE new; then
  bad r3-kv-filter-failure
elif [[ "$(cat "$kept")" == "$before_kv" ]]; then
  ok r3-kv-filter-failure
else
  bad r3-kv-filter-failure
fi
unset -f grep
sec_l="$tmp/sec-l.env"
sec_r="$tmp/sec-r.env"
printf '%s\n' 'INTERNAL_SERVICE_KEY=already-set' > "$sec_l"
printf '%s\n' 'INTERNAL_SERVICE_KEY=' > "$sec_r"
if reconcile_pair INTERNAL_SERVICE_KEY "$sec_l" "$sec_r" && [[ "$(env_file_value "$sec_r" INTERNAL_SERVICE_KEY)" == "already-set" ]]; then
  ok r3-secret-copied
else
  bad r3-secret-copied
fi
printf '%s\n' 'INTERNAL_SERVICE_KEY=other' > "$sec_r"
before_secret="$(cat "$sec_l")"
if reconcile_pair INTERNAL_SERVICE_KEY "$sec_l" "$sec_r"; then
  bad r3-secret-disagree
elif [[ "$(cat "$sec_l")" == "$before_secret" ]]; then
  ok r3-secret-disagree
else
  bad r3-secret-disagree
fi
getent() {
  case "$1 $2" in
    "group 7300") return 1 ;;
    "passwd 7300") return 1 ;;
    "group aisandbox") printf '%s\n' 'aisandbox:x:7301:' ;;
    *) return 1 ;;
  esac
}
id() { return 1; }
if refuse_uid_collision; then
  bad r3-wrong-group-refused
else
  ok r3-wrong-group-refused
fi
getent() {
  case "$1 $2" in
    "group 7300"|"group aisandbox") printf '%s\n' 'aisandbox:x:7300:' ;;
    "passwd 7300") printf '%s\n' 'aisandbox:x:7300:7300:::' ;;
    *) return 1 ;;
  esac
}
id() {
  case "$*" in
    "-u aisandbox") printf '%s\n' 7300 ;;
    "-g aisandbox") printf '%s\n' 7300 ;;
    aisandbox) return 0 ;;
    *) return 1 ;;
  esac
}
if refuse_uid_collision; then
  ok r3-pinned-identity
else
  bad r3-pinned-identity
fi
unset -f getent id

# R4
git_as_owner() { return 7; }
if migration_history_protected aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 1; then
  bad r4-failed-git-diff
else
  ok r4-failed-git-diff
fi
blobfile="$tmp/blobs.txt"
printf '%s\n' '100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa services/api-gateway/src/migrations/200-AddM.ts' > "$blobfile"
op_set migration_blobs "$blobfile"
git_as_owner() {
  case "$*" in
    *ls-tree*) printf '%s\n' 'services/api-gateway/src/migrations/200-AddM.ts' ;;
    *rev-parse*) printf '%s\n' bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb ;;
    *) return 1 ;;
  esac
}
if applied_migration_content_unchanged cccccccccccccccccccccccccccccccccccccccc; then
  bad r4-changed-applied-content
else
  ok r4-changed-applied-content
fi
git_as_owner() {
  case "$*" in
    *ls-tree*) printf '%s\n' 'services/api-gateway/src/migrations/200-AddM.ts' ;;
    *rev-parse*) printf '%s\n' aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ;;
    *) return 1 ;;
  esac
}
if applied_migration_content_unchanged cccccccccccccccccccccccccccccccccccccccc; then
  ok r4-unchanged-applied-content
else
  bad r4-unchanged-applied-content
fi
migration_hash() { printf '%s' unavailable; return 2; }
if store_migration_hash; then
  bad r4-failed-hash-not-stored
elif grep -q '^pre_migrations=unavailable$' "$AISB_OP"; then
  bad r4-failed-hash-written
else
  ok r4-failed-hash-not-stored
fi
unset -f migration_hash
git_as_owner() {
  printf 'A\t%s\n' 'services/api-gateway/src/migrations/200-AddM.ts'
}
if migration_history_protected aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0; then
  ok r4-addition-is-not-content-proof
else
  bad r4-addition-is-not-content-proof
fi
AISB_OP="$tmp/op-blobs"
: > "$AISB_OP"
git_as_owner() {
  case "$*" in
    *name-only*) printf '%s\n' 'services/api-gateway/src/migrations/200-AddM.ts' ;;
    ls-tree*) printf '%s\n' '100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa services/api-gateway/src/migrations/200-AddM.ts' ;;
    rev-parse*) printf '%s\n' bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb ;;
    *) return 1 ;;
  esac
}
if record_migration_blobs "$(applied_blobs_file)" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  && applied_migration_content_unchanged cccccccccccccccccccccccccccccccccccccccc; then
  bad r4-retained-blob-rejects-change
else
  if [[ -s "$(applied_blobs_file)" ]]; then
    ok r4-retained-blob-rejects-change
  else
    bad r4-retained-blob-rejects-change
  fi
fi
saved_blobs="$(cat "$(applied_blobs_file)")"
op_set target_sha cccccccccccccccccccccccccccccccccccccccc
if capture_attempt_blobs cccccccccccccccccccccccccccccccccccccccc from-maintenance \
  && [[ "$(cat "$(applied_blobs_file)")" == "$saved_blobs" ]]; then
  ok r4-recovery-does-not-rerecord-itself
else
  bad r4-recovery-does-not-rerecord-itself
fi
op_begin deploy
if [[ -n "$(op_field migration_blobs)" ]]; then
  bad r4-op-begin-clears-blob-key
else
  ok r4-op-begin-clears-blob-key
fi
restore_applied_blob_key
if [[ "$(op_field migration_blobs)" == "$(applied_blobs_file)" ]] \
  && ! applied_migration_content_unchanged cccccccccccccccccccccccccccccccccccccccc; then
  ok r4-blob-key-survives-op-begin
else
  bad r4-blob-key-survives-op-begin
fi
unset -f git_as_owner

# R5
gate="$tmp/etc-r5"
mkdir -p "$gate"
AISB_ETC="$gate"
printf '%s\n' 'DISPOSABLE_NAMESPACE=1' > "$gate/ops-test-mode"
printf '%s\n' 'FAULT=prepare-build' >> "$gate/ops-test-mode"
chmod 644 "$gate/ops-test-mode"
if ops_test_gate_ok; then
  bad r5-loose-gate-rejected
else
  ok r5-loose-gate-rejected
fi
if hook_enabled; then
  bad r5-hook-ignores-loose-gate
else
  ok r5-hook-ignores-loose-gate
fi
stat() {
  case "$*" in
    *%u*) printf '%s\n' 0 ;;
    *%a*) printf '%s\n' 600 ;;
    *) command stat "$@" ;;
  esac
}
chmod 600 "$gate/ops-test-mode"
if ops_test_gate_ok; then
  ok r5-valid-gate
else
  bad r5-valid-gate
fi
printf '%s\n' 'INSERT INTO usage_records VALUES (1);' > "$gate/q3-inject.sql"
printf '%s\n' 'DISPOSABLE_NAMESPACE=1' > "$gate/ops-test-mode"
printf '%s\n' 'Q3_EXPECT_ID=00000000-0000-4000-8000-0000000000a3' >> "$gate/ops-test-mode"
runuser() {
  if [[ "$*" == */dev/stdin* || "$*" == *ON_ERROR_STOP=1* ]]; then
    cat > "$tmp/q3-stdin.txt"
    return 0
  fi
  printf '%s\n' 1
}
if apply_q3_inject && grep -q 'INSERT INTO usage_records' "$tmp/q3-stdin.txt"; then
  ok r5-q3-stdin
else
  bad r5-q3-stdin
fi
unset -f stat runuser

# R4 lifecycle: B applies M, schema-ahead rollback to A retains M, changed C is rejected.
mkdir -p "$tmp/life"
AISB_OP="$tmp/life/current-op"
: > "$AISB_OP"
BLOB_M=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
BLOB_BASE=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
BLOB_C=cccccccccccccccccccccccccccccccccccccccc
COMMIT_A=1111111111111111111111111111111111111111
COMMIT_B=2222222222222222222222222222222222222222
COMMIT_C=3333333333333333333333333333333333333333
PATH_BASE=services/api-gateway/src/migrations/100-Base.ts
PATH_M=services/api-gateway/src/migrations/200-AddM.ts
APPLIED=""
git_as_owner() {
  case "$*" in
    *name-only*"${COMMIT_A}"*) printf '%s\n' "$PATH_BASE" ;;
    *name-only*"${COMMIT_B}"*) printf '%s\n' "$PATH_BASE"; printf '%s\n' "$PATH_M" ;;
    *name-only*"${COMMIT_C}"*) printf '%s\n' "$PATH_BASE"; printf '%s\n' "$PATH_M" ;;
    ls-tree*"${COMMIT_B}"*)
      printf '100644 blob %s %s\n' "$BLOB_BASE" "$PATH_BASE"
      printf '100644 blob %s %s\n' "$BLOB_M" "$PATH_M"
      ;;
    ls-tree*"${COMMIT_A}"*) printf '100644 blob %s %s\n' "$BLOB_BASE" "$PATH_BASE" ;;
    ls-tree*"${COMMIT_C}"*)
      printf '100644 blob %s %s\n' "$BLOB_BASE" "$PATH_BASE"
      printf '100644 blob %s %s\n' "$BLOB_C" "$PATH_M"
      ;;
    rev-parse*"${COMMIT_C}:${PATH_M}") printf '%s\n' "$BLOB_C" ;;
    rev-parse*"${COMMIT_B}:${PATH_M}") printf '%s\n' "$BLOB_M" ;;
    rev-parse*) printf '%s\n' "$BLOB_BASE" ;;
    *) return 1 ;;
  esac
}
runuser() {
  if [[ "$*" == *timestamp\ FROM\ migrations* ]]; then
    printf '%s\n' "$APPLIED"
    return 0
  fi
  return 0
}
APPLIED=""
if stage_attempted_blobs "$COMMIT_A"; then
  APPLIED=100
  if commit_attempted_blobs && grep -q "^ts=100 blob=${BLOB_BASE} " "$(applied_blobs_file)" \
    && ! grep -q '^ts=200 ' "$(applied_blobs_file)"; then
    ok r4-first-start-records-ledger
  else
    bad r4-first-start-records-ledger
  fi
else
  bad r4-first-start-records-ledger
fi
if guard_migration_evidence "$COMMIT_B" && stage_attempted_blobs "$COMMIT_B"; then
  APPLIED=$'100\n200'
  if guard_migration_evidence "$COMMIT_B"; then
    bad r4-interruption-before-commit
  else
    ok r4-interruption-before-commit
  fi
else
  bad r4-interruption-before-commit
fi
if reconcile_attempted_after_interruption \
  && grep -q "^ts=200 blob=${BLOB_M} " "$(applied_blobs_file)" \
  && guard_migration_evidence "$COMMIT_A" \
  && grep -q "^ts=200 blob=${BLOB_M} " "$(applied_blobs_file)"; then
  ok r4-recovery-retains-applied-blob
else
  bad r4-recovery-retains-applied-blob
fi
if guard_migration_evidence "$COMMIT_C"; then
  bad r4-later-target-cannot-change-applied-blob
elif grep -q "^ts=200 blob=${BLOB_M} " "$(applied_blobs_file)"; then
  ok r4-later-target-cannot-change-applied-blob
else
  bad r4-later-target-cannot-change-applied-blob
fi
if stage_attempted_blobs "$COMMIT_C" && commit_attempted_blobs; then
  bad r4-commit-refuses-replacement
elif grep -q "^ts=200 blob=${BLOB_M} " "$(applied_blobs_file)"; then
  ok r4-commit-refuses-replacement
else
  bad r4-commit-refuses-replacement
fi
printf 'sha=deployed\n' > "$tmp/deployed-marker"
AISB_DEPLOYED="$tmp/deployed-marker"
mkdir -p "$tmp/record-life"
printf '%s\n' '{}' > "$tmp/record-life/quiescence.json"
op_set record_dir "$tmp/record-life"
if backup_copy_recovery_files "$tmp/dest-life" \
  && cmp -s "$(applied_blobs_file)" "$tmp/dest-life/applied-migration-blobs.txt"; then
  ok r4-backup-includes-ledger
else
  bad r4-backup-includes-ledger
fi
rm -f -- "$(applied_blobs_file)"
if install_restored_migration_ledger "$tmp/dest-life" \
  && guard_migration_evidence "$COMMIT_A"; then
  ok r4-restore-then-deploy-guard
else
  bad r4-restore-then-deploy-guard
fi
runuser() {
  if [[ "$*" == *timestamp\ FROM\ migrations* ]]; then
    printf '%s\n' 'relation "migrations" does not exist'
    return 2
  fi
  return 0
}
if require_ledger_covers_applied; then
  bad r4-missing-schema-is-not-empty
else
  ok r4-missing-schema-is-not-empty
fi
runuser() {
  if [[ "$*" == *timestamp\ FROM\ migrations* ]]; then
    printf '%s\n' $'100\nnope'
    return 0
  fi
  return 0
}
if require_ledger_covers_applied; then
  bad r4-malformed-timestamp-fails
else
  ok r4-malformed-timestamp-fails
fi
unset -f git_as_owner runuser

# R4 promotion is limited to database-confirmed attempt entries.
mkdir -p "$tmp/r4fix"
AISB_OP="$tmp/r4fix/current-op"
: > "$AISB_OP"
B100=1111111111111111111111111111111111111111
B200=2222222222222222222222222222222222222222
B300=3333333333333333333333333333333333333333
B300B=4444444444444444444444444444444444444444
B200B=5555555555555555555555555555555555555555
C_OLD=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
C_TRY=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
C_RETRY=cccccccccccccccccccccccccccccccccccccccc
C_BAD=dddddddddddddddddddddddddddddddddddddddd
C_CONFLICT=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
P100=services/api-gateway/src/migrations/100-Base.ts
P200=services/api-gateway/src/migrations/200-AddM.ts
P300=services/api-gateway/src/migrations/300-Extra.ts
APPLIED=""
git_as_owner() {
  case "$*" in
    *name-only*"${C_RETRY}"*|*name-only*"${C_BAD}"*)
      printf '%s\n' "$P100" "$P200" "$P300"
      ;;
    ls-tree*"${C_OLD}"*) printf '100644 blob %s %s\n' "$B100" "$P100" ;;
    ls-tree*"${C_TRY}"*)
      printf '100644 blob %s %s\n' "$B100" "$P100"
      printf '100644 blob %s %s\n' "$B200" "$P200"
      printf '100644 blob %s %s\n' "$B300" "$P300"
      ;;
    ls-tree*"${C_CONFLICT}"*)
      printf '100644 blob %s %s\n' "$B100" "$P100"
      printf '100644 blob %s %s\n' "$B200B" "$P200"
      printf '100644 blob %s %s\n' "$B300" "$P300"
      ;;
    rev-parse*"${C_RETRY}:${P300}") printf '%s\n' "$B300B" ;;
    rev-parse*"${C_BAD}:${P200}") printf '%s\n' "$B200B" ;;
    rev-parse*"${P200}") printf '%s\n' "$B200" ;;
    rev-parse*"${P100}") printf '%s\n' "$B100" ;;
    rev-parse*"${P300}") printf '%s\n' "$B300" ;;
    *) return 1 ;;
  esac
}
runuser() {
  if [[ "$*" == *timestamp\ FROM\ migrations* ]]; then
    if [[ "${APPLIED_RC:-0}" -ne 0 ]]; then
      printf '%s\n' "$APPLIED"
      return "$APPLIED_RC"
    fi
    printf '%s\n' "$APPLIED"
    return 0
  fi
  return 0
}
stage_attempted_blobs "$C_OLD" || bad r4-confirm-setup
APPLIED=100
APPLIED_RC=0
commit_attempted_blobs || bad r4-confirm-setup
cp -p "$(applied_blobs_file)" "$tmp/r4fix/base.applied"
stage_attempted_blobs "$C_TRY" || bad r4-confirm-setup
cp -p "$(attempted_blobs_file)" "$tmp/r4fix/try.attempt"
APPLIED=100
reconcile_attempted_after_interruption
rc=$?
if [[ "$rc" -eq 0 ]] && cmp -s "$tmp/r4fix/base.applied" "$(applied_blobs_file)" \
  && cmp -s "$tmp/r4fix/try.attempt" "$(attempted_blobs_file)"; then
  ok r4-confirm-none
else
  bad r4-confirm-none
fi
APPLIED=$'100\n200'
reconcile_attempted_after_interruption
rc=$?
{
  cat "$tmp/r4fix/base.applied"
  grep '^ts=200 ' "$tmp/r4fix/try.attempt"
} > "$tmp/r4fix/partial.expected"
cp -p "$(applied_blobs_file)" "$tmp/r4fix/partial.applied"
if [[ "$rc" -eq 0 ]] && cmp -s "$tmp/r4fix/partial.expected" "$(applied_blobs_file)" \
  && ! grep -q '^ts=300 ' "$(applied_blobs_file)" \
  && grep -q '^ts=300 ' "$(attempted_blobs_file)"; then
  ok r4-confirm-partial
else
  bad r4-confirm-partial
fi
cp -p "$tmp/r4fix/base.applied" "$(applied_blobs_file)"
cp -p "$tmp/r4fix/try.attempt" "$(attempted_blobs_file)"
APPLIED=$'100\n200\n300'
reconcile_attempted_after_interruption
rc=$?
{
  cat "$tmp/r4fix/base.applied"
  grep '^ts=200 ' "$tmp/r4fix/try.attempt"
  grep '^ts=300 ' "$tmp/r4fix/try.attempt"
} > "$tmp/r4fix/complete.expected"
if [[ "$rc" -eq 0 ]] && cmp -s "$tmp/r4fix/complete.expected" "$(applied_blobs_file)"; then
  ok r4-confirm-complete
else
  bad r4-confirm-complete
fi
cp -p "$tmp/r4fix/partial.applied" "$(applied_blobs_file)"
cp -p "$tmp/r4fix/try.attempt" "$(attempted_blobs_file)"
APPLIED=$'100\n200'
if guard_migration_evidence "$C_RETRY"; then
  guard_rc=0
else
  guard_rc=$?
fi
if guard_migration_evidence "$C_BAD"; then
  bad_rc=0
else
  bad_rc=$?
fi
if [[ "$guard_rc" -eq 0 && "$bad_rc" -eq 10 ]] \
  && cmp -s "$tmp/r4fix/partial.applied" "$(applied_blobs_file)"; then
  ok r4-unapplied-change-is-not-applied-guard
else
  bad r4-unapplied-change-is-not-applied-guard
fi
saved="$(cat "$(applied_blobs_file)")"
APPLIED='relation "migrations" does not exist'
APPLIED_RC=2
reconcile_attempted_after_interruption
rc=$?
APPLIED_RC=0
APPLIED=$'100\nnope'
reconcile_attempted_after_interruption
malformed_rc=$?
APPLIED=999
reconcile_attempted_after_interruption
unknown_rc=$?
if [[ "$rc" -eq 10 && "$malformed_rc" -eq 10 && "$unknown_rc" -eq 10 ]] \
  && [[ "$(cat "$(applied_blobs_file)")" == "$saved" ]]; then
  ok r4-invalid-evidence-preserves-ledger
else
  bad r4-invalid-evidence-preserves-ledger
fi
cp -p "$tmp/r4fix/partial.applied" "$(applied_blobs_file)"
stage_attempted_blobs "$C_CONFLICT" || bad r4-conflict-setup
APPLIED=$'100\n200'
reconcile_attempted_after_interruption
rc=$?
if [[ "$rc" -eq 10 ]] && cmp -s "$tmp/r4fix/partial.applied" "$(applied_blobs_file)"; then
  ok r4-conflict-preserves-ledger
else
  bad r4-conflict-preserves-ledger
fi
unset -f git_as_owner runuser

# R6: npm ci is entered before the fault returns, and case ids survive continuation.
AISB_ROOT="$tmp/npm-root"
AISB_ETC="$tmp/npm-etc"
mkdir -p "$AISB_ROOT" "$AISB_ETC"
printf 'DISPOSABLE_NAMESPACE=1\nFAULT=prepare-build\n' > "$AISB_ETC/ops-test-mode"
chmod 600 "$AISB_ETC/ops-test-mode"
stat() {
  case "$*" in
    *%u*) printf '%s\n' 0 ;;
    *%a*) printf '%s\n' 600 ;;
    *) command stat "$@" ;;
  esac
}
require_node24() { printf '%s\n' v24.0.0; }
assert_no_dotenv() { return 0; }
runuser() {
  printf '%s\n' "$*" >> "$tmp/npm-cmds"
  if [[ "$*" == *npm* ]]; then
    printf '%s\n' npm-ci-started
    sleep 2
  fi
}
AISB_NPM_INTERRUPT_DELAY=0
if checkout_and_build 1111111111111111111111111111111111111111; then
  bad r6-npm-ci-interrupted
elif grep -q 'npm --prefix' "$tmp/npm-cmds" \
  && grep -q 'npm-ci-started' "$AISB_ETC/prepare-npm-ci.log" \
  && grep -q 'state=stopped' "$AISB_ETC/prepare-npm-ci.interrupted"; then
  ok r6-npm-ci-interrupted
else
  bad r6-npm-ci-interrupted
fi
rm -f -- "$tmp/npm-cmds" "$AISB_ETC/prepare-npm-ci.interrupted" "$AISB_ETC/prepare-npm-ci.log"
runuser() {
  printf '%s\n' "$*" >> "$tmp/npm-cmds"
  if [[ "$*" == *npm* ]]; then
    printf '%s\n' npm-ci-finished
    return 0
  fi
}
if checkout_and_build 1111111111111111111111111111111111111111; then
  bad r6-npm-already-finished
elif [[ -e "$AISB_ETC/prepare-npm-ci.interrupted" ]]; then
  bad r6-npm-already-finished
elif grep -q 'npm --prefix' "$tmp/npm-cmds"; then
  ok r6-npm-already-finished
else
  bad r6-npm-already-finished
fi
unset -f stat require_node24 assert_no_dotenv runuser
# shellcheck source=/dev/null
source "$HERE/../lib/case-helpers.sh"
AISB_CASE_EVIDENCE="$tmp/case-evidence"
AISB_ETC="$tmp/case-etc"
mkdir -p "$AISB_ETC"
printf 'FAULT=mutating\nDISPOSABLE_NAMESPACE=1\n' > "$AISB_ETC/ops-test-mode"
id_a="$(case_evidence "$(case_run_id t2.3)")"
id_b="$(case_evidence "$(case_run_id t2.3-rollback)")"
id_c="$(case_evidence "$(case_run_id t1.4)")"
id_d="$(case_evidence "$(case_run_id t1.4-after-reboot)")"
id_e="$(case_evidence "$(case_run_id t2.5-source)")"
id_f="$(case_evidence "$(case_run_id t2.5-source-recheck)")"
clear_injected_fault
if [[ "$id_a" == "$id_b" && "$id_c" == "$id_d" && "$id_e" == "$id_f" ]] \
  && grep -qx 'DISPOSABLE_NAMESPACE=1' "$AISB_ETC/ops-test-mode" \
  && ! grep -q '^FAULT=' "$AISB_ETC/ops-test-mode"; then
  ok r6-case-continuation-cleanup
else
  bad r6-case-continuation-cleanup
fi

printf 'regression pass=%s fail=%s\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
