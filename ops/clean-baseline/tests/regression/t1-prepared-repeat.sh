#!/bin/bash
# Prepared-state and t1.6-repeat assertions. Does not run an operational case or first-start.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/../.." && pwd)
# shellcheck source=/dev/null
source "$ROOT/lib/ops-lib.sh"
# shellcheck source=/dev/null
source "$ROOT/tests/lib/case-helpers.sh"

pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }
sha=36f9a213b7e16c0cb12587a2d74cd0f679fdc54c
other=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

stat() {
  local fmt="" arg
  for arg in "$@"; do
    case "$arg" in
      %u|%a) fmt="$arg" ;;
    esac
  done
  if [[ "$*" == *ACTIVATION* && -n "${MOCK_UID:-}" ]]; then
    case "$fmt" in
      %u) printf '%s\n' "$MOCK_UID"; return 0 ;;
      %a) printf '%s\n' "$MOCK_MODE"; return 0 ;;
    esac
  fi
  command stat "$@"
}

git_as_owner() {
  if [[ "$1" == "rev-parse" ]]; then
    printf '%s\n' "${MOCK_HEAD:-$sha}"
    return 0
  fi
  return 0
}

systemctl() {
  local kind="$1" unit="${2:-}" spec token rc
  case "$kind" in
    is-enabled|is-active) ;;
    *) printf 'unexpected systemctl\n' >&2; return 99 ;;
  esac
  if [[ -f "$MOCK_DIR/err-$kind-$unit" ]]; then
    cat "$MOCK_DIR/err-$kind-$unit" >&2
  fi
  if [[ ! -f "$MOCK_DIR/$kind-$unit" ]]; then
    printf 'missing\n'
    return 99
  fi
  spec="$(cat "$MOCK_DIR/$kind-$unit")"
  token="${spec%%|*}"
  rc="${spec##*|}"
  printf '%s\n' "$token"
  return "$rc"
}

plant_pair() {
  local kind="$1" unit="$2" spec="$3"
  printf '%s\n' "$spec" > "$MOCK_DIR/$kind-$unit"
}

plant_good_services() {
  local unit
  for unit in caddy.service caddy-api.service; do
    plant_pair is-enabled "$unit" 'masked|1'
    plant_pair is-active "$unit" 'inactive|3'
  done
  for unit in aisandbox.target aisandbox-watchdog; do
    plant_pair is-enabled "$unit" 'disabled|1'
    plant_pair is-active "$unit" 'inactive|3'
  done
  for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
    plant_pair is-enabled "$unit" 'enabled|0'
    plant_pair is-active "$unit" 'active|0'
  done
}

prepare_tree() {
  WORK="$(mktemp -d)"
  MOCK_DIR="$WORK/mock"
  mkdir -p "$WORK/etc" "$WORK/systemd" "$WORK/helper" "$MOCK_DIR" "$WORK/evidence"
  ln -s /dev/null "$WORK/systemd/caddy.service"
  ln -s /dev/null "$WORK/systemd/caddy-api.service"
  printf 'sha=%s\nextra=prepared-only\ncaddy=masked\n' "$sha" > "$WORK/etc/PREPARED"
  printf 'sha=%s\ntime=later\nmigration_hash=abc\n' "$sha" > "$WORK/etc/DEPLOYED"
  printf 'recorded-authorization\n' > "$WORK/etc/ACTIVATION"
  export AISB_ETC="$WORK/etc" AISB_PREPARED="$WORK/etc/PREPARED" AISB_DEPLOYED="$WORK/etc/DEPLOYED"
  export AISB_MARKER="$WORK/marker" AISB_SYSTEMD_ETC="$WORK/systemd"
  export AISB_CADDY_HELPER_MASK_DIR="$WORK/helper" AISB_LOCK="$WORK/ops.lock"
  export MOCK_UID=0 MOCK_MODE=600 MOCK_HEAD="$sha" MOCK_DIR
  plant_good_services
}

