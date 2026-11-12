#!/bin/bash
# backup_prune_retention with temporary directories and a fixed epoch. Needs no root.
# Touches nothing outside its temporary directory. Does not start a service.
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

D=86400
NOW=$(date -u -d '2026-11-13 00:00:00' +%s)
SECRET=retention-test-content-must-not-print
OLD_MTIME='2020-01-01 00:00:00 UTC'

tsago() { date -u -d "@$((NOW - $1))" +%Y%m%dT%H%M%SZ; }

# Real symlinks where the platform makes them; otherwise the link check is mocked by a list of paths.
FAKE_LINKS="$tmp/fake-links"
: > "$FAKE_LINKS"
REAL_LINKS=0
mkdir -p "$tmp/probe/target"
if ln -s "$tmp/probe/target" "$tmp/probe/link" 2>/dev/null && [[ -L "$tmp/probe/link" ]]; then
  REAL_LINKS=1
fi
rm -rf -- "$tmp/probe"
if [[ "$REAL_LINKS" -eq 0 ]]; then
  printf 'NOTE symlinks unavailable here; link detection mocked by path list\n'
  backup_retention_is_link() {
    [[ -L "$1" ]] && return 0
    grep -qxF -- "$1" "$FAKE_LINKS"
  }
fi

# mklink <target-kind dir|file> <link-path>: a symlink to a target outside the backup dirs, or a mocked one.
mklink() {
  local kind="$1" link="$2" target
  target="$tmp/outside/$(basename -- "$link")"
  mkdir -p "$tmp/outside"
  if [[ "$kind" == dir ]]; then
    mkdir -p "$target"
    printf 'kind=nightly\n%s\n' "$SECRET" > "$target/MANIFEST"
  else
    printf '%s\n' "$SECRET" > "$target"
  fi
  if [[ "$REAL_LINKS" -eq 1 ]]; then
    ln -s "$target" "$link"
  else
    if [[ "$kind" == dir ]]; then
      mkdir -p "$link"
      printf 'kind=nightly\n%s\n' "$SECRET" > "$link/MANIFEST"
    else
      printf '%s\n' "$SECRET" > "$link"
    fi
    printf '%s\n' "$link" >> "$FAKE_LINKS"
  fi
}

# mkset <dir> <kind|-> [mtime]: a backup set directory; kind - means no MANIFEST.
mkset() {
  local dir="$1" kind="$2" mtime="${3:-}"
  mkdir -p "$dir"
  printf 'COMPLETE\n' > "$dir/COMPLETE"
  printf '%s\n' "$SECRET" > "$dir/payload"
  if [[ "$kind" != "-" ]]; then
    printf 'sha=abc\nkind=%s\n' "$kind" > "$dir/MANIFEST"
  fi
  if [[ -n "$mtime" ]]; then
    touch -d "$mtime" "$dir"
  else
    touch -d "@$NOW" "$dir"
  fi
}

# mkfile <path> [mtime]
mkfile() {
  local path="$1" mtime="${2:-}"
  printf '%s\n' "$SECRET" > "$path"
  if [[ -n "$mtime" ]]; then
    touch -d "$mtime" "$path"
  else
    touch -d "@$NOW" "$path"
  fi
}

# mkbundle <dir> <ts> [mtime]: <ts>.tar.age with its identity file.
mkbundle() {
  mkfile "$1/$2.tar.age" "${3:-}"
  mkfile "$1/$2.identity" "${3:-}"
}

