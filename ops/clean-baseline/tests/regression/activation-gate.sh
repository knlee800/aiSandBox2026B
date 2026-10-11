#!/bin/bash
# ACTIVATION gate. Temporary files only. Does not run first-start, restore, or a service.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/../.." && pwd)
# shellcheck source=/dev/null
source "$ROOT/lib/ops-lib.sh"
pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }

make_link() {
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

check() {
  local name="$1" want="$2" expect_note="$3"
  local tmp rc untouched=1
  tmp="$(mktemp -d)"
  mkdir -p "$tmp/etc" "$tmp/state"
  if [[ -n "${CASE_BODY+x}" ]]; then
    printf '%s' "$CASE_BODY" > "$tmp/etc/ACTIVATION"
  fi
  if [[ "${CASE_KIND:-file}" == "absent" ]]; then
    rm -f -- "$tmp/etc/ACTIVATION"
  elif [[ "${CASE_KIND:-file}" == "dir" ]]; then
    rm -f -- "$tmp/etc/ACTIVATION"
    mkdir -p "$tmp/etc/ACTIVATION"
  elif [[ "${CASE_KIND:-file}" == "link" ]]; then
    rm -f -- "$tmp/etc/ACTIVATION"
    mkdir -p "$tmp/target"
    make_link "$tmp/etc/ACTIVATION" "$tmp/target" || {
      bad "${name}-fixture"
      rm -rf -- "$tmp"
      return
    }
  fi
  set +e
  (
    set -euo pipefail
    export AISB_ETC="$tmp/etc"
    export AISB_MARKER="$tmp/state/marker" AISB_OP="$tmp/state/op" AISB_LOCK="$tmp/state/lock"
    export MOCK_UID MOCK_MODE MOCK_STAT_RC MOCK_DROP_ON_STAT
    note() { printf '%s\n' "$*" >&2; }
    if [[ -n "${MOCK_UID:-}" || -n "${MOCK_STAT_RC:-}" || -n "${MOCK_DROP_ON_STAT:-}" ]]; then
      stat() {
        local fmt=""
        while [[ $# -gt 0 ]]; do
          case "$1" in
            -c) fmt="$2"; shift 2 ;;
            *) shift ;;
          esac
        done
        if [[ "${MOCK_DROP_ON_STAT:-}" == "1" ]]; then
          rm -f -- "$AISB_ETC/ACTIVATION"
        fi
        if [[ "${MOCK_STAT_RC:-0}" -ne 0 ]]; then
          return "$MOCK_STAT_RC"
        fi
        case "$fmt" in
          %u) printf '%s\n' "$MOCK_UID" ;;
          %a) printf '%s\n' "$MOCK_MODE" ;;
          *) return 1 ;;
        esac
      }
    fi
    ops_require_activation
  ) >"$tmp/out" 2>"$tmp/err"
  rc=$?
  set -e
  [[ -e "$tmp/state/marker" || -e "$tmp/state/op" || -e "$tmp/state/lock" ]] && untouched=0
  if [[ "$rc" -eq "$want" && "$untouched" -eq 1 ]] && grep -F -q -- "$expect_note" "$tmp/err"; then
    ok "$name"
  elif [[ "$want" -eq 0 && "$rc" -eq 0 && "$untouched" -eq 1 && ! -s "$tmp/err" ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s want=%s untouched=%s\n' "$rc" "$want" "$untouched" >&2
    printf 'err:\n' >&2
    cat "$tmp/err" >&2 || true
  fi
  rm -rf -- "$tmp"
}

unset MOCK_UID MOCK_MODE MOCK_STAT_RC MOCK_DROP_ON_STAT CASE_BODY
export CASE_KIND=absent
check absent 10 "ACTIVATION is absent"

export CASE_KIND=file CASE_BODY=$'OPS-01 batch record\n'
unset MOCK_UID MOCK_MODE MOCK_STAT_RC MOCK_DROP_ON_STAT
check real-owner-refused 10 "ACTIVATION must be root-owned mode 0600"

export MOCK_UID=0 MOCK_MODE=600
check accepted-line 0 ""

export CASE_BODY=$'AUTH-4 slice B'
check accepted-no-trailing-newline 0 ""

export MOCK_MODE=0600 CASE_BODY=$'recovery target authorization\n'
check accepted-mode-0600-text 0 ""

export MOCK_MODE=600
unset CASE_BODY
export CASE_KIND=absent
check absent-with-mock-still-absent 10 "ACTIVATION is absent"

export CASE_KIND=file CASE_BODY=''
export MOCK_UID=0 MOCK_MODE=600
check empty 10 "ACTIVATION must contain one line"

export CASE_BODY=$'\n'
check newline-only 10 "ACTIVATION line is empty or malformed"

export CASE_BODY=$'   \n'
check whitespace 10 "ACTIVATION line is empty or malformed"

export CASE_BODY=$'one\ntwo\n'
check two-lines 10 "ACTIVATION must contain one line"

export CASE_BODY=$'one\r\n'
check carriage-return 10 "ACTIVATION line is empty or malformed"

export MOCK_UID=1000 MOCK_MODE=600 CASE_BODY=$'recorded authorization\n'
check wrong-owner 10 "ACTIVATION must be root-owned mode 0600"

export MOCK_UID=0 MOCK_MODE=644
check wrong-mode 10 "ACTIVATION must be root-owned mode 0600"

export MOCK_UID=0 MOCK_MODE=600 MOCK_STAT_RC=1
check stat-failed 10 "ACTIVATION could not be inspected"

export MOCK_STAT_RC=0 MOCK_DROP_ON_STAT=1
check unreadable 10 "ACTIVATION is unreadable"

unset MOCK_DROP_ON_STAT MOCK_UID MOCK_MODE MOCK_STAT_RC
export CASE_KIND=dir
check directory 10 "ACTIVATION is not a regular file"

export CASE_KIND=link
check symlink 10 "ACTIVATION is a symlink"

export CASE_KIND=file CASE_BODY=$'recorded authorization\n' MOCK_UID=0 MOCK_MODE=600
check accepted-without-ops-test-mode 0 ""

order_ok() {
  local file="$1" name="$2" phase="$3" n_act n_lock n_phase n_hand
  n_act=$(grep -n -F -x 'ops_require_activation || exit 10' "$file" | head -n 1 | cut -d: -f1)
  n_lock=$(grep -n -F -x 'ops_lock || exit 10' "$file" | head -n 1 | cut -d: -f1)
  n_hand=$(grep -n -F 'marker_handoff ' "$file" | head -n 1 | cut -d: -f1)
  n_phase=$(grep -n -F -x "marker_set_phase ${phase}" "$file" | head -n 1 | cut -d: -f1)
  if [[ -n "$n_act" && "$n_act" -lt "$n_lock" && "$n_lock" -lt "$n_hand" && "$n_hand" -lt "$n_phase" ]]; then
    ok "${name}-before-lock-and-marker"
  else
    bad "${name}-before-lock-and-marker"
    printf 'act=%s lock=%s hand=%s phase=%s\n' "${n_act:-}" "${n_lock:-}" "${n_hand:-}" "${n_phase:-}" >&2
  fi
  if [[ "$(grep -c -F -x 'ops_require_activation || exit 10' "$file")" -eq 1 ]]; then
    ok "${name}-one-call"
  else
    bad "${name}-one-call"
  fi
}
order_ok "$ROOT/bin/aisandbox-first-start" first-start first-start-pre
order_ok "$ROOT/bin/aisandbox-restore" restore restore-pre
n_act=$(grep -n -F -x 'ops_require_activation || exit 10' "$ROOT/bin/aisandbox-first-start" | head -n 1 | cut -d: -f1)
n_begin=$(grep -n -F -x 'op_begin first-start || exit 10' "$ROOT/bin/aisandbox-first-start" | head -n 1 | cut -d: -f1)
n_admit=$(grep -n -F -x 'AISB_OP_ADMITTED=1' "$ROOT/bin/aisandbox-restore" | head -n 1 | cut -d: -f1)
n_work=$(grep -n -F -x 'work="$(mktemp -d)"' "$ROOT/bin/aisandbox-restore" | head -n 1 | cut -d: -f1)
n_restore_act=$(grep -n -F -x 'ops_require_activation || exit 10' "$ROOT/bin/aisandbox-restore" | head -n 1 | cut -d: -f1)
if [[ -n "$n_act" && "$n_act" -lt "$n_begin" ]]; then
  ok first-start-before-admission
else
  bad first-start-before-admission
fi
if [[ -n "$n_restore_act" && "$n_restore_act" -lt "$n_work" && "$n_work" -lt "$n_admit" ]]; then
  ok restore-before-temp-and-admission
else
  bad restore-before-temp-and-admission
fi

fn=$(awk '/^ops_require_activation\(\) \{/,/^}$/' "$ROOT/lib/ops-lib.sh")
if printf '%s\n' "$fn" | grep -q 'ops-test-mode'; then
  bad function-ignores-ops-test-mode
else
  ok function-ignores-ops-test-mode
fi
if grep -n -E 'ACTIVATION' "$ROOT/bin"/* "$ROOT/lib/ops-lib.sh" | grep -E '>>|[[:space:]]>[^>]|tee |install |touch '; then
  bad scripts-do-not-create-activation
else
  ok scripts-do-not-create-activation
fi

printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
