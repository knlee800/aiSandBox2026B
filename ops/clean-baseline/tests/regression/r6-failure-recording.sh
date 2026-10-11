#!/bin/bash
# Failure-recording harness. Does not run operational scripts or the fixture builder.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
HELPER="$HERE/../lib/case-helpers.sh"
PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); printf 'PASS %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1" >&2; }
tmp=$(mktemp -d)
remove_dir_alias() {
  local link="$1"
  [[ -L "$link" ]] || return 0
  if command -v cygpath >/dev/null 2>&1 && command -v cmd >/dev/null 2>&1; then
    MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$link")" >/dev/null 2>&1 || return 1
    [[ ! -e "$link" && ! -L "$link" ]] || return 1
    return 0
  fi
  rm -- "$link"
}
make_dir_alias() {
  local link="$1" target="$2"
  rm -rf -- "$link"
  if ln -s -- "$target" "$link" 2>/dev/null && [[ -L "$link" ]]; then
    return 0
  fi
  rm -rf -- "$link"
  if command -v cygpath >/dev/null 2>&1 && command -v cmd >/dev/null 2>&1; then
    MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$link")" "$(cygpath -w "$target")" >/dev/null
    [[ -L "$link" ]]
    return
  fi
  return 1
}
cleanup_tmp() {
  local link
  if [[ -d "$tmp" ]]; then
    while IFS= read -r link; do
      [[ -n "$link" ]] || continue
      remove_dir_alias "$link" || return
    done < <(find "$tmp" -type l -print)
  fi
  if [[ -d "$tmp" ]] && find "$tmp" -type l -print | grep -q .; then
    printf '%s\n' 'refusing to remove a temp tree that still contains a symlink' >&2
    return
  fi
  rm -rf -- "$tmp"
}
trap cleanup_tmp EXIT

write_runner() {
  local file="$1"
  cat > "$file"
  chmod +x "$file"
}

write_runner "$tmp/ordinary.sh" <<EOF
#!/bin/bash
set -u
source "$HELPER"
AISB_OPS_OPERATIONAL_TEST=1
AISB_CASE_RECORDING=1
AISB_CASE_STATE="$tmp/ordinary-state"
AISB_CASE_NAME=ordinary
mkdir -p "\$AISB_CASE_STATE"
printf 'kept\n' > "$tmp/ordinary-evidence"
case_begin ordinary
exit 7
EOF
bash "$tmp/ordinary.sh" >"$tmp/ordinary.out" 2>"$tmp/ordinary.err"
rc=$?
if [[ "$rc" -eq 7 ]] \
  && grep -qx 'case=ordinary' "$tmp/ordinary-state/case-contaminated" \
  && grep -q 'exit 7; cleanup 0;' "$tmp/ordinary-state/case-contaminated" \
  && [[ "$(cat "$tmp/ordinary-evidence")" == "kept" ]]; then
  ok r6-ordinary-failure
else
  bad r6-ordinary-failure
fi

write_runner "$tmp/both.sh" <<EOF
#!/bin/bash
set -u
source "$HELPER"
AISB_OPS_OPERATIONAL_TEST=1
AISB_CASE_RECORDING=1
AISB_CASE_STATE="$tmp/both-state"
mkdir -p "\$AISB_CASE_STATE"
printf 'kept\n' > "$tmp/both-evidence"
case_cleanup() { printf 'called\n' >> "$tmp/both-cleanup"; return 4; }
case_begin both
exit 9
EOF
bash "$tmp/both.sh" >"$tmp/both.out" 2>"$tmp/both.err"
rc=$?
if [[ "$rc" -eq 9 ]] \
  && grep -qx 'case=both' "$tmp/both-state/case-contaminated" \
  && grep -q 'exit 9; cleanup 4;' "$tmp/both-state/case-contaminated" \
  && grep -q 'case cleanup failed rc=4' "$tmp/both.err" \
  && [[ "$(cat "$tmp/both-cleanup")" == "called" ]] \
  && [[ "$(cat "$tmp/both-evidence")" == "kept" ]]; then
  ok r6-cleanup-and-failure
else
  bad r6-cleanup-and-failure
fi

