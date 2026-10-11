#!/bin/bash
# Mocked inventory selection. Sources the implementation. Does not run operational cases.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=/dev/null
source "$HERE/../../lib/ops-lib.sh"
PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); printf 'PASS %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1" >&2; }
tmp=$(mktemp -d)
cleanup() { rm -rf -- "$tmp"; }
trap cleanup EXIT

PREFIX=services/api-gateway/src/migrations
README=$PREFIX/README.md
SPEC=$PREFIX/__tests__/200-AddM.spec.ts
P100=$PREFIX/100-Base.ts
P200=$PREFIX/200-AddM.ts
P1000=$PREFIX/1000-Other.ts
DESC=$PREFIX/about-100.md
NOTES=$PREFIX/notes.ts
DOC=$PREFIX/NOTES.md
BLOB100=1111111111111111111111111111111111111111
BLOB200=2222222222222222222222222222222222222222
BLOB200B=3333333333333333333333333333333333333333
BLOBDOC=4444444444444444444444444444444444444444
COMMIT=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
OTHER=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
AISB_OP=$tmp/current-op
: > "$AISB_OP"
APPLIED=$'100\n200'
GIT_RC=0
MODE=tree

git_as_owner() {
  if [[ "$GIT_RC" -ne 0 ]]; then
    return "$GIT_RC"
  fi
  case "$MODE" in
    tree)
      case "$*" in
        *name-only*)
          printf '%s\n' "$README" "$SPEC" "$P100" "$P200"
          ;;
        ls-tree*)
          printf '100644 blob %s %s\n' "$BLOBDOC" "$README"
          printf '100644 blob %s %s\n' "$BLOB200" "$SPEC"
          printf '100644 blob %s %s\n' "$BLOB100" "$P100"
          printf '100644 blob %s %s\n' "$BLOB200" "$P200"
          ;;
        *) return 1 ;;
      esac
      ;;
    malformed)
      case "$*" in
        *name-only*) printf '%s\n' "$P100" "$NOTES" ;;
        ls-tree*)
          printf '100644 blob %s %s\n' "$BLOB100" "$P100"
          printf '100644 blob %s %s\n' "$BLOBDOC" "$NOTES"
          ;;
        *) return 1 ;;
      esac
      ;;
    docs-only)
      printf 'M\t%s\nA\t%s\n' "$README" "$DOC"
      ;;
    added)
      printf 'M\t%s\nA\t%s\n' "$README" "$P200"
      ;;
    exact)
      printf '%s\n' "$P100" "$P1000" "$DESC" "$README"
      ;;
    prefix)
      printf '%s\n' "$P1000" "$DESC" "$README"
      ;;
    rename-to-doc)
      printf 'R100\t%s\t%s\n' "$P100" "$README"
      ;;
    rename-docs)
      printf 'R100\t%s\t%s\n' "$README" "$DOC"
      ;;
    copy-to-doc)
      printf 'C100\t%s\t%s\n' "$P100" "$README"
      ;;
    delete-mig)
      printf 'D\t%s\n' "$P100"
      ;;
    *) return 1 ;;
  esac
}
runuser() {
  if [[ "$*" == *timestamp\ FROM\ migrations* ]]; then
    if [[ "${QUERY_RC:-0}" -ne 0 ]]; then
      printf '%s\n' 'query failed'
      return "$QUERY_RC"
    fi
    printf '%s\n' "$APPLIED"
    return 0
  fi
  return 0
}

if stage_attempted_blobs "$COMMIT"; then
  ledger="$(attempted_blobs_file)"
  if [[ "$(grep -c '^ts=' "$ledger")" -eq 2 ]] \
    && grep -q "^ts=100 blob=${BLOB100} path=${P100} " "$ledger" \
    && grep -q "^ts=200 blob=${BLOB200} path=${P200} " "$ledger" \
    && ! grep -q 'README.md' "$ledger" \
    && ! grep -q '__tests__' "$ledger"; then
    ok inventory-selects-executable
  else
    bad inventory-selects-executable
  fi
else
  bad inventory-selects-executable
fi

count="$(count_executable_migrations "$COMMIT")"
crc=$?
APPLIED=$'100\n200'
if verify_migrations_applied; then
  vrc=0
else
  vrc=$?
fi
if [[ "$crc" -eq 0 && "$count" == "2" && "$vrc" -eq 0 ]]; then
  ok inventory-count-and-verify-agree
else
  bad inventory-count-and-verify-agree
fi

APPLIED=100
if verify_migrations_applied; then
  bad missing-migration-fails
else
  ok missing-migration-fails
fi
APPLIED=$'100\n200'

MODE=docs-only
added="$(count_added_executable_migrations "$COMMIT" "$OTHER")"
arc=$?
if migration_history_protected "$COMMIT" "$OTHER" 0; then
  hrc=0
else
  hrc=$?
