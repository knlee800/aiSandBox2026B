#!/bin/bash
# Mocked Caddy acquisition. Does not run aisandbox-prepare, dpkg, or systemctl.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PREPARE="$HERE/../../bin/aisandbox-prepare"
# shellcheck source=/dev/null
source "$PREPARE"

URL="https://github.com/caddyserver/caddy/releases/download/v2.11.7/caddy_2.11.7_linux_amd64.deb"
SUM="47e8351c2317b427af14a103e763ca1118a3d2396a88b4c0669cdec9c4a68a957690194e2423a1633f53135741c33a41bdac2b55515b7d0f7adc8b733add50d9"
pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }

if grep -q 'dl.cloudsmith.io' "$PREPARE"; then
  bad no-cloudsmith-source
else
  ok no-cloudsmith-source
fi
if grep -F -q "$URL" "$PREPARE" && grep -F -q "$SUM" "$PREPARE"; then
  ok pinned-source-and-digest
else
  bad pinned-source-and-digest
fi
if grep -n 'policy-rc' "$PREPARE"; then
  bad no-policy-rc-reference
else
  ok no-policy-rc-reference
fi
if grep -n 'caddy_leave_disabled\|systemctl disable caddy\|systemctl stop caddy' "$PREPARE"; then
  bad no-post-install-disable
else
  ok no-post-install-disable
fi

reset_mock() {
  unset MOCK_HAVE_CADDY MOCK_PKG_MODE MOCK_PKG_STATUS MOCK_PKG_VERSION MOCK_PKG_RC MOCK_PKG_ERR \
    MOCK_MASK_RC MOCK_DPKG_BREAKS_MASK MOCK_INITIAL MOCK_LINKS MOCK_WANTS MOCK_HELPER MOCK_FOREIGN \
    MOCK_EN_caddy_service MOCK_EN_caddy_api_service \
    MOCK_ENRC_caddy_service MOCK_ENRC_caddy_api_service \
    MOCK_AC_caddy_service MOCK_AC_caddy_api_service \
    MOCK_ACRC_caddy_service MOCK_ACRC_caddy_api_service \
    MOCK_ENERR_caddy_service MOCK_ENERR_caddy_api_service \
    MOCK_ACERR_caddy_service MOCK_ACERR_caddy_api_service \
    MOCK_RM_RC || true
  export MOCK_ARCH=amd64 MOCK_CURL_RC=0 MOCK_SHA_RC=0 MOCK_DPKG_RC=0
  export MOCK_HAVE_CADDY=0 MOCK_PKG_MODE=absent MOCK_INITIAL=fresh MOCK_MASK_RC=0 MOCK_LINKS=auto
}

unit_key() {
  printf '%s\n' "${1//[-.]/_}"
}