kept() {
  local name="$1" path="$2"
  if [[ -e "$path" || -L "$path" ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'missing: %s\n' "$path" >&2
  fi
}

gone() {
  local name="$1" path="$2"
  if [[ ! -e "$path" && ! -L "$path" ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'still present: %s\n' "$path" >&2
  fi
}

run_prune() {
  set +e
  backup_prune_retention "$@" >"$tmp/out" 2>"$tmp/err"
  rc=$?
  set -e
}

summary_is() {
  local name="$1" want="$2"
  if grep -qxF -- "aisandbox-ops: retention deleted ${want}" "$tmp/err"; then
    ok "$name"
  else
    bad "$name"
    printf 'err:\n' >&2
    cat "$tmp/err" >&2 || true
  fi
}

# ---- Scenario 1: every rule, the boundaries, partials, symlinks, odd names, mtime ignored ----
B="$tmp/s1/backups"
O="$tmp/s1/offhost"
mkdir -p "$B" "$O"
export AISB_BACKUPS="$B" AISB_OFFHOST="$O"

# Nightly sets: ten, two of them without MANIFEST kind; mtimes contradict the names on purpose.
n1=$(tsago $((1 * D)));  mkset "$B/$n1" nightly "$OLD_MTIME"
n2=$(tsago $((2 * D)));  mkset "$B/$n2" nightly
n3=$(tsago $((3 * D)));  mkset "$B/$n3" -
n4=$(tsago $((4 * D)));  mkset "$B/$n4" nightly
n5=$(tsago $((5 * D)));  mkset "$B/$n5" nightly
n6=$(tsago $((6 * D)));  mkset "$B/$n6" nightly
n7=$(tsago $((7 * D)));  mkset "$B/$n7" nightly
n8=$(tsago $((8 * D)));  mkset "$B/$n8" nightly
n9=$(tsago $((9 * D)));  mkset "$B/$n9" -
n10=$(tsago $((40 * D))); mkset "$B/$n10" nightly
# Pre-migration sets: not counted among the seven; deleted only when older than 30 days.
p1=$(tsago $((2 * D + 100)));  mkset "$B/$p1" pre-migration
p2=$(tsago $((30 * D)));       mkset "$B/$p2" pre-migration
p3=$(tsago $((30 * D + 1)));   mkset "$B/$p3" pre-migration
p4=$(tsago $((45 * D)));       mkset "$B/$p4" pre-migration
p5=$(tsago $((10 * D + 7)));   mkset "$B/$p5" pre-migration "$OLD_MTIME"
# Failed sets: deleted when older than 30 days, whatever their kind.
f1=$(tsago $((5 * D)));        mkset "$B/$f1.failed" nightly "$OLD_MTIME"
f2=$(tsago $((30 * D)));       mkset "$B/$f2.failed" -
f3=$(tsago $((30 * D + 1)));   mkset "$B/$f3.failed" nightly
f4=$(tsago $((400 * D)));      mkset "$B/$f4.failed" pre-migration
# Never touched: partial sets, symlinks, odd names, unparseable timestamps, non-directories.
old=$(tsago $((400 * D + 11)))
old2=$(tsago $((400 * D + 12)))
mkset "$B/$(tsago $((60 * D))).partial" nightly "$OLD_MTIME"
mkset "$B/$old.failed.partial" nightly "$OLD_MTIME"
mklink dir "$B/$(tsago $((500 * D)))"
mklink dir "$B/$(tsago $((500 * D + 1))).failed"
mkset "$B/$old.bak" nightly "$OLD_MTIME"
mkset "$B/x$old" nightly "$OLD_MTIME"
mkset "$B/$old.failed.old" nightly "$OLD_MTIME"
mkset "$B/$old.FAILED" nightly "$OLD_MTIME"
mkset "$B/${old%Z}z" nightly "$OLD_MTIME"
mkset "$B/2025010T000000Z" nightly "$OLD_MTIME"
mkset "$B/20251301T000000Z" pre-migration "$OLD_MTIME"
mkset "$B/20260230T000000Z.failed" nightly "$OLD_MTIME"
mkset "$B/20250101T240000Z" pre-migration "$OLD_MTIME"
mkdir -p "$B/records/deploy-$old"
mkfile "$B/$old2" "$OLD_MTIME"
mkfile "$B/$old2.failed" "$OLD_MTIME"

# Off-host bundles with identity files.
b1=$(tsago $((1 * D)));        mkbundle "$O" "$b1" "$OLD_MTIME"
b2=$(tsago $((10 * D)));       mkbundle "$O" "$b2"
b3=$(tsago $((28 * D)));       mkbundle "$O" "$b3"
b4=$(tsago $((28 * D + 1)));   mkbundle "$O" "$b4"
b5=$(tsago $((40 * D)));       mkbundle "$O" "$b5"
b6=$(tsago $((2 * D)));        mkbundle "$O" "$b6" "$OLD_MTIME"
# Orphan identity files.
o1=$(tsago $((28 * D + 2)));   mkfile "$O/$o1.identity"
o2=$(tsago $((27 * D)));       mkfile "$O/$o2.identity"
o3=$(tsago $((5 * D + 100)));  mkfile "$O/$o3.identity" "$OLD_MTIME"
# Never touched.
op=$(tsago $((60 * D)));       mkfile "$O/$op.tar.age.partial" "$OLD_MTIME"
ol=$(tsago $((100 * D)))
mklink file "$O/$ol.tar.age"
mklink file "$O/$ol.identity"
ols=$(tsago $((100 * D + 5)))
mklink file "$O/$ols.tar.age"
mkfile "$O/$ols.identity" "$OLD_MTIME"
mkfile "$O/$old.tar.age.bak" "$OLD_MTIME"
mkfile "$O/$old.tar.gz" "$OLD_MTIME"
mkfile "$O/$old.TAR.AGE" "$OLD_MTIME"
mkfile "$O/x$old.tar.age" "$OLD_MTIME"
mkfile "$O/notes.txt" "$OLD_MTIME"
mkfile "$O/20261332T000000Z.tar.age" "$OLD_MTIME"
mkfile "$O/20261332T000000Z.identity" "$OLD_MTIME"
mkfile "$O/20251301T000000Z.identity" "$OLD_MTIME"
mkdir -p "$O/$old2.tar.age"

run_prune "$NOW"
if [[ "$rc" -eq 0 ]]; then ok s1-returns-zero; else bad s1-returns-zero; cat "$tmp/err" >&2; fi

kept nightly-newest-1-kept-despite-old-mtime "$B/$n1"
kept nightly-2-kept "$B/$n2"
kept nightly-3-no-kind-kept "$B/$n3"
kept nightly-4-kept "$B/$n4"
kept nightly-5-kept "$B/$n5"
kept nightly-6-kept "$B/$n6"
kept nightly-7-kept-pre-migration-not-counted "$B/$n7"
gone nightly-8-deleted "$B/$n8"
gone nightly-9-no-kind-deleted "$B/$n9"
gone nightly-oldest-deleted-despite-fresh-mtime "$B/$n10"

kept pre-migration-2d-kept "$B/$p1"
kept pre-migration-exactly-30d-kept "$B/$p2"
gone pre-migration-30d-plus-1s-deleted "$B/$p3"
gone pre-migration-45d-deleted-despite-fresh-mtime "$B/$p4"
kept pre-migration-10d-kept-despite-old-mtime "$B/$p5"

kept failed-5d-kept-despite-old-mtime "$B/$f1.failed"
kept failed-exactly-30d-kept "$B/$f2.failed"
gone failed-30d-plus-1s-deleted "$B/$f3.failed"
gone failed-400d-pre-migration-kind-deleted "$B/$f4.failed"

kept partial-set-untouched "$B/$(tsago $((60 * D))).partial"
kept failed-partial-untouched "$B/$old.failed.partial"
kept symlink-set-untouched "$B/$(tsago $((500 * D)))"
kept symlink-failed-untouched "$B/$(tsago $((500 * D + 1))).failed"
if [[ "$REAL_LINKS" -eq 1 ]]; then
  if [[ -L "$B/$(tsago $((500 * D)))" && -f "$tmp/outside/$(tsago $((500 * D)))/MANIFEST" ]]; then
    ok symlink-set-target-untouched
  else
    bad symlink-set-target-untouched
  fi
fi
kept odd-bak-untouched "$B/$old.bak"
kept odd-prefix-untouched "$B/x$old"
kept odd-failed-old-untouched "$B/$old.failed.old"
kept odd-upper-failed-untouched "$B/$old.FAILED"
kept odd-lower-z-untouched "$B/${old%Z}z"
kept odd-short-untouched "$B/2025010T000000Z"
kept unparseable-month-untouched "$B/20251301T000000Z"
kept unparseable-day-failed-untouched "$B/20260230T000000Z.failed"
kept unparseable-hour-untouched "$B/20250101T240000Z"
kept records-untouched "$B/records/deploy-$old"
kept regular-file-named-like-set-untouched "$B/$old2"
kept regular-file-named-like-failed-untouched "$B/$old2.failed"

kept bundle-newest-kept "$O/$b1.tar.age"
kept bundle-newest-identity-kept "$O/$b1.identity"
kept bundle-10d-kept "$O/$b2.tar.age"
kept bundle-exactly-28d-kept "$O/$b3.tar.age"
kept bundle-exactly-28d-identity-kept "$O/$b3.identity"
gone bundle-28d-plus-1s-deleted "$O/$b4.tar.age"
gone bundle-28d-plus-1s-identity-deleted "$O/$b4.identity"
gone bundle-40d-deleted "$O/$b5.tar.age"
gone bundle-40d-identity-deleted "$O/$b5.identity"
kept bundle-2d-kept-despite-old-mtime "$O/$b6.tar.age"
gone orphan-identity-28d-plus-2s-deleted "$O/$o1.identity"
kept orphan-identity-27d-kept "$O/$o2.identity"
kept orphan-identity-5d-kept "$O/$o3.identity"
kept bundle-partial-untouched "$O/$op.tar.age.partial"
kept symlink-bundle-untouched "$O/$ol.tar.age"
kept symlink-identity-untouched "$O/$ol.identity"
kept identity-beside-symlink-bundle-untouched "$O/$ols.identity"
if [[ "$REAL_LINKS" -eq 1 ]]; then
  if [[ -L "$O/$ol.tar.age" && -f "$tmp/outside/$ol.tar.age" && -f "$tmp/outside/$ol.identity" ]]; then
    ok symlink-bundle-target-untouched
  else
    bad symlink-bundle-target-untouched
  fi
fi
kept odd-bundle-bak-untouched "$O/$old.tar.age.bak"
kept odd-bundle-gz-untouched "$O/$old.tar.gz"
kept odd-bundle-upper-untouched "$O/$old.TAR.AGE"
kept odd-bundle-prefix-untouched "$O/x$old.tar.age"
kept odd-notes-untouched "$O/notes.txt"
kept unparseable-bundle-untouched "$O/20261332T000000Z.tar.age"
kept unparseable-bundle-identity-untouched "$O/20261332T000000Z.identity"
kept unparseable-orphan-identity-untouched "$O/20251301T000000Z.identity"
kept directory-named-like-bundle-untouched "$O/$old2.tar.age"

summary_is s1-summary "12 (nightly sets 3, pre-migration sets 2, failed sets 2, off-host bundles 2, identity files 3)"
deletions=$(grep -c '^aisandbox-ops: retention deleted [a-z]' "$tmp/err" || true)
if [[ "$deletions" -eq 12 ]]; then ok s1-one-note-per-deletion; else bad s1-one-note-per-deletion; printf 'notes=%s\n' "$deletions" >&2; fi
if grep -qxF "aisandbox-ops: retention deleted off-host bundle $b4.tar.age" "$tmp/err" \
  && grep -qxF "aisandbox-ops: retention deleted identity file $b4.identity" "$tmp/err" \
  && grep -qxF "aisandbox-ops: retention deleted orphan identity file $o1.identity" "$tmp/err" \
  && grep -qxF "aisandbox-ops: retention deleted nightly set $n10" "$tmp/err" \
  && grep -qxF "aisandbox-ops: retention deleted pre-migration set $p3" "$tmp/err" \
  && grep -qxF "aisandbox-ops: retention deleted failed set $f3.failed" "$tmp/err"; then
  ok s1-notes-name-each-item
else
  bad s1-notes-name-each-item
  cat "$tmp/err" >&2 || true
fi
if grep -qF "$SECRET" "$tmp/err" "$tmp/out"; then bad s1-no-file-contents-printed; else ok s1-no-file-contents-printed; fi
if [[ ! -s "$tmp/out" ]]; then ok s1-nothing-on-stdout; else bad s1-nothing-on-stdout; fi
if grep -qF "$SECRET" "$B/$n1/payload" && grep -qF "$SECRET" "$O/$b1.tar.age"; then
  ok s1-kept-contents-intact
else
  bad s1-kept-contents-intact
fi

run_prune "$NOW"
if [[ "$rc" -eq 0 ]]; then ok s1-second-run-returns-zero; else bad s1-second-run-returns-zero; fi
summary_is s1-second-run-deletes-nothing "0 (nightly sets 0, pre-migration sets 0, failed sets 0, off-host bundles 0, identity files 0)"

# ---- Scenario 1b: orphan identity files at the exact 28-day boundary ----
B="$tmp/s1b/backups"
O="$tmp/s1b/offhost"
mkdir -p "$B" "$O"
export AISB_BACKUPS="$B" AISB_OFFHOST="$O"
g0=$(tsago $((1 * D)));       mkbundle "$O" "$g0"
g1=$(tsago $((28 * D)));      mkfile "$O/$g1.identity"
g2=$(tsago $((28 * D + 1)));  mkfile "$O/$g2.identity"
run_prune "$NOW"
if [[ "$rc" -eq 0 ]]; then ok s1b-returns-zero; else bad s1b-returns-zero; fi
kept orphan-identity-exactly-28d-kept "$O/$g1.identity"
gone orphan-identity-28d-plus-1s-deleted "$O/$g2.identity"
kept s1b-bundle-kept "$O/$g0.tar.age"
summary_is s1b-summary "1 (nightly sets 0, pre-migration sets 0, failed sets 0, off-host bundles 0, identity files 1)"

# ---- Scenario 2: the newest bundle is kept even when it is older than 28 days ----
B="$tmp/s2/backups"
O="$tmp/s2/offhost"
mkdir -p "$B" "$O"
export AISB_BACKUPS="$B" AISB_OFFHOST="$O"
c1=$(tsago $((40 * D))); mkbundle "$O" "$c1"
c2=$(tsago $((50 * D))); mkbundle "$O" "$c2"
c3=$(tsago $((60 * D))); mkfile "$O/$c3.identity"
run_prune "$NOW"
if [[ "$rc" -eq 0 ]]; then ok s2-returns-zero; else bad s2-returns-zero; fi
kept old-newest-bundle-kept "$O/$c1.tar.age"
kept old-newest-bundle-identity-kept "$O/$c1.identity"
gone older-bundle-deleted "$O/$c2.tar.age"
gone older-bundle-identity-deleted "$O/$c2.identity"
gone old-orphan-identity-deleted "$O/$c3.identity"
summary_is s2-summary "3 (nightly sets 0, pre-migration sets 0, failed sets 0, off-host bundles 1, identity files 2)"

B="$tmp/s2b/backups"
O="$tmp/s2b/offhost"
mkdir -p "$B" "$O"
export AISB_BACKUPS="$B" AISB_OFFHOST="$O"
c4=$(tsago $((100 * D))); mkbundle "$O" "$c4"
mkfile "$O/$(tsago $((10 * D))).tar.age.partial"
run_prune "$NOW"
kept only-bundle-100d-kept "$O/$c4.tar.age"
kept only-bundle-100d-identity-kept "$O/$c4.identity"
kept newer-partial-not-counted-as-newest "$O/$(tsago $((10 * D))).tar.age.partial"
summary_is s2b-summary "0 (nightly sets 0, pre-migration sets 0, failed sets 0, off-host bundles 0, identity files 0)"

# ---- Scenario 3: refusals and absent directories ----
B="$tmp/s3/backups"
O="$tmp/s3/offhost"
mkdir -p "$B" "$O"
export AISB_BACKUPS="$B" AISB_OFFHOST="$O"
e1=$(tsago $((100 * D))); mkbundle "$O" "$e1"
e2=$(tsago $((200 * D))); mkbundle "$O" "$e2"
e3=$(tsago $((200 * D))); mkset "$B/$e3.failed" nightly
for args in none empty word two; do
  case "$args" in
    none) run_prune ;;
    empty) run_prune "" ;;
    word) run_prune abc ;;
    two) run_prune "$NOW" "$NOW" ;;
  esac
  if [[ "$rc" -eq 10 ]]; then ok "refuses-bad-now-$args"; else bad "refuses-bad-now-$args"; printf 'rc=%s\n' "$rc" >&2; fi
