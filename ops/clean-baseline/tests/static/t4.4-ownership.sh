#!/bin/bash
# Addendum T4.4. Static only.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
if grep -n -E '(^|[^[:alnum:]_])chown([^[:alnum:]_]|$)|chmod[[:space:]]+-R|setfacl[[:space:]]+-R' "$ROOT/bin"/* "$ROOT/lib"/*; then
  printf 'ownership command on the operations scripts\n' >&2
  exit 1
fi
prepare="$ROOT/bin/aisandbox-prepare"
if ! grep -q -E 'useradd[[:space:]].*--uid 7300.*--gid 7300' "$prepare"; then
  printf 'useradd is missing pinned --uid 7300 --gid 7300\n' >&2
  exit 1
fi
if ! grep -q -E 'groupadd[[:space:]].*--gid 7300' "$prepare"; then
  printf 'groupadd is missing pinned --gid 7300\n' >&2
  exit 1
fi
if grep -n -E 'useradd[[:space:]]' "$prepare" | grep -v -E -- '--uid 7300'; then
  printf 'a useradd does not pin --uid 7300\n' >&2
  exit 1
fi
printf 'T4.4 PASS\n'
