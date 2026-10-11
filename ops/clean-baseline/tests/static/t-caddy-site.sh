#!/bin/bash
# Site selection for aisandbox-prepare. Does not install packages or start services.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT="$HERE/../.."
PREPARE="$ROOT/bin/aisandbox-prepare"
# shellcheck source=/dev/null
source "$PREPARE"
note() { printf '%s\n' "$*" >&2; }
sha=36f9a213b7e16c0cb12587a2d74cd0f679fdc54c
pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }

expect_ok() {
  local name="$1"
  shift
  PREPARE_SHA=""
  PREPARE_SITE=""
  if prepare_parse_args "$@" && [[ "$PREPARE_SHA" == "$sha" && "$PREPARE_SITE" == "$name" ]]; then
    ok "select-$name"
  else
    bad "select-$name"
  fi
}

expect_reject() {
  local name="$1"
  shift
  local rc=0
  PREPARE_SHA="stale"
  PREPARE_SITE="stale"
  prepare_parse_args "$@" || rc=$?
  if [[ "$rc" -eq 10 && -z "$PREPARE_SHA" && -z "$PREPARE_SITE" ]]; then
    ok "$name"
  else
    bad "$name"
    printf 'rc=%s sha=%s site=%s\n' "$rc" "${PREPARE_SHA:-}" "${PREPARE_SITE:-}" >&2
  fi
  printf 'still-here\n' >/dev/null
}

expect_ok public "$sha" --site public
expect_ok localhost "$sha" --site localhost

expect_reject missing-all
expect_reject missing-site "$sha"
expect_reject missing-value "$sha" --site
expect_reject invalid-site "$sha" --site drill
expect_reject invalid-sha abcdef --site public
expect_reject duplicate-site "$sha" --site public --site localhost
expect_reject duplicate-same "$sha" --site public --site public
expect_reject extra-arg "$sha" --site public extra
expect_reject reversed --site public "$sha"
expect_reject equals-form "$sha" --site=public
expect_reject unknown-flag "$sha" --site public --foo

pub="$(prepare_caddyfile_source public "$ROOT")"
drill="$(prepare_caddyfile_source localhost "$ROOT")"
if [[ "$pub" == "$ROOT/caddy/Caddyfile" && "$drill" == "$ROOT/caddy/Caddyfile.drill" ]]; then
  ok template-paths
else
  bad template-paths
fi
if [[ -f "$pub" && -f "$drill" ]] && grep -q 'basic_auth' "$pub" && ! grep -q 'basic_auth' "$drill"; then
  ok drill-has-no-basic-auth
else
  bad drill-has-no-basic-auth
fi
before_pub="$(cat "$pub")"
before_drill="$(cat "$drill")"
tmp="$(mktemp -d)"
cp -- "$pub" "$tmp/public.out"
cp -- "$drill" "$tmp/drill.out"
if [[ "$(cat "$pub")" == "$before_pub" && "$(cat "$drill")" == "$before_drill" && "$(cat "$tmp/public.out")" == "$before_pub" && "$(cat "$tmp/drill.out")" == "$before_drill" ]]; then
  ok templates-unchanged
else
  bad templates-unchanged
fi
rm -rf -- "$tmp"

if grep -F -q 'caddy_src="$(prepare_caddyfile_source "$site" "$tree")" || exit 10' "$PREPARE" \
  && grep -F -q 'install -m 0644 -o root -g root "$caddy_src" /etc/caddy/Caddyfile' "$PREPARE" \
  && ! grep -F -q 'install -m 0644 -o root -g root "$tree/caddy/Caddyfile" /etc/caddy/Caddyfile' "$PREPARE"; then
  ok install-uses-selection
else
  bad install-uses-selection
fi

if awk '
  BEGIN { seen = 0; parsed = 0; locked = 0 }
  /BASH_SOURCE/ { seen = 1; next }
  seen && /prepare_parse_args "\$@"/ { parsed = NR }
  seen && /^ops_lock / { locked = NR }
  END { exit (parsed > 0 && locked > parsed) ? 0 : 1 }
' "$PREPARE"; then
  ok parse-before-lock
else
  bad parse-before-lock
fi

if grep -F -q 'ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile' "$PREPARE" \
  && ! grep -F -q -- '--environ' "$PREPARE" \
  && grep -F -q 'systemctl mask caddy.service caddy-api.service' "$PREPARE" \
  && grep -F -q 'caddy validate --config /etc/caddy/Caddyfile' "$PREPARE" \
  && grep -F -q 'AISB_OPERATOR_HASH' "$PREPARE"; then
  ok masks-dropin-validate-env-preserved
else
  bad masks-dropin-validate-env-preserved
fi

if declare -F acquire_pinned_caddy >/dev/null && declare -F prepare_parse_args >/dev/null; then
  ok caller-can-source
else
  bad caller-can-source
fi

harness_ok=1
while IFS= read -r hit; do
  case "$hit" in
    *"--site localhost"*) ;;
    *) harness_ok=0; printf '%s\n' "$hit" >&2 ;;
  esac
done < <(grep -n -F 'aisandbox-prepare' "$ROOT/tests/operational/"*.sh || true)
if [[ "$harness_ok" -eq 1 ]]; then
  ok harness-passes-localhost
else
  bad harness-passes-localhost
fi

printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