done
unset AISB_BACKUPS
run_prune "$NOW"
if [[ "$rc" -eq 10 ]]; then ok refuses-without-backups-dir; else bad refuses-without-backups-dir; fi
export AISB_BACKUPS="$B"
unset AISB_OFFHOST
run_prune "$NOW"
if [[ "$rc" -eq 10 ]]; then ok refuses-without-offhost-dir; else bad refuses-without-offhost-dir; fi
kept refusal-deletes-no-bundle "$O/$e2.tar.age"
kept refusal-deletes-no-set "$B/$e3.failed"

export AISB_BACKUPS="$tmp/s3/absent-backups" AISB_OFFHOST="$tmp/s3/absent-offhost"
run_prune "$NOW"
if [[ "$rc" -eq 0 ]]; then ok absent-dirs-return-zero; else bad absent-dirs-return-zero; fi
if [[ ! -e "$tmp/s3/absent-backups" && ! -e "$tmp/s3/absent-offhost" ]]; then ok absent-dirs-not-created; else bad absent-dirs-not-created; fi

# ---- Scenario 4: a symlinked backup root is not followed ----
mkdir -p "$tmp/s4"
mklink dir "$tmp/s4/backups-link"
mkset "$tmp/s4/backups-link/$(tsago $((200 * D))).failed" nightly
if [[ "$REAL_LINKS" -eq 1 ]]; then
  mkdir -p "$tmp/s4/real-offhost"
  ln -s "$tmp/s4/real-offhost" "$tmp/s4/offhost-link"