write_runner "$tmp/cleanup-only.sh" <<EOF
#!/bin/bash
set -u
source "$HELPER"
AISB_OPS_OPERATIONAL_TEST=1
AISB_CASE_RECORDING=1
AISB_CASE_STATE="$tmp/cleanup-state"
mkdir -p "\$AISB_CASE_STATE"
printf 'kept\n' > "$tmp/cleanup-evidence"
case_cleanup() { printf 'called\n' >> "$tmp/cleanup-calls"; return 4; }
case_begin cleanup-only
exit 0
EOF
bash "$tmp/cleanup-only.sh" >"$tmp/cleanup.out" 2>"$tmp/cleanup.err"
rc=$?
if [[ "$rc" -eq 4 ]] \
  && grep -q 'exit 0; cleanup 4;' "$tmp/cleanup-state/case-contaminated" \
  && grep -q 'case cleanup failed rc=4' "$tmp/cleanup.err" \
  && [[ "$(cat "$tmp/cleanup-calls")" == "called" ]] \
  && [[ "$(cat "$tmp/cleanup-evidence")" == "kept" ]]; then
  ok r6-cleanup-failure
else
  bad r6-cleanup-failure
fi

write_runner "$tmp/reboot-ok.sh" <<EOF
#!/bin/bash
set -u
source "$HELPER"
reboot() { printf 'called\n' >> "$tmp/reboot-ok-calls"; return 0; }
AISB_OPS_OPERATIONAL_TEST=1
AISB_CASE_RECORDING=1
AISB_CASE_STATE="$tmp/reboot-ok-state"
mkdir -p "\$AISB_CASE_STATE"
printf 'kept\n' > "$tmp/reboot-ok-evidence"
case_begin reboot-ok
case_reboot
EOF
bash "$tmp/reboot-ok.sh" >"$tmp/reboot-ok.out" 2>"$tmp/reboot-ok.err"
rc=$?
if [[ "$rc" -eq 0 ]] \
  && [[ ! -e "$tmp/reboot-ok-state/case-contaminated" ]] \
  && [[ "$(cat "$tmp/reboot-ok-evidence")" == "kept" ]] \
  && [[ "$(cat "$tmp/reboot-ok-calls")" == "called" ]]; then
  ok r6-reboot-continuation
else
  bad r6-reboot-continuation
fi

write_runner "$tmp/reboot-fail.sh" <<EOF
#!/bin/bash
set -u
source "$HELPER"
reboot() { printf 'called\n' >> "$tmp/reboot-fail-calls"; return 3; }
AISB_OPS_OPERATIONAL_TEST=1
AISB_CASE_RECORDING=1
AISB_CASE_STATE="$tmp/reboot-fail-state"
mkdir -p "\$AISB_CASE_STATE"
printf 'kept\n' > "$tmp/reboot-fail-evidence"
case_begin reboot-fail
case_reboot
EOF
bash "$tmp/reboot-fail.sh" >"$tmp/reboot-fail.out" 2>"$tmp/reboot-fail.err"
rc=$?
if [[ "$rc" -eq 3 ]] \
  && grep -q 'exit 3; cleanup 0;' "$tmp/reboot-fail-state/case-contaminated" \
  && [[ "$(cat "$tmp/reboot-fail-evidence")" == "kept" ]] \
  && [[ "$(cat "$tmp/reboot-fail-calls")" == "called" ]]; then
  ok r6-reboot-failed
else
  bad r6-reboot-failed
fi

# shellcheck source=/dev/null
source "$HELPER"
before=""
if [[ -e /opt/aisandbox/case-contaminated ]]; then
  before=present
fi
AISB_OPS_OPERATIONAL_TEST=1
AISB_CASE_RECORDING=1
AISB_CASE_STATE=/opt/aisandbox
if case_mark_contaminated unsafe 'must not write'; then
  bad r6-unsafe-target-rejected
else
  unsafe_rc=$?
  if [[ "$unsafe_rc" -eq 2 && "$before" != "present" && ! -e /opt/aisandbox/case-contaminated ]]; then
    ok r6-unsafe-target-rejected
  elif [[ "$before" == "present" ]]; then
    bad r6-unsafe-target-rejected
  else
    bad r6-unsafe-target-rejected
  fi
fi
unset AISB_OPS_OPERATIONAL_TEST
AISB_CASE_RECORDING=1
AISB_CASE_STATE="$tmp/unarmed"
if case_mark_contaminated unarmed 'must not write'; then
  bad r6-unarmed-context
elif [[ ! -e "$tmp/unarmed/case-contaminated" && ! -e /var/lib/aisandbox-ops/case-contaminated ]]; then
  ok r6-unarmed-context
else
  bad r6-unarmed-context
fi

