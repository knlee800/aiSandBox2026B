#!/bin/bash
# Mocked T1.1 log classification. Does not run t1-prepare.sh or aisandbox-prepare.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=/dev/null
source "$HERE/../lib/case-helpers.sh"

pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }
sha=36f9a213b7e16c0cb12587a2d74cd0f679fdc54c
notice="aisandbox-ops: prepared ${sha}; no health check is required"
old_probe='health|/api/health|curl '
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

printf '%s\n' "$notice" > "$tmp/notice.log"
if grep -E -i -q "$old_probe" "$tmp/notice.log"; then
  ok old-grep-false-failure
else
  bad old-grep-false-failure
fi

cat > "$tmp/downloads.log" <<EOF
$notice
apt-get install -y curl gnupg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
EOF
if grep -E -i -q "$old_probe" "$tmp/downloads.log" \
  && ! prepare_log_probes_application "$tmp/downloads.log"; then
  ok corrected-accepts-notice-and-downloads
else
  bad corrected-accepts-notice-and-downloads
fi

cp "$tmp/downloads.log" "$tmp/probe.log"
printf '%s\n' 'curl -fsS --max-time 3 http://127.0.0.1:4000/api/health/ready' >> "$tmp/probe.log"
if prepare_log_probes_application "$tmp/probe.log"; then
  ok probe-detected
else
  bad probe-detected
fi

printf '%s\n' 'curl -fsSL https://deb.nodesource.com/setup_24.x' 'curl -fsS --max-time 3 http://127.0.0.1:3002/en' > "$tmp/port.log"
if prepare_log_probes_application "$tmp/port.log"; then
  ok listener-probe-detected
else
  bad listener-probe-detected
fi

set +e
notice="$notice" bash -c 'set -euo pipefail; prepare(){ printf "%s\n" "$notice"; return 30; }; prepare; printf "%s\n" REACHED' >"$tmp/failed.log" 2>&1
failed_rc=$?
set -e
if [[ "$failed_rc" -eq 30 ]] && grep -qx -F "$notice" "$tmp/failed.log" && ! grep -qx REACHED "$tmp/failed.log"; then
  ok failed-prepare-stops
else
  bad failed-prepare-stops
fi

etc="$tmp/etc"
root="$tmp/root"
marker="$tmp/maintenance"
mkdir -p "$etc" "$root/workspaces" "$root/database" "$root/projects" \
  "$root/services/snapshot-store" "$root/snapshot-store"
printf 'sha=%s\ncaddy=masked\n' "$sha" > "$etc/PREPARED"
printf 'phase=prepared\nowner_op=prepare\n' > "$marker"
mkdir -p "$tmp/systemd" "$tmp/helper"
ln -s /dev/null "$tmp/systemd/caddy.service"
ln -s /dev/null "$tmp/systemd/caddy-api.service"
export AISB_ETC="$etc" AISB_ROOT="$root" AISB_MARKER="$marker"
export AISB_SYSTEMD_ETC="$tmp/systemd" AISB_CADDY_HELPER_MASK_DIR="$tmp/helper"
git_as_owner() { :; }
redis_auth_env() { :; }
redis-cli() { printf '0\n'; }
note() { printf '%s\n' "$*" >&2; }
systemctl() {
  local unit="${2:-}"
  case "$1" in
    is-enabled)
      case "$unit" in
        caddy.service|caddy-api.service) printf 'masked\n'; return 1 ;;
        *) printf 'disabled\n'; return 1 ;;
      esac
      ;;
    is-active)
      printf 'inactive\n'
      return 3
      ;;
  esac
}
journalctl() { :; }
ss() { printf '%s\n' 'State Recv-Q Send-Q Local Address:Port'; }
runuser() { :; }

set +e
( set -e; assert_t1_prepared_postconditions "$sha" )
idle_rc=$?
printf 'sha=abc\n' > "$etc/DEPLOYED"
( set -e; assert_t1_prepared_postconditions "$sha" )
deployed_rc=$?
rm -f "$etc/DEPLOYED"
systemctl() {
  case "$1" in
    is-enabled) printf 'disabled\n' ;;
    is-active) printf 'active\n' ;;
  esac
}
( set -e; assert_t1_prepared_postconditions "$sha" )
active_rc=$?
set -e
if [[ "$idle_rc" -eq 0 ]]; then ok prepared-idle-holds; else bad prepared-idle-holds; fi
if [[ "$deployed_rc" -ne 0 ]]; then ok deployed-rejected; else bad deployed-rejected; fi
if [[ "$active_rc" -ne 0 ]]; then ok active-writer-rejected; else bad active-writer-rejected; fi

branch=$(awk '
  /^  t1\.1\)$/ { show=1 }
  show { print }
  show && /^    ;;$/ { exit }
' "$HERE/../operational/t1-prepare.sh")
if printf '%s\n' "$branch" | grep -q 'prepare_log_probes_application' \
  && printf '%s\n' "$branch" | grep -q 'assert_t1_prepared_postconditions' \
  && printf '%s\n' "$branch" | grep -q 'aisandbox-prepare' \
  && ! printf '%s\n' "$branch" | grep -q "grep -E -i 'health"; then
  ok t1-branch-uses-corrected-check
else
  bad t1-branch-uses-corrected-check
fi

printf 'pass=%s fail=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