fi
if [[ "$arc" -eq 0 && "$added" == "0" && "$hrc" -eq 0 ]]; then
  ok documentation-is-not-an-added-migration
else
  bad documentation-is-not-an-added-migration
fi

MODE=added
added="$(count_added_executable_migrations "$COMMIT" "$OTHER")"
if [[ "$added" == "1" ]] && migration_history_protected "$COMMIT" "$OTHER" 0; then
  ok executable-addition-still-counts
else
  bad executable-addition-still-counts
fi

MODE=malformed
rm -f -- "$(attempted_blobs_file)"
if stage_attempted_blobs "$COMMIT"; then
  bad malformed-executable-fails
elif [[ ! -e "$(attempted_blobs_file)" ]]; then
  ok malformed-executable-fails
else
  bad malformed-executable-fails
fi
if count_executable_migrations "$COMMIT"; then
  bad malformed-count-fails
else
  ok malformed-count-fails
fi

MODE=tree
GIT_RC=7
if stage_attempted_blobs "$COMMIT"; then
  bad git-error-fails-ledger
else
  ok git-error-fails-ledger
fi
if count_added_executable_migrations "$COMMIT" "$OTHER"; then
  bad git-error-fails-added-count
else
  ok git-error-fails-added-count
fi
if migration_history_protected "$COMMIT" "$OTHER" 0; then
  bad git-error-fails-history-guard
else
  ok git-error-fails-history-guard
fi
GIT_RC=0
MODE=tree

QUERY_RC=2
if verify_migrations_applied; then
  bad query-error-fails-verification
else
  ok query-error-fails-verification
fi
QUERY_RC=0

MODE=exact
APPLIED=100
if target_covers_applied_migrations "$COMMIT" 0; then
  ok exact-timestamp-covers
else
  bad exact-timestamp-covers
fi
MODE=prefix
if target_covers_applied_migrations "$COMMIT" 0; then
  bad prefix-and-description-do-not-cover
else
  ok prefix-and-description-do-not-cover
fi
if target_covers_applied_migrations "$COMMIT" 1; then
  ok schema-ahead-allows-missing-timestamp
else
  bad schema-ahead-allows-missing-timestamp
fi
MODE=exact
QUERY_RC=2
if target_covers_applied_migrations "$COMMIT" 1; then
  bad query-error-fails-coverage
else
  ok query-error-fails-coverage
fi
QUERY_RC=0
MODE=malformed
APPLIED=100
if target_covers_applied_migrations "$COMMIT" 0; then
  bad malformed-coverage-fails
else
  ok malformed-coverage-fails
fi

MODE=rename-to-doc
if migration_history_protected "$COMMIT" "$OTHER" 0; then
  bad migration-renamed-to-documentation-fails
else
  ok migration-renamed-to-documentation-fails
fi
if migration_history_protected "$COMMIT" "$OTHER" 1; then
  bad schema-ahead-does-not-permit-rename
else
  ok schema-ahead-does-not-permit-rename
fi
MODE=copy-to-doc
if migration_history_protected "$COMMIT" "$OTHER" 1; then
  bad copy-to-documentation-fails
else
  ok copy-to-documentation-fails
fi
MODE=rename-docs
if migration_history_protected "$COMMIT" "$OTHER" 0; then
  ok documentation-rename-is-ignored
else
  bad documentation-rename-is-ignored
fi
MODE=delete-mig
if migration_history_protected "$COMMIT" "$OTHER" 0; then
  bad deletion-still-requires-approval
else
  ok deletion-still-requires-approval
fi
if migration_history_protected "$COMMIT" "$OTHER" 1; then
  ok approved-deletion-remains-allowed
else
  bad approved-deletion-remains-allowed
fi
MODE=tree
APPLIED=$'100\n200'

# Existing R4 replacement conflict still refuses and keeps the applied blob.
AISB_OP=$tmp/conflict-op
: > "$AISB_OP"
MODE=tree
stage_attempted_blobs "$COMMIT" || bad r4-conflict-setup
APPLIED=$'100\n200'
commit_attempted_blobs || bad r4-conflict-setup
saved="$(cat "$(applied_blobs_file)")"
git_as_owner() {
  printf '100644 blob %s %s\n' "$BLOB100" "$P100"
  printf '100644 blob %s %s\n' "$BLOB200B" "$P200"
  printf '100644 blob %s %s\n' "$BLOBDOC" "$README"
}
if stage_attempted_blobs "$OTHER" && commit_attempted_blobs; then
  bad r4-conflict-still-refuses
elif [[ "$(cat "$(applied_blobs_file)")" == "$saved" ]] \
  && grep -q "^ts=200 blob=${BLOB200} " "$(applied_blobs_file)"; then
  ok r4-conflict-still-refuses
else
  bad r4-conflict-still-refuses
fi

printf 'RESULT pass=%s fail=%s\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
