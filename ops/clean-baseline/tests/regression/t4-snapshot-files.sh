#!/bin/bash
# Planted-file snapshot coverage. Does not run operational scripts, restore, or fixtures.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BASE=$(CDPATH= cd -- "$HERE/../.." && pwd)
# shellcheck source=/dev/null
source "$BASE/lib/ops-lib.sh"
# shellcheck source=/dev/null
source "$BASE/tests/lib/case-helpers.sh"
PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); printf 'PASS %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1" >&2; }
tmp=$(mktemp -d)
cleanup_tmp() { rm -rf -- "$tmp"; }
trap cleanup_tmp EXIT

mkdir -p "$tmp/etc" "$tmp/root/.git" "$tmp/tree"
printf 'REDIS_URL=redis://:secret@127.0.0.1:6379/0\n' > "$tmp/etc/gateway.env"
AISB_ETC="$tmp/etc"
AISB_ROOT="$tmp/root"
planted="$tmp/tree/extra"
printf 'alpha\n' > "$planted"

runuser() {
  case "$*" in
    *" git "*) printf '!! projects/ignored.tmp\n' ;;
    *) printf '\n' ;;
  esac
}
redis-cli() { printf '0\n'; }
systemctl() {
  case "$1" in
    is-enabled) printf 'disabled\n' ;;
    is-active) printf 'inactive\n' ;;
    *) return 0 ;;
  esac
}
find() { printf '%s\n' "$planted"; }
sha256sum() {
  local path
  if [[ "${1:-}" == "--" ]]; then
    path="${2:-}"
    case "$path" in
      "$tmp"/*) command sha256sum -- "$path" ;;
      *) printf 'sha256sum refused %s\n' "$path" >&2; return 1 ;;
    esac
    return
  fi
  local arg
  for arg in "$@"; do
    case "$arg" in
      /etc/aisandbox/*|/var/lib/aisandbox-ops/*)
        printf 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  %s\n' "$arg"
        ;;
      "$tmp"/*) command sha256sum -- "$arg" ;;
      *) printf 'sha256sum refused %s\n' "$arg" >&2; return 1 ;;
    esac
  done
}

listing_body() {
  grep -v -E '^[0-9a-f]{64}[[:space:]]' "$1" || true
}

AISB_SNAPSHOT_FILES="$planted"
prepare_snapshot "$tmp/before"
before_rc=$?
prepare_snapshot "$tmp/after-same"
same_rc=$?
if [[ "$before_rc" -eq 0 && "$same_rc" -eq 0 ]] && assert_same_snapshot "$tmp/before" "$tmp/after-same"; then
  ok t4-snapshot-unchanged-passes
else
  bad t4-snapshot-unchanged-passes
fi

printf 'beta\n' > "$planted"
prepare_snapshot "$tmp/after-changed"
changed_rc=$?
if [[ "$changed_rc" -eq 0 ]] \
  && ! assert_same_snapshot "$tmp/before" "$tmp/after-changed" \
  && cmp -s <(listing_body "$tmp/before") <(listing_body "$tmp/after-changed") \
  && [[ "$(grep -F "$planted" "$tmp/before")" != "$(grep -F "$planted" "$tmp/after-changed")" ]] \
  && grep -qx "!! projects/ignored.tmp" "$tmp/before" \
  && grep -qx "!! projects/ignored.tmp" "$tmp/after-changed" \
  && grep -qx "$planted" "$tmp/before" \
  && grep -qx "$planted" "$tmp/after-changed"; then
  ok t4-snapshot-changed-contents-fail
else
  bad t4-snapshot-changed-contents-fail
fi

rm -f -- "$planted"
prepare_snapshot "$tmp/missing"
missing_rc=$?
if [[ "$missing_rc" -ne 0 && ! -e "$planted" ]]; then
  ok t4-snapshot-missing-file-fails
else
  bad t4-snapshot-missing-file-fails
fi

case_block() {
  local name="$1" line capture=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$capture" -eq 0 && "$line" == "  ${name})" ]]; then
      capture=1
      continue
    fi
    if [[ "$capture" -eq 1 ]]; then
      if [[ "$line" =~ ^\ \ [^[:space:]] ]]; then
        break
      fi
      printf '%s\n' "$line"
    fi
  done < "$BASE/tests/operational/t4-metadata.sh"
}

expect_case() {
  local name="$1" path="$2" block files_at refuse_at unset_at
  block="$(case_block "$name")"
  files_at="$(printf '%s\n' "$block" | grep -n "AISB_SNAPSHOT_FILES=${path}$" | head -n 1 | cut -d: -f1)"
  refuse_at="$(printf '%s\n' "$block" | grep -n 'refuse_with_snapshot' | head -n 1 | cut -d: -f1)"
  unset_at="$(printf '%s\n' "$block" | grep -n 'unset AISB_SNAPSHOT_FILES' | head -n 1 | cut -d: -f1)"
  if [[ -n "$files_at" && -n "$refuse_at" && -n "$unset_at" ]] \
    && [[ "$files_at" -lt "$refuse_at" && "$refuse_at" -lt "$unset_at" ]] \
    && [[ "$(printf '%s\n' "$block" | grep -c "AISB_SNAPSHOT_FILES=${path}$")" -eq 1 ]]; then
    ok "t4-case-${name}"
  else
    bad "t4-case-${name}"
  fi
}

expect_case t4.2-ignored /opt/aisandbox/projects/ignored.tmp
expect_case t4.2-snapshot /opt/aisandbox/services/snapshot-store/extra
expect_case t4.2-snapshot-root /opt/aisandbox/snapshot-store/extra

printf 'planted-file pass=%s fail=%s\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