else
  mkdir -p "$tmp/s4/offhost-link"
  printf '%s\n' "$tmp/s4/offhost-link" >> "$FAKE_LINKS"
fi
mkbundle "$tmp/s4/offhost-link" "$(tsago $((100 * D)))"
mkbundle "$tmp/s4/offhost-link" "$(tsago $((200 * D)))"
export AISB_BACKUPS="$tmp/s4/backups-link" AISB_OFFHOST="$tmp/s4/offhost-link"
run_prune "$NOW"
if [[ "$rc" -eq 0 ]]; then ok symlink-roots-return-zero; else bad symlink-roots-return-zero; fi
kept symlink-root-set-untouched "$tmp/s4/backups-link/$(tsago $((200 * D))).failed"
kept symlink-root-bundle-untouched "$tmp/s4/offhost-link/$(tsago $((200 * D))).tar.age"

# ---- Scenario 5: the backup entry point prunes only after a successful backup ----
order_ok() {
  local file="$ROOT/bin/aisandbox-backup" n_done n_prune n_exit
  n_done=$(grep -n -F 'note "backup complete ${final}"' "$file" | head -n 1 | cut -d: -f1 || true)
  n_prune=$(grep -n -F 'backup_prune_retention "$(date -u +%s)"' "$file" | head -n 1 | cut -d: -f1 || true)
  n_exit=$(grep -n -x -F 'exit 0' "$file" | tail -n 1 | cut -d: -f1 || true)
  if [[ -n "$n_done" && -n "$n_prune" && -n "$n_exit" && "$n_done" -lt "$n_prune" && "$n_prune" -lt "$n_exit" ]]; then
    ok entry-point-prunes-after-complete
  else
    bad entry-point-prunes-after-complete
  fi
  if grep -n -E -- '-mtime|rm -rf' "$file" >/dev/null; then
    bad entry-point-has-no-own-pruning
  else
    ok entry-point-has-no-own-pruning
  fi
}
order_ok

