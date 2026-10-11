#!/bin/bash
# Correction c. The deleted path must be tracked at the source commit, and the target must restore that bundle.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=/dev/null
source "$HERE/../lib/operational-gate.sh"
operational_gate
# shellcheck source=/dev/null
source "${AISB_OPS_LIB:-/usr/local/lib/aisandbox/ops-lib.sh}"
# shellcheck source=/dev/null
source "$HERE/../lib/case-helpers.sh"
ops_paths
mode=${1:?source|target}
AISB_CASE_NAME="t4c-${mode}"
case_begin "$AISB_CASE_NAME"
evidence="$(case_evidence t4c)"
rel=database/tracked-delete-me.sql
case "$mode" in
  source)
    git_as_owner ls-files --error-unmatch "$rel"
    [[ -f "/opt/aisandbox/$rel" ]]
    blob="$(git_as_owner rev-parse "HEAD:${rel}")"
    sha="$(git_as_owner rev-parse HEAD)"
    rm -f -- "/opt/aisandbox/$rel"
    [[ ! -e "/opt/aisandbox/$rel" ]]
    /usr/local/sbin/aisandbox-backup
    bundle="$(find /var/backups/aisandbox-offhost -name '*.tar.age' -printf '%T@ %p\n' | sort -n | tail -n 1 | cut -d' ' -f2-)"
    [[ -n "$bundle" && -f "${bundle%.tar.age}.identity" ]]
    {
      printf 'source_host=%s\n' "$(hostname)"
      printf 'sha=%s\n' "$sha"
      printf 'path=%s\n' "$rel"
      printf 'blob=%s\n' "$blob"
      printf 'bundle=%s\n' "$bundle"
    } > "$evidence"
    printf '%s\n' "$evidence"
    ;;
  target)
    ev=${2:?evidence}
    key=${3:?key}
    [[ -f "$ev" ]]
    source_host="$(awk -F= '/^source_host=/{print $2}' "$ev")"
    sha="$(awk -F= '/^sha=/{print $2}' "$ev")"
    bundle="$(awk -F= '/^bundle=/{print $2}' "$ev")"
    blob="$(awk -F= '/^blob=/{print $2}' "$ev")"
    path="$(awk -F= '/^path=/{print $2}' "$ev")"
    [[ "$(hostname)" != "$source_host" ]]
    [[ -f "$bundle" ]]
    grep -q "^sha=${sha}$" /etc/aisandbox/PREPARED
    [[ ! -f /etc/aisandbox/DEPLOYED ]]
    [[ -f "/opt/aisandbox/$path" ]]
    [[ "$(git_as_owner rev-parse "HEAD:${path}")" == "$blob" ]]
    /usr/local/sbin/aisandbox-restore "$bundle" "$key"
    [[ ! -e "/opt/aisandbox/$path" ]]
    [[ "$(git_as_owner rev-parse HEAD)" == "$sha" ]]
    ;;
  *)
    printf '%s\n' 'usage: t4c-deleted-tracked.sh source|target <evidence> <key>' >&2
    exit 2
    ;;
esac