CLEANUP="$HERE/../lib/noacl-cleanup.sh"
write_runner "$tmp/noacl-direct.sh" <<EOF
#!/bin/bash
set -u
source "$CLEANUP"
log="$tmp/noacl-direct.log"
: > "\$log"
findmnt() {
  printf 'findmnt %s\n' "\$*" >> "\$log"
  if [[ "\${1:-}" == "-T" ]]; then
    printf 'rw,noacl\n'
  fi
  return 0
}
umount() {
  printf 'umount %s\n' "\$*" >> "\$log"
  return 4
}
mountpoint() {
  printf 'mountpoint %s\n' "\$*" >> "\$log"
  return 1
}
restore_noacl_mount "$tmp/stage-direct"
EOF
bash "$tmp/noacl-direct.sh" >"$tmp/noacl-direct.out" 2>"$tmp/noacl-direct.err"
rc=$?
if [[ "$rc" -eq 4 ]] \
  && grep -qx 'findmnt /opt/aisandbox' "$tmp/noacl-direct.log" \
  && grep -qx 'findmnt -T /opt/aisandbox -no OPTIONS' "$tmp/noacl-direct.log" \
  && grep -qx 'umount /opt/aisandbox' "$tmp/noacl-direct.log" \
  && grep -qx 'umount -l /opt/aisandbox' "$tmp/noacl-direct.log" \
  && grep -qx "mountpoint -q $tmp/stage-direct" "$tmp/noacl-direct.log" \
  && ! grep -q "umount $tmp/stage-direct" "$tmp/noacl-direct.log"; then
  ok r6-noacl-retains-umount-failure
else
  bad r6-noacl-retains-umount-failure
fi

write_runner "$tmp/noacl-both.sh" <<EOF
#!/bin/bash
set -u
source "$CLEANUP"
log="$tmp/noacl-both.log"
: > "\$log"
findmnt() {
  printf 'findmnt %s\n' "\$*" >> "\$log"
  if [[ "\${1:-}" == "-T" ]]; then
    printf 'rw,noacl\n'
  fi
  return 0
}
umount() {
  printf 'umount %s\n' "\$*" >> "\$log"
  case "\$*" in
    "/opt/aisandbox"|"-l /opt/aisandbox") return 4 ;;
    *) return 5 ;;
  esac
}
mountpoint() {
  printf 'mountpoint %s\n' "\$*" >> "\$log"
  return 0
}
restore_noacl_mount "$tmp/stage-both"
EOF
bash "$tmp/noacl-both.sh" >"$tmp/noacl-both.out" 2>"$tmp/noacl-both.err"
rc=$?
if [[ "$rc" -eq 4 ]] \
  && grep -qx 'umount /opt/aisandbox' "$tmp/noacl-both.log" \
  && grep -qx 'umount -l /opt/aisandbox' "$tmp/noacl-both.log" \
  && grep -qx "umount $tmp/stage-both" "$tmp/noacl-both.log" \
  && grep -qx "umount -l $tmp/stage-both" "$tmp/noacl-both.log"; then
  ok r6-noacl-continues-after-failure
else
  bad r6-noacl-continues-after-failure
fi

write_noacl_case() {
  local name="$1" exit_code="$2"
  write_runner "$tmp/$name.sh" <<EOF
#!/bin/bash
set -u
source "$HELPER"
source "$CLEANUP"
log="$tmp/$name.log"
: > "\$log"
findmnt() {
  printf 'findmnt %s\n' "\$*" >> "\$log"
  if [[ "\${1:-}" == "-T" ]]; then
    printf 'rw,noacl\n'
  fi
  return 0
}
umount() {
  printf 'umount %s\n' "\$*" >> "\$log"
  return 4
}
mountpoint() {
  printf 'mountpoint %s\n' "\$*" >> "\$log"
  return 1
}
AISB_OPS_OPERATIONAL_TEST=1
AISB_CASE_RECORDING=1
AISB_CASE_STATE="$tmp/$name-state"
mkdir -p "\$AISB_CASE_STATE"
printf 'kept\n' > "$tmp/$name-evidence"
case_cleanup() { restore_noacl_mount "$tmp/$name-stage"; }
case_begin $name
exit $exit_code
EOF
}

write_noacl_case noacl-case-fail 9
bash "$tmp/noacl-case-fail.sh" >"$tmp/noacl-case-fail.out" 2>"$tmp/noacl-case-fail.err"
rc=$?
if [[ "$rc" -eq 9 ]] \
  && grep -q 'exit 9; cleanup 4;' "$tmp/noacl-case-fail-state/case-contaminated" \
  && grep -q 'case cleanup failed rc=4' "$tmp/noacl-case-fail.err" \
  && grep -qx 'umount /opt/aisandbox' "$tmp/noacl-case-fail.log" \
  && grep -qx 'umount -l /opt/aisandbox' "$tmp/noacl-case-fail.log" \
  && [[ "$(cat "$tmp/noacl-case-fail-evidence")" == "kept" ]]; then
  ok r6-case-keeps-original-failure
else
  bad r6-case-keeps-original-failure