expect_prepared() {
  local name="$1" want="$2" rc=0
  set +e
  assert_prepared_caddy_and_group
  rc=$?
  set -e
  if [[ "$want" == "pass" && "$rc" -eq 0 ]]; then
    ok "$name"
  elif [[ "$want" == "fail" && "$rc" -ne 0 ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s\n' "$rc" >&2
  fi
}

expect_repeat() {
  local name="$1" want="$2" rc=0
  rm -f -- "$WORK/invoked"
  set +e
  run_t16_repeat "$sha" "$WORK/fake-start" "$WORK/evidence/repeat"
  rc=$?
  set -e
  if [[ "$want" == "pass" && "$rc" -eq 0 ]]; then
    ok "$name"
  elif [[ "$want" == "fail" && "$rc" -ne 0 ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s\n' "$rc" >&2
  fi
}

write_fake() {
  local body="$1"
  cat > "$WORK/fake-start" <<EOF
#!/bin/bash
set -euo pipefail
  printf 'invoked\n' > "$WORK/invoked"
  printf '%s\n' "appended" >> "$WORK/lock-owner.trace"
  $body
EOF
  chmod +x "$WORK/fake-start"
}

phase_refusal='printf "%s\n" "aisandbox-ops: phase is not prepared" >&2; exit 10'

prepare_tree
if [[ -L "$WORK/systemd/caddy.service" && "$(readlink -- "$WORK/systemd/caddy.service")" == "/dev/null" ]]; then
  ok mask-link-readable
else
  bad mask-link-readable
fi
expect_prepared prepared-accepts-masked-disabled-group pass

printf 'sha=%s\n' "$sha" > "$WORK/etc/PREPARED"
expect_prepared prepared-rejects-missing-caddy-line fail
printf 'sha=%s\ncaddy=masked\n' "$sha" > "$WORK/etc/PREPARED"

plant_pair is-enabled caddy.service 'disabled|1'
expect_prepared prepared-rejects-unmasked-caddy fail
plant_pair is-enabled caddy.service 'masked|1'

plant_pair is-active caddy-api.service 'active|0'
expect_prepared prepared-rejects-active-caddy fail
plant_pair is-active caddy-api.service 'inactive|3'

rm -f -- "$WORK/systemd/caddy.service"
printf 'not-a-mask\n' > "$WORK/systemd/caddy.service"
expect_prepared prepared-rejects-non-null-mask fail
rm -f -- "$WORK/systemd/caddy.service"
ln -s /dev/null "$WORK/systemd/caddy.service"

printf 'noise\n' > "$MOCK_DIR/err-is-enabled-caddy.service"
expect_prepared prepared-rejects-enabled-stderr fail
rm -f -- "$MOCK_DIR/err-is-enabled-caddy.service"

plant_pair is-enabled caddy.service 'masked|0'
expect_prepared prepared-rejects-bad-enabled-pair fail
plant_pair is-enabled caddy.service 'masked|1'

mkdir -p "$WORK/systemd/multi-user.target.wants"
ln -s /dev/null "$WORK/systemd/multi-user.target.wants/caddy.service"
expect_prepared prepared-rejects-wants-link fail
rm -f -- "$WORK/systemd/multi-user.target.wants/caddy.service"

plant_pair is-enabled aisandbox.target 'enabled|0'
expect_prepared prepared-rejects-enabled-target fail
plant_pair is-enabled aisandbox.target 'disabled|1'

plant_pair is-active aisandbox.target 'inactive|4'
expect_prepared prepared-rejects-unloaded-target fail
plant_pair is-active aisandbox.target 'inactive|3'

plant_pair is-active aisandbox-watchdog 'active|0'
expect_prepared prepared-rejects-active-watchdog fail
plant_pair is-active aisandbox-watchdog 'inactive|3'

printf 'noise\n' > "$MOCK_DIR/err-is-active-aisandbox-watchdog"
expect_prepared prepared-rejects-watchdog-stderr fail
rm -f -- "$MOCK_DIR/err-is-active-aisandbox-watchdog"
expect_prepared prepared-restores-after-corrections pass

printf 'sha=%s\nextra=prepared-only\ncaddy=masked\n' "$sha" > "$WORK/etc/PREPARED"
printf 'sha=%s\ntime=later\nmigration_hash=abc\n' "$sha" > "$WORK/etc/DEPLOYED"
write_fake "$phase_refusal"
printf 'before\n' > "$WORK/lock-owner.trace"
expect_repeat repeat-accepts-phase-refusal pass
if grep -qx 'rc=10' "$WORK/evidence/repeat.rc" \
  && grep -qx 'aisandbox-ops: phase is not prepared' "$WORK/evidence/repeat.err" \
  && [[ -f "$WORK/evidence/repeat.out" ]] \
  && grep -qx 'appended' "$WORK/lock-owner.trace" \
  && grep -qx 'before' "$WORK/lock-owner.trace"; then
  ok repeat-keeps-streams-status-and-lock-append
else
  bad repeat-keeps-streams-status-and-lock-append
fi
if cmp -s <(printf 'sha=%s\nextra=prepared-only\ncaddy=masked\n' "$sha") "$WORK/etc/PREPARED" \
  && cmp -s <(printf 'sha=%s\ntime=later\nmigration_hash=abc\n' "$sha") "$WORK/etc/DEPLOYED"; then
  ok repeat-allows-different-record-bodies
else
  bad repeat-allows-different-record-bodies
fi

rm -f -- "$WORK/etc/ACTIVATION"
expect_repeat repeat-rejects-missing-activation fail
if [[ -f "$WORK/invoked" ]]; then bad repeat-missing-activation-does-not-invoke; else ok repeat-missing-activation-does-not-invoke; fi
printf 'recorded-authorization\n' > "$WORK/etc/ACTIVATION"

rm -f -- "$WORK/etc/DEPLOYED"
expect_repeat repeat-rejects-missing-deployed fail
printf 'sha=%s\ntime=later\nmigration_hash=abc\n' "$sha" > "$WORK/etc/DEPLOYED"

printf 'present\n' > "$WORK/marker"
expect_repeat repeat-rejects-present-marker fail
rm -f -- "$WORK/marker"

plant_pair is-active aisandbox-ai 'inactive|3'
expect_repeat repeat-rejects-stopped-writer fail
plant_pair is-active aisandbox-ai 'active|0'

MOCK_HEAD="$other"
expect_repeat repeat-rejects-different-head-sha fail
MOCK_HEAD="$sha"

write_fake 'printf "%s\n" "aisandbox-ops: ACTIVATION is absent" >&2; exit 10'
expect_repeat repeat-rejects-other-exit-10 fail

write_fake 'printf "%s\n" "aisandbox-ops: phase is not prepared" >&2; exit 0'
expect_repeat repeat-rejects-zero-with-phase-text fail

write_fake 'printf "%s\n" "aisandbox-ops: operations lock held" >&2; exit 10'
expect_repeat repeat-rejects-lock-refusal fail

write_fake "printf x >> '$WORK/etc/PREPARED'
$phase_refusal"
expect_repeat repeat-rejects-prepared-byte-change fail
printf 'sha=%s\nextra=prepared-only\ncaddy=masked\n' "$sha" > "$WORK/etc/PREPARED"

write_fake "printf x >> '$WORK/etc/DEPLOYED'
$phase_refusal"
expect_repeat repeat-rejects-deployed-byte-change fail
printf 'sha=%s\ntime=later\nmigration_hash=abc\n' "$sha" > "$WORK/etc/DEPLOYED"

write_fake "printf x >> '$WORK/etc/ACTIVATION'
$phase_refusal"
expect_repeat repeat-rejects-activation-byte-change fail
printf 'recorded-authorization\n' > "$WORK/etc/ACTIVATION"

write_fake "printf '%s\n' 'inactive|3' > '$MOCK_DIR/is-active-aisandbox-frontend'
$phase_refusal"
expect_repeat repeat-rejects-writer-state-change fail
plant_pair is-active aisandbox-frontend 'active|0'

write_fake "printf present > '$WORK/marker'
$phase_refusal"
expect_repeat repeat-rejects-marker-created fail
rm -f -- "$WORK/marker"

branch=$(awk '/^  t1\.6-repeat\)$/,/^    ;;$/' "$ROOT/tests/operational/t1-prepare.sh")
if printf '%s\n' "$branch" | grep -q 'run_t16_repeat' \
  && ! printf '%s\n' "$branch" | grep -q 'ACTIVATION'; then
  ok repeat-case-does-not-create-activation
else
  bad repeat-case-does-not-create-activation
fi

rm -rf -- "$WORK"
printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
