#!/bin/bash
# Correction b. Interrupt the real marker-removal transition, then reboot.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=/dev/null
source "$HERE/../lib/operational-gate.sh"
operational_gate
# shellcheck source=/dev/null
source "$HERE/../lib/case-helpers.sh"
phase=${1:?arrange|assert}
AISB_CASE_NAME="tb-${phase}"
case_begin "$AISB_CASE_NAME"
evidence="$(case_evidence tb-post-start)"
case "$phase" in
  arrange)
    entry=${2:?first-start|restore|deploy}
    printf 'FAULT=marker-removed\nDISPOSABLE_NAMESPACE=1\n' > /etc/aisandbox/ops-test-mode
    chmod 0600 /etc/aisandbox/ops-test-mode
    set +e
    case "$entry" in
      first-start) /usr/local/sbin/aisandbox-first-start ;;
      restore) /usr/local/sbin/aisandbox-restore "$3" "$4" ;;
      deploy) /usr/local/sbin/aisandbox-deploy "$3" ;;
      *) printf '%s\n' 'unknown entry' >&2; exit 2 ;;
    esac
    rc=$?
    set -e
    [[ ! -e /var/lib/aisandbox-ops/maintenance ]]
    grep -q '^writer_started=1$' /var/lib/aisandbox-ops/current-op
    assert_writers_not_active
    {
      printf 'entry=%s\n' "$entry"
      printf 'rc=%s\n' "$rc"
      printf 'host=%s\n' "$(hostname)"
    } > "$evidence"
    case_reboot
    ;;
  assert)
    [[ -f "$evidence" ]]
    /usr/local/sbin/aisandbox-maint status | tee "$evidence.status"
    grep -q '^failure_class=post-start$' "$evidence.status"
    grep -q 'enabled writer units can start at boot' "$evidence.status"
    if grep -i 'writers never started' "$evidence.status" | grep -v -i -E 'does not say|do not|must not'; then
      exit 1
    fi
    [[ ! -e /var/lib/aisandbox-ops/maintenance ]]
    ;;
  *)
    printf '%s\n' 'usage: tb-post-start-reboot.sh arrange <first-start|restore|deploy> [args] | assert' >&2
    exit 2
    ;;
esac