fi

write_noacl_case noacl-cleanup-only 0
bash "$tmp/noacl-cleanup-only.sh" >"$tmp/noacl-cleanup-only.out" 2>"$tmp/noacl-cleanup-only.err"
rc=$?
if [[ "$rc" -eq 4 ]] \
  && grep -q 'exit 0; cleanup 4;' "$tmp/noacl-cleanup-only-state/case-contaminated" \
  && grep -q 'case cleanup failed rc=4' "$tmp/noacl-cleanup-only.err" \
  && grep -qx 'umount /opt/aisandbox' "$tmp/noacl-cleanup-only.log" \
  && grep -qx 'umount -l /opt/aisandbox' "$tmp/noacl-cleanup-only.log" \
  && [[ "$(cat "$tmp/noacl-cleanup-only-evidence")" == "kept" ]]; then
  ok r6-case-returns-cleanup-failure
else
  bad r6-case-returns-cleanup-failure
fi

mkdir() { printf 'mkdir %s\n' "$*" >> "$tmp/mkdir-blocked"; return 30; }
: > "$tmp/mkdir-blocked"
AISB_OPS_OPERATIONAL_TEST=1
AISB_CASE_RECORDING=1
AISB_CASE_STATE=/var/lib/aisandbox-ops/../../../opt/aisb-r6-no-write
if case_mark_contaminated traversal 'must not write'; then
  bad r6-traversal-rejected
else
  travel_rc=$?
  if [[ "$travel_rc" -eq 2 ]] \
    && [[ ! -s "$tmp/mkdir-blocked" ]] \
    && [[ ! -e /opt/aisb-r6-no-write ]] \
    && [[ ! -e /opt/aisb-r6-no-write/case-contaminated ]]; then
    ok r6-traversal-rejected
  else
    bad r6-traversal-rejected
  fi
fi
unset -f mkdir

echo x > "$tmp/notdir"
AISB_CASE_STATE="$tmp/notdir/child"
if case_state_is_safe; then
  bad r6-unresolved-parent
elif case_mark_contaminated unresolved 'must not write'; then
  bad r6-unresolved-parent
else
  unresolved_rc=$?
  if [[ "$unresolved_rc" -eq 2 && -f "$tmp/notdir" && ! -e "$tmp/notdir/child" ]]; then
    ok r6-unresolved-parent
  else
    bad r6-unresolved-parent
  fi
fi

mkdir -p "$tmp/vault" "$tmp/deep"
if make_dir_alias "$tmp/deep/alias" "$tmp/vault"; then
  AISB_OPS_OPERATIONAL_TEST=1
  AISB_CASE_RECORDING=1
  AISB_CASE_STATE="$tmp/deep/alias/state"
  if case_mark_contaminated alias-ok 'kept'; then
    if [[ "$(realpath -m -- "$tmp/deep/alias/state/case-contaminated")" == "$(realpath -m -- "$tmp/vault/state/case-contaminated")" ]] \
      && grep -qx 'case=alias-ok' "$tmp/vault/state/case-contaminated"; then
      ok r6-symlink-alias-resolved
    else
      bad r6-symlink-alias-resolved
    fi
  else
    bad r6-symlink-alias-resolved
  fi
  remove_dir_alias "$tmp/deep/alias" || bad r6-symlink-alias-resolved
else
  bad r6-symlink-alias-resolved
fi

if [[ -d /etc ]]; then
  mkdir -p "$tmp/escape"
  if make_dir_alias "$tmp/escape/alias" /etc; then
    mkdir() { printf 'mkdir %s\n' "$*" >> "$tmp/mkdir-escape"; return 30; }
    : > "$tmp/mkdir-escape"
    AISB_OPS_OPERATIONAL_TEST=1
    AISB_CASE_RECORDING=1
    AISB_CASE_STATE="$tmp/escape/alias/aisb-r6-no-write"
    if case_mark_contaminated escape 'must not write'; then
      bad r6-symlink-forbidden
    else
      escape_rc=$?
      if [[ "$escape_rc" -eq 2 ]] \
        && [[ ! -s "$tmp/mkdir-escape" ]] \
        && [[ ! -e /etc/aisb-r6-no-write ]] \
        && [[ ! -e /etc/aisb-r6-no-write/case-contaminated ]]; then
        ok r6-symlink-forbidden
      else
        bad r6-symlink-forbidden
      fi
    fi
    unset -f mkdir
    remove_dir_alias "$tmp/escape/alias" || bad r6-symlink-forbidden
  else
    bad r6-symlink-forbidden
  fi
else
  bad r6-symlink-forbidden
fi

printf 'failure-recording pass=%s fail=%s\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
