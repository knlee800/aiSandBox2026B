#!/bin/bash
# Refuses unless a later authorization runs this inside a disposable OS namespace.
operational_gate() {
  local f owner mode
  if [[ "${AISB_OPS_OPERATIONAL_TEST:-}" != "1" ]]; then
    printf '%s\n' 'prepared operational test; this static step does not run it' >&2
    exit 2
  fi
  f="${AISB_ETC:-/etc/aisandbox}/ops-test-mode"
  if [[ ! -f "$f" ]]; then
    printf '%s\n' 'ops-test-mode is absent' >&2
    exit 2
  fi
  owner="$(stat -c '%u' "$f")"
  mode="$(stat -c '%a' "$f")"
  if [[ "$owner" != "0" || ( "$mode" != "600" && "$mode" != "400" ) ]]; then
    printf '%s\n' 'ops-test-mode must be root-owned mode 0600 or 0400' >&2
    exit 2
  fi
  if ! grep -qx 'DISPOSABLE_NAMESPACE=1' "$f"; then
    printf '%s\n' 'DISPOSABLE_NAMESPACE=1 is required; a path prefix is not isolation' >&2
    exit 2
  fi
  AISB_CASE_RECORDING=1
}
