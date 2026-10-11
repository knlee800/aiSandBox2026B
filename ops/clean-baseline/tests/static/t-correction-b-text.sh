#!/bin/bash
# Governing correction b. Static wording of post-start recovery. Does not start units.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LIB="$ROOT/lib/ops-lib.sh"
README="$ROOT/README.md"
body=$(awk '
  /^post_start_recovery_text\(\) \{$/ {grab=1; next}
  grab && /^}$/ {exit}
  grab {print}
' "$LIB")
if ! printf '%s\n' "$body" | grep -q 'enabled writer units can start at boot'; then
  printf 'post-start recovery does not document boot start\n' >&2
  exit 1
fi
if printf '%s\n' "$body" | grep -i 'writers never started' | grep -v -i -E 'does not say|do not|must not'; then
  printf 'post-start text claims writers never started\n' >&2
  exit 1
fi
if ! printf '%s\n' "$body" | grep -q 'normal aisandbox-deploy of that target_sha'; then
  printf 'post-start text does not name the normal deploy recovery\n' >&2
  exit 1
fi
if ! printf '%s\n' "$body" | grep -q 'Do not use aisandbox-deploy --from-maintenance when the marker is absent.'; then
  printf 'post-start text does not refuse from-maintenance without a marker\n' >&2
  exit 1
fi
if printf '%s\n' "$body" | grep -i 'from-maintenance' | grep -v -i -E 'do not|must not'; then
  printf 'post-start text recommends from-maintenance\n' >&2
  exit 1
fi
if ! printf '%s\n' "$body" | grep -q 'recorded pre_sha and restore the pre-migration bundle'; then
  printf 'post-start text does not name the fresh recovery target\n' >&2
  exit 1
fi
if ! printf '%s\n' "$body" | grep -q 'Do not invent DEPLOYED from status output.'; then
  printf 'post-start text does not forbid manufactured DEPLOYED\n' >&2
  exit 1
fi
readme=$(awk '
  /^## Post-start failure$/ {grab=1; next}
  grab && /^## / {exit}
  grab {print}
' "$README")
if ! printf '%s\n' "$readme" | grep -q 'enabled writer units can start at boot'; then
  printf 'README is missing reboot recovery\n' >&2
  exit 1
fi
if ! printf '%s\n' "$readme" | grep -q 'aisandbox-deploy <target_sha>'; then
  printf 'README is missing the normal deploy recovery\n' >&2
  exit 1
fi
if ! printf '%s\n' "$readme" | grep -q 'Do not use `aisandbox-deploy --from-maintenance` when the marker is absent.'; then
  printf 'README does not refuse from-maintenance without a marker\n' >&2
  exit 1
fi
if printf '%s\n' "$readme" | grep -i 'from-maintenance' | grep -v -i -E 'do not|must not'; then
  printf 'README post-start section recommends from-maintenance\n' >&2
  exit 1
fi
if ! printf '%s\n' "$readme" | grep -q 'recorded `pre_sha` and restore the pre-migration bundle'; then
  printf 'README is missing the fresh recovery target\n' >&2
  exit 1
fi
if ! grep -q 'Pre-start failure' "$README"; then
  printf 'README is missing the pre-start definition\n' >&2
  exit 1
fi
if ! grep -q 'Post-start failure' "$README"; then
  printf 'README is missing the post-start definition\n' >&2
  exit 1
fi
expected=$(awk '
  /^[[:space:]]*cat <<.EOF.$/ {grab=1; next}
  grab && /^EOF$/ {exit}
  grab {print}
' "$LIB")
output=$(
  # shellcheck source=/dev/null
  source "$LIB"
  post_start_recovery_text
)
if [[ "$output" != "$expected" ]]; then
  printf 'post_start_recovery_text output does not match its source\n' >&2
  exit 1
fi
printf 'correction b text PASS\n'