run() {
  local name="$1" want="$2" want_trace="$3" file_state="${4:-gone}"
  local tmp trace deb rc file_ok diag_ok expect policy_before policy_after unit key
  tmp="$(mktemp -d)"
  trace="$tmp/trace"
  deb=""
  : > "$trace"
  mkdir -p "$tmp/etc/systemd/system" "$tmp/state"
  printf 'leave-me\n' > "$tmp/policy-rc.d"
  export AISB_POLICY_RC_D="$tmp/policy-rc.d"
  export AISB_SYSTEMD_ETC="$tmp/etc/systemd/system"
  export AISB_CADDY_HELPER_MASK_DIR="$tmp/helper"
  policy_before="$(cat "$tmp/policy-rc.d")"
  for unit in caddy.service caddy-api.service; do
    key="$(unit_key "$unit")"
    if [[ "$MOCK_INITIAL" == "masked" ]]; then
      ln -s /dev/null "$AISB_SYSTEMD_ETC/$unit"
      printf 'masked\n' > "$tmp/state/en.$key"
      printf '1\n' > "$tmp/state/enrc.$key"
      printf 'inactive\n' > "$tmp/state/ac.$key"
      printf '3\n' > "$tmp/state/acrc.$key"
    else
      printf 'not-found\n' > "$tmp/state/en.$key"
      printf '4\n' > "$tmp/state/enrc.$key"
      printf 'inactive\n' > "$tmp/state/ac.$key"
      printf '4\n' > "$tmp/state/acrc.$key"
    fi
    local en_var="MOCK_EN_${key}" ac_var="MOCK_AC_${key}" enrc_var="MOCK_ENRC_${key}" acrc_var="MOCK_ACRC_${key}"
    local enerr_var="MOCK_ENERR_${key}" acerr_var="MOCK_ACERR_${key}"
    if [[ -n "${!en_var:-}" ]]; then printf '%s\n' "${!en_var}" > "$tmp/state/en.$key"; fi
    if [[ -n "${!enrc_var:-}" ]]; then printf '%s\n' "${!enrc_var}" > "$tmp/state/enrc.$key"; fi
    if [[ -n "${!ac_var:-}" ]]; then printf '%s\n' "${!ac_var}" > "$tmp/state/ac.$key"; fi
    if [[ -n "${!acrc_var:-}" ]]; then printf '%s\n' "${!acrc_var}" > "$tmp/state/acrc.$key"; fi
    if [[ -n "${!enerr_var:-}" ]]; then printf '%s\n' "${!enerr_var}" > "$tmp/state/enerr.$key"; fi
    if [[ -n "${!acerr_var:-}" ]]; then printf '%s\n' "${!acerr_var}" > "$tmp/state/acerr.$key"; fi
  done
  if [[ "${MOCK_WANTS:-}" == "1" ]]; then
    mkdir -p "$AISB_SYSTEMD_ETC/multi-user.target.wants"
    ln -s /dev/null "$AISB_SYSTEMD_ETC/multi-user.target.wants/caddy.service"
  fi
  if [[ "${MOCK_HELPER:-}" == "1" ]]; then
    mkdir -p "$AISB_CADDY_HELPER_MASK_DIR"
    : > "$AISB_CADDY_HELPER_MASK_DIR/caddy.service"
  fi
  if [[ "${MOCK_FOREIGN:-}" == "1" ]]; then
    printf 'not-a-mask\n' > "$AISB_SYSTEMD_ETC/caddy.service"
  fi
  set +e
  (
    set -euo pipefail
    export MOCK_TRACE="$trace" MOCK_DEB_PATH_FILE="$tmp/deb-path" MOCK_STATE="$tmp/state"
    note() { printf '%s\n' "$*" >&2; }
    caddy_on_path() { [[ "$MOCK_HAVE_CADDY" == "1" ]]; }
    systemctl() {
      local cmd="$1"
      shift
      local unit key
      case "$cmd" in
        mask)
          printf 'mask %s\n' "$*" >> "$MOCK_TRACE"
          if [[ "$MOCK_MASK_RC" -ne 0 ]]; then
            return "$MOCK_MASK_RC"
          fi
          for unit in "$@"; do
            key="${unit//[-.]/_}"
            ln -sfn /dev/null "$AISB_SYSTEMD_ETC/$unit"
            printf 'masked\n' > "$MOCK_STATE/en.$key"
            printf '1\n' > "$MOCK_STATE/enrc.$key"
            printf 'inactive\n' > "$MOCK_STATE/ac.$key"
            printf '3\n' > "$MOCK_STATE/acrc.$key"
          done
          return 0
          ;;
        is-enabled|is-active)
          unit="$1"
          key="${unit//[-.]/_}"
          if [[ "$cmd" == "is-enabled" && -s "$MOCK_STATE/enerr.$key" ]]; then
            cat "$MOCK_STATE/enerr.$key" >&2
          fi
          if [[ "$cmd" == "is-active" && -s "$MOCK_STATE/acerr.$key" ]]; then
            cat "$MOCK_STATE/acerr.$key" >&2
          fi
          if [[ "$cmd" == "is-enabled" ]]; then
            cat "$MOCK_STATE/en.$key"
            return "$(cat "$MOCK_STATE/enrc.$key")"
          fi
          cat "$MOCK_STATE/ac.$key"
          return "$(cat "$MOCK_STATE/acrc.$key")"
          ;;
        *)
          printf 'bad %s %s\n' "$cmd" "$*" >> "$MOCK_TRACE"
          return 99
          ;;
      esac
    }
    dpkg-query() {
      if [[ "$MOCK_PKG_MODE" == "absent" ]]; then
        printf '%s\n' 'dpkg-query: no packages found matching caddy' >&2
        return 1
      fi
      if [[ "$MOCK_PKG_MODE" == "inspect" ]]; then
        printf '%s\n' "${MOCK_PKG_ERR:-dpkg-query: error: read failed}" >&2
        return "${MOCK_PKG_RC:-2}"
      fi
      printf '%s %s' "$MOCK_PKG_STATUS" "$MOCK_PKG_VERSION"
      return 0
    }
    dpkg() {
      if [[ "$1" == "--print-architecture" ]]; then
        printf 'arch\n' >> "$MOCK_TRACE"
        printf '%s\n' "$MOCK_ARCH"
        return 0
      fi
      printf 'dpkg\n' >> "$MOCK_TRACE"
      [[ -f "$2" ]]
      if [[ "${MOCK_DPKG_BREAKS_MASK:-}" == "1" ]]; then
        local unit key
        for unit in caddy.service caddy-api.service; do
          key="${unit//[-.]/_}"
          rm -f -- "$AISB_SYSTEMD_ETC/$unit"
          printf 'enabled\n' > "$MOCK_STATE/en.$key"
          printf '0\n' > "$MOCK_STATE/enrc.$key"
          printf 'active\n' > "$MOCK_STATE/ac.$key"
          printf '0\n' > "$MOCK_STATE/acrc.$key"
        done
      fi
      return "$MOCK_DPKG_RC"
    }
    curl() {
      printf 'curl\n' >> "$MOCK_TRACE"
      local out=""
      while [[ $# -gt 0 ]]; do
        if [[ "$1" == "-o" ]]; then
          out="$2"
          printf '%s\n' "$out" > "$MOCK_DEB_PATH_FILE"
          shift 2
          continue
        fi
        if [[ "$1" == "$URL" ]]; then
          printf 'url\n' >> "$MOCK_TRACE"
        fi
        shift
      done
      if [[ "$MOCK_CURL_RC" -ne 0 ]]; then
        return "$MOCK_CURL_RC"
      fi
      printf 'pkg\n' > "$out"
      return 0
    }
    sha512sum() {
      printf 'sha\n' >> "$MOCK_TRACE"
      local line debp
      IFS= read -r line || true
      debp="$(cat "$MOCK_DEB_PATH_FILE")"
      if [[ "$line" != "$SUM  $debp" ]]; then
        printf 'sum-mismatch-input\n' >> "$MOCK_TRACE"
        return 1
      fi
      printf 'sum\n' >> "$MOCK_TRACE"
      return "$MOCK_SHA_RC"
    }
    if [[ -n "${MOCK_RM_RC:-}" ]]; then
      rm() {
        local target="${*: -1}"
        if [[ -f "$MOCK_DEB_PATH_FILE" && "$target" == "$(cat "$MOCK_DEB_PATH_FILE")" ]]; then
          return "$MOCK_RM_RC"
        fi
        command rm "$@"
      }
    fi
    acquire_pinned_caddy
  ) >"$tmp/out" 2>"$tmp/err"
  rc=$?
  set -e
  if [[ -f "$tmp/deb-path" ]]; then
    deb="$(cat "$tmp/deb-path")"
  fi
  file_ok=0
  if [[ "$file_state" == "gone" && ( -z "$deb" || ! -e "$deb" ) ]]; then
    file_ok=1
  elif [[ "$file_state" == "kept" && -n "$deb" && -e "$deb" ]]; then
    file_ok=1
  fi
  diag_ok=1
  policy_after="$(cat "$tmp/policy-rc.d")"
  if [[ "$policy_after" != "$policy_before" || -e "$tmp/policy-rc.d.aisb-caddy-save" ]]; then
    diag_ok=0
  fi
  if [[ "$file_state" == "kept" ]]; then
    expect="Caddy package cleanup failed with status ${MOCK_RM_RC}; temporary file remains at ${deb}"
    if ! grep -F -x -q "$expect" "$tmp/err"; then
      diag_ok=0
    fi
    if grep -F -q 'pkg' "$tmp/err" || grep -F -q 'cleanup succeeded' "$tmp/err"; then
      diag_ok=0
    fi
  fi
  case "$name" in
    inspect-*)
      grep -F -q 'Caddy inspection failed' "$tmp/err" || diag_ok=0
      if grep -F -q 'not admissible' "$tmp/err"; then diag_ok=0; fi
      ;;
    refuse-*)
      grep -F -q 'not admissible' "$tmp/err" || diag_ok=0
      if grep -F -q 'Caddy inspection failed' "$tmp/err"; then diag_ok=0; fi
      ;;
    mask-failure)
      grep -F -q 'Caddy mask failed with status' "$tmp/err" || diag_ok=0
      ;;
    post-dpkg-unmasked)
      grep -F -q 'not admissible' "$tmp/err" || diag_ok=0
      ;;
  esac
  if grep -F -q 'bad ' "$trace"; then
    diag_ok=0
  fi
  local links_want="$MOCK_LINKS"
  if [[ "$links_want" == "auto" ]]; then
    if grep -F -q 'mask caddy.service caddy-api.service' "$trace"; then
      links_want=present
    elif [[ "$MOCK_INITIAL" == "masked" ]]; then
      links_want=present
    else
      links_want=absent
    fi
  fi
  if [[ "$name" == "post-dpkg-unmasked" ]]; then
    links_want=absent
  fi
  if [[ "$links_want" == "present" ]]; then
    [[ "$(readlink "$AISB_SYSTEMD_ETC/caddy.service")" == "/dev/null" ]] || diag_ok=0
    [[ "$(readlink "$AISB_SYSTEMD_ETC/caddy-api.service")" == "/dev/null" ]] || diag_ok=0
  elif [[ "$links_want" == "foreign" ]]; then
    [[ -e "$AISB_SYSTEMD_ETC/caddy.service" && ! -L "$AISB_SYSTEMD_ETC/caddy.service" ]] || diag_ok=0
    [[ ! -e "$AISB_SYSTEMD_ETC/caddy-api.service" && ! -L "$AISB_SYSTEMD_ETC/caddy-api.service" ]] || diag_ok=0
  elif [[ "$links_want" == "absent" ]]; then
    [[ ! -e "$AISB_SYSTEMD_ETC/caddy.service" && ! -L "$AISB_SYSTEMD_ETC/caddy.service" ]] || diag_ok=0
    [[ ! -e "$AISB_SYSTEMD_ETC/caddy-api.service" && ! -L "$AISB_SYSTEMD_ETC/caddy-api.service" ]] || diag_ok=0
  fi
  if [[ "$rc" -eq "$want" && "$(cat "$trace")" == "$want_trace" && "$file_ok" -eq 1 && "$diag_ok" -eq 1 ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s want=%s file_ok=%s diag_ok=%s\n' "$rc" "$want" "$file_ok" "$diag_ok" >&2
    printf 'trace:\n' >&2
    cat "$trace" >&2 || true
    printf 'err:\n' >&2
    cat "$tmp/err" >&2 || true
  fi
  rm -rf "$tmp"
}

install_trace=$'arch\nmask caddy.service caddy-api.service\ncurl\nurl\nsha\nsum\ndpkg'

reset_mock
run fresh-success 0 "$install_trace"

reset_mock
export MOCK_PKG_MODE=record MOCK_PKG_STATUS=config-files MOCK_PKG_VERSION=2.11.6
run fresh-config-files 0 "$install_trace"

reset_mock
export MOCK_PKG_MODE=record MOCK_PKG_STATUS=not-installed MOCK_PKG_VERSION=
run fresh-not-installed-record 0 "$install_trace"

reset_mock
export MOCK_INITIAL=masked
run retry-before-dpkg 0 "$install_trace"

reset_mock
export MOCK_INITIAL=masked MOCK_HAVE_CADDY=1 MOCK_PKG_MODE=record MOCK_PKG_STATUS=installed MOCK_PKG_VERSION=2.11.7
run retry-after-dpkg 0 ''

reset_mock
export MOCK_EN_caddy_service=enabled MOCK_ENRC_caddy_service=0 MOCK_ACRC_caddy_service=3 MOCK_EN_caddy_api_service=enabled MOCK_ENRC_caddy_api_service=0 MOCK_ACRC_caddy_api_service=3
run refuse-enabled 30 ''

reset_mock
export MOCK_EN_caddy_service=static MOCK_ENRC_caddy_service=0 MOCK_ACRC_caddy_service=3 MOCK_EN_caddy_api_service=static MOCK_ENRC_caddy_api_service=0 MOCK_ACRC_caddy_api_service=3
run refuse-static 30 ''

reset_mock
export MOCK_AC_caddy_service=active MOCK_ACRC_caddy_service=0 MOCK_AC_caddy_api_service=active MOCK_ACRC_caddy_api_service=0
run refuse-active 30 ''

reset_mock
export MOCK_EN_caddy_service=disabled MOCK_ENRC_caddy_service=1 MOCK_ACRC_caddy_service=3 MOCK_EN_caddy_api_service=disabled MOCK_ENRC_caddy_api_service=1 MOCK_ACRC_caddy_api_service=3
run refuse-disabled 30 ''

reset_mock
export MOCK_EN_caddy_service=masked-runtime MOCK_ENRC_caddy_service=1 MOCK_ACRC_caddy_service=3 MOCK_EN_caddy_api_service=masked-runtime MOCK_ENRC_caddy_api_service=1 MOCK_ACRC_caddy_api_service=3
run refuse-masked-runtime 30 ''

reset_mock
export MOCK_PKG_MODE=record MOCK_PKG_STATUS=half-installed MOCK_PKG_VERSION=2.11.7
run refuse-half-installed 30 ''

reset_mock
export MOCK_INITIAL=masked MOCK_HAVE_CADDY=1 MOCK_PKG_MODE=record MOCK_PKG_STATUS=installed MOCK_PKG_VERSION=2.11.6
run refuse-wrong-version 30 ''

reset_mock
export MOCK_HAVE_CADDY=1 MOCK_PKG_MODE=record MOCK_PKG_STATUS=installed MOCK_PKG_VERSION=2.11.7
run refuse-installed-unmasked 30 ''

reset_mock
export MOCK_INITIAL=masked
export MOCK_EN_caddy_api_service=not-found MOCK_ENRC_caddy_api_service=4 MOCK_AC_caddy_api_service=inactive MOCK_ACRC_caddy_api_service=4
run refuse-mixed-units 30 ''

reset_mock
export MOCK_HELPER=1
run refuse-helper-record 30 ''

reset_mock
export MOCK_WANTS=1
run refuse-wants-link 30 ''

reset_mock
export MOCK_FOREIGN=1 MOCK_LINKS=foreign
run refuse-foreign-symlink 30 ''

reset_mock
export MOCK_HAVE_CADDY=1
run refuse-binary-without-package 30 ''

reset_mock
export MOCK_INITIAL=masked MOCK_HAVE_CADDY=0 MOCK_PKG_MODE=record MOCK_PKG_STATUS=installed MOCK_PKG_VERSION=2.11.7
run refuse-package-without-binary 30 ''

reset_mock
export MOCK_EN_caddy_service=not-found MOCK_ENRC_caddy_service=1
run inspect-enabled-exit 30 ''

reset_mock
export MOCK_ENERR_caddy_service='Failed to connect to bus: No such file or directory'
run inspect-enabled-stderr 30 ''

reset_mock
export MOCK_ACERR_caddy_service='Failed to connect to bus: No such file or directory'
run inspect-active-stderr 30 ''

reset_mock
export MOCK_PKG_MODE=inspect MOCK_PKG_RC=2 MOCK_PKG_ERR='dpkg-query: error: read failed'
run inspect-dpkg-query 30 ''

reset_mock
export MOCK_ARCH=arm64
run unsupported-arch 30 'arch'

reset_mock
export MOCK_MASK_RC=9 MOCK_LINKS=absent
run mask-failure 30 $'arch\nmask caddy.service caddy-api.service'

reset_mock
export MOCK_CURL_RC=22
run download-failure 22 $'arch\nmask caddy.service caddy-api.service\ncurl\nurl'

reset_mock
export MOCK_SHA_RC=1
run checksum-mismatch 1 $'arch\nmask caddy.service caddy-api.service\ncurl\nurl\nsha\nsum'

reset_mock
export MOCK_DPKG_RC=17
run dpkg-failure 17 "$install_trace"

reset_mock
export MOCK_CURL_RC=22 MOCK_RM_RC=7
run download-cleanup-failure 22 $'arch\nmask caddy.service caddy-api.service\ncurl\nurl' kept

reset_mock
export MOCK_SHA_RC=1 MOCK_RM_RC=7
run checksum-cleanup-failure 1 $'arch\nmask caddy.service caddy-api.service\ncurl\nurl\nsha\nsum' kept

reset_mock
export MOCK_DPKG_RC=17 MOCK_RM_RC=7
run dpkg-cleanup-failure 17 "$install_trace" kept

reset_mock
export MOCK_RM_RC=7
run install-cleanup-failure 7 "$install_trace" kept

reset_mock
export MOCK_DPKG_BREAKS_MASK=1 MOCK_LINKS=absent
run post-dpkg-unmasked 30 "$install_trace"

dropin_tmp="$(mktemp -d)"
(
  set -euo pipefail
  export AISB_CADDY_DROPIN="$dropin_tmp/aisandbox.conf"
  systemctl() { printf '%s\n' "$*" > "$dropin_tmp/sys"; }
  install() {
    if [[ "$1" == "-d" ]]; then
      mkdir -p -- "${@: -1}"
      return 0
    fi
    command install "$@"
  }
  install_caddy_service_override
)
dropin_rc=$?
if [[ "$dropin_rc" -eq 0 \
  && "$(cat "$dropin_tmp/aisandbox.conf")" == $'[Service]\nEnvironmentFile=/etc/caddy/aisandbox-operator.env\nExecStart=\nExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile' \
  && "$(cat "$dropin_tmp/sys")" == "daemon-reload" ]] \
  && ! grep -F -q -- '--environ' "$dropin_tmp/aisandbox.conf"; then
  ok service-override
else
  bad service-override
  printf 'dropin_rc=%s\n' "$dropin_rc" >&2
  cat "$dropin_tmp/aisandbox.conf" >&2 || true
fi
rm -rf "$dropin_tmp"

assert_masked_case() {
  local name="$1" mode="$2"
  local tmp rc
  tmp="$(mktemp -d)"
  mkdir -p "$tmp/etc/systemd/system"
  ln -s /dev/null "$tmp/etc/systemd/system/caddy.service"
  ln -s /dev/null "$tmp/etc/systemd/system/caddy-api.service"
  if [[ "$mode" == "wants" ]]; then
    mkdir -p "$tmp/etc/systemd/system/multi-user.target.wants"
    ln -s /dev/null "$tmp/etc/systemd/system/multi-user.target.wants/caddy.service"
  fi
  if [[ "$mode" == "helper" ]]; then
    mkdir -p "$tmp/helper"
    : > "$tmp/helper/caddy.service"
  fi
  set +e
  (
    set -euo pipefail
    export AISB_SYSTEMD_ETC="$tmp/etc/systemd/system" AISB_CADDY_HELPER_MASK_DIR="$tmp/helper"
    export ASSERT_MODE="$mode"
    note() { printf '%s\n' "$*" >&2; }
    systemctl() {
      local cmd="$1" unit="$2" rc_out=1
      case "$cmd" in
        is-enabled)
          if [[ "$ASSERT_MODE" == "bad-pair" ]]; then
            printf 'masked\n'
            return 4
          fi
          printf 'masked\n'
          return 1
          ;;
        is-active)
          printf 'inactive\n'
          if [[ "$ASSERT_MODE" == "not-loaded" ]]; then
            return 4
          fi
          return 3
          ;;
        *)
          return 99
          ;;
      esac
    }
    caddy_assert_masked
  ) >"$tmp/out" 2>"$tmp/err"
  rc=$?
  set -e
  local good=0
  if [[ "$mode" == "pass" && "$rc" -eq 0 ]]; then
    good=1
  elif [[ "$mode" == "bad-pair" && "$rc" -eq 30 ]] && grep -F -q 'Caddy inspection failed' "$tmp/err"; then
    good=1
  elif [[ "$mode" != "pass" && "$mode" != "bad-pair" && "$rc" -eq 30 ]] && grep -F -q 'not admissible' "$tmp/err"; then
    good=1
  fi
  if [[ "$good" -eq 1 ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s\n' "$rc" >&2
    cat "$tmp/err" >&2 || true
  fi
  rm -rf "$tmp"
}

assert_masked_case assert-masked-pass pass
assert_masked_case assert-wants-refused wants
assert_masked_case assert-helper-refused helper
assert_masked_case assert-not-loaded-refused not-loaded
assert_masked_case assert-bad-pair-inspection bad-pair

if awk '
  $0 == "{" { start = NR }
  index($0, "printf '\''caddy=masked\\n'\''") { hit = NR }
  $0 == "} > \"$AISB_PREPARED\"" && hit > start { ok = 1 }
  END { exit ok ? 0 : 1 }
' "$PREPARE"; then
  ok prepared-records-caddy-masked
else
  bad prepared-records-caddy-masked
fi

printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
