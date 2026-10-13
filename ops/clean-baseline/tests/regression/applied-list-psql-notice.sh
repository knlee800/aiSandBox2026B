#!/bin/bash
# Shell-only regression: a psql directory notice must not enter the applied list.
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

TS1=1710000000001
TS2=1710000000002
NOTICE='could not change directory to "/home/ubuntu": Permission denied'
AISB_OP="$tmp/op/current-op"
mkdir -p -- "$(dirname -- "$AISB_OP")"
: > "$AISB_OP"
ledger="$(applied_blobs_file)"
{
  printf 'ts=%s blob=%s path=%s source=%s\n' \
    "$TS1" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
    "services/api-gateway/src/migrations/${TS1}-One.ts" \
    bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
  printf 'ts=%s blob=%s path=%s source=%s\n' \
    "$TS2" cccccccccccccccccccccccccccccccccccccccc \
    "services/api-gateway/src/migrations/${TS2}-Two.ts" \
    dddddddddddddddddddddddddddddddddddddddd
} > "$ledger"

MODE=cover
runuser() {
  case "$*" in
    *'timestamp FROM migrations'*)
      printf '%s\n' "$NOTICE" >&2
      case "$MODE" in
        cover)
          printf '%s\n' "$TS1" "$TS2"
          return 0
          ;;
        nonnumeric)
          printf '%s\n' "$TS1" 'not-a-timestamp' "$TS2"
          return 0
          ;;
        status)
          printf '%s\n' "$TS1" "$TS2"
          return 1
          ;;
        *)
          return 99
          ;;
      esac
      ;;
    *)
      return 0
      ;;
  esac
}

MODE=cover
if require_ledger_covers_applied; then
  ok a-ledger-covers-despite-psql-notice
else
  bad a-ledger-covers-despite-psql-notice
fi
if reconcile_attempted_after_interruption; then
  ok b-reconcile-covers-despite-psql-notice
else
  bad b-reconcile-covers-despite-psql-notice
fi

MODE=nonnumeric
if require_ledger_covers_applied; then
  bad c-non-numeric-stdout-still-fails
else
  ok c-non-numeric-stdout-still-fails
fi

MODE=status
if require_ledger_covers_applied; then
  bad d-nonzero-status-still-fails
else
  ok d-nonzero-status-still-fails
fi

printf 'regression pass=%s fail=%s\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