run_backup() {
  local name="$1" want="$2" dir="$3"
  local rc
  printf ':\n' > "$dir/stub.sh"
  set +e
  (
    set -euo pipefail
    export AISB_BACKUPS="$dir/backups" AISB_OFFHOST="$dir/offhost" AISB_OPS_LIB="$dir/stub.sh"
    export AISB_MARKER="$dir/state/maintenance" AISB_OP="$dir/state/current-op" AISB_LOCK="$dir/state/lock"
    export AISB_ETC="$dir/etc" AISB_ROOT="$dir/root" TRACE="$dir/trace"
    : > "$TRACE"
    ops_require_root() { return 0; }
    ops_refuse_override() { return 0; }
    ops_lock() { printf 'lock\n' >> "$TRACE"; return 0; }
    op_begin() { return 0; }
    op_set() { return 0; }
    op_field() { printf '\n'; }
    quiesce_and_stop() { printf 'quiesce\n' >> "$TRACE"; return 0; }
    marker_set_phase() { return 0; }
    marker_remove() { printf 'remove\n' >> "$TRACE"; return 0; }
    start_units_after_marker_removed() { printf 'start %s\n' "$*" >> "$TRACE"; return 0; }
    health_wait() { return 0; }
    backup_write_set() {
      printf 'write\n' >> "$TRACE"
      if [[ "${MOCK_FAIL:-0}" -eq 1 ]]; then
        return 20
      fi
      printf 'sha=abc\nkind=nightly\n' > "$1/MANIFEST"
      printf 'COMPLETE\n' > "$1/COMPLETE"
      mkdir -p "$AISB_OFFHOST"
      printf 'bundle\n' > "$AISB_OFFHOST/${AISB_BACKUP_TS}.tar.age"
      printf 'sha=abc\n' > "$AISB_OFFHOST/${AISB_BACKUP_TS}.identity"
    }
    set --
    # shellcheck source=/dev/null
    source "$ROOT/bin/aisandbox-backup"
  ) >"$dir/out" 2>"$dir/err"
  rc=$?
  set -e
  if [[ "$rc" -eq "$want" ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s want=%s\n' "$rc" "$want" >&2
    cat "$dir/err" >&2 || true
  fi
}

seed_e2e() {
  local dir="$1" day
  mkdir -p "$dir/backups" "$dir/offhost" "$dir/state" "$dir/etc"
  for day in 1 2 3 4 5 6 7 8; do
    mkset "$dir/backups/2021010${day}T000000Z" nightly "$OLD_MTIME"
  done
  mkset "$dir/backups/20210201T000000Z.failed" nightly "$OLD_MTIME"
  mkbundle "$dir/offhost" 20200101T000000Z "$OLD_MTIME"
}

E="$tmp/s5ok"
seed_e2e "$E"
MOCK_FAIL=0 run_backup entry-point-success-returns-zero 0 "$E"
gone entry-point-oldest-nightly-deleted "$E/backups/20210101T000000Z"
gone entry-point-second-oldest-nightly-deleted "$E/backups/20210102T000000Z"
kept entry-point-third-oldest-nightly-kept "$E/backups/20210103T000000Z"
gone entry-point-old-failed-deleted "$E/backups/20210201T000000Z.failed"
gone entry-point-old-bundle-deleted "$E/offhost/20200101T000000Z.tar.age"
gone entry-point-old-identity-deleted "$E/offhost/20200101T000000Z.identity"
newset=$(find "$E/backups" -mindepth 1 -maxdepth 1 -type d -name '20*' ! -name '2021*' | wc -l | tr -d ' ')
newbundle=$(find "$E/offhost" -mindepth 1 -maxdepth 1 -type f -name '*.tar.age' | wc -l | tr -d ' ')
if [[ "$newset" -eq 1 && "$newbundle" -eq 1 ]]; then ok entry-point-new-copies-kept; else bad entry-point-new-copies-kept; fi
n_done=$(grep -n -F 'backup complete' "$E/err" | head -n 1 | cut -d: -f1 || true)
n_sum=$(grep -n -F 'retention deleted 5 (' "$E/err" | head -n 1 | cut -d: -f1 || true)
if [[ -n "$n_done" && -n "$n_sum" && "$n_done" -lt "$n_sum" ]]; then ok entry-point-summary-after-complete; else bad entry-point-summary-after-complete; cat "$E/err" >&2 || true; fi

E="$tmp/s5fail"
seed_e2e "$E"
MOCK_FAIL=1 run_backup entry-point-failure-returns-20 20 "$E"
kept entry-point-failure-keeps-oldest-nightly "$E/backups/20210101T000000Z"
kept entry-point-failure-keeps-failed "$E/backups/20210201T000000Z.failed"
kept entry-point-failure-keeps-bundle "$E/offhost/20200101T000000Z.tar.age"
if grep -qF 'retention' "$E/err"; then bad entry-point-failure-no-retention; else ok entry-point-failure-no-retention; fi

printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
