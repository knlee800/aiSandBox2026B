#!/bin/bash
# aisandbox.target membership. File checks only. Does not call systemctl.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
UNIT="$ROOT/systemd"
BIN="$ROOT/bin"
pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'PASS %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1" >&2; }

exact() {
  local name="$1" file="$2" line="$3"
  if grep -F -x -q -- "$line" "$file"; then
    ok "$name"
  else
    bad "$name"
  fi
}

absent() {
  local name="$1" file="$2" line="$3"
  if grep -F -x -q -- "$line" "$file"; then
    bad "$name"
  else
    ok "$name"
  fi
}

exact target-description "$UNIT/aisandbox.target" 'Description=aiSandBox application writer group (operator handle; not a readiness signal)'
exact target-after "$UNIT/aisandbox.target" 'After=postgresql@15-main.service redis-server.service docker.service'
exact target-wanted-by "$UNIT/aisandbox.target" 'WantedBy=multi-user.target'
absent target-no-partof "$UNIT/aisandbox.target" 'PartOf=aisandbox.target'
absent target-no-assertion "$UNIT/aisandbox.target" 'AssertPathExists=!/var/lib/aisandbox-ops/maintenance'
if grep -n -E '^\[Service\]' "$UNIT/aisandbox.target"; then
  bad target-no-service-section
else
  ok target-no-service-section
fi

for member in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend aisandbox-watchdog; do
  exact "${member}-partof" "$UNIT/${member}.service" 'PartOf=aisandbox.target'
  exact "${member}-wanted-by" "$UNIT/${member}.service" 'WantedBy=aisandbox.target'
  absent "${member}-not-multi-user" "$UNIT/${member}.service" 'WantedBy=multi-user.target'
done

exact gateway-wants "$UNIT/aisandbox-gateway.service" 'Wants=network-online.target postgresql@15-main.service redis-server.service'
exact gateway-after "$UNIT/aisandbox-gateway.service" 'After=network-online.target postgresql@15-main.service redis-server.service'
exact gateway-assert "$UNIT/aisandbox-gateway.service" 'AssertPathExists=!/var/lib/aisandbox-ops/maintenance'
exact gateway-restart "$UNIT/aisandbox-gateway.service" 'Restart=on-failure'
exact gateway-restartsec "$UNIT/aisandbox-gateway.service" 'RestartSec=5'
exact gateway-startlimit-interval "$UNIT/aisandbox-gateway.service" 'StartLimitIntervalSec=300'
exact gateway-startlimit-burst "$UNIT/aisandbox-gateway.service" 'StartLimitBurst=5'

exact ai-wants "$UNIT/aisandbox-ai.service" 'Wants=network-online.target postgresql@15-main.service redis-server.service'
exact ai-after "$UNIT/aisandbox-ai.service" 'After=network-online.target postgresql@15-main.service redis-server.service'
exact ai-assert "$UNIT/aisandbox-ai.service" 'AssertPathExists=!/var/lib/aisandbox-ops/maintenance'
exact ai-restart "$UNIT/aisandbox-ai.service" 'Restart=on-failure'
exact ai-restartsec "$UNIT/aisandbox-ai.service" 'RestartSec=5'

exact cm-wants "$UNIT/aisandbox-cm.service" 'Wants=network-online.target docker.service'
exact cm-after "$UNIT/aisandbox-cm.service" 'After=network-online.target docker.service'
exact cm-requires "$UNIT/aisandbox-cm.service" 'Requires=docker.service'
exact cm-assert "$UNIT/aisandbox-cm.service" 'AssertPathExists=!/var/lib/aisandbox-ops/maintenance'
exact cm-restart "$UNIT/aisandbox-cm.service" 'Restart=on-failure'

exact frontend-wants "$UNIT/aisandbox-frontend.service" 'Wants=network-online.target'
exact frontend-after "$UNIT/aisandbox-frontend.service" 'After=network-online.target'
exact frontend-assert "$UNIT/aisandbox-frontend.service" 'AssertPathExists=!/var/lib/aisandbox-ops/maintenance'
exact frontend-restart "$UNIT/aisandbox-frontend.service" 'Restart=on-failure'

absent watchdog-no-assertion "$UNIT/aisandbox-watchdog.service" 'AssertPathExists=!/var/lib/aisandbox-ops/maintenance'
exact watchdog-restart "$UNIT/aisandbox-watchdog.service" 'Restart=on-failure'
exact watchdog-auth "$UNIT/aisandbox-watchdog.service" 'Description=aiSandBox ops watchdog (installed disabled; enable requires AUTH-W)'

for outsider in aisandbox-migrate.service aisandbox-backup.service aisandbox-backup.timer; do
  if grep -n -F 'aisandbox.target' "$UNIT/$outsider"; then
    bad "${outsider}-not-member"
  else
    ok "${outsider}-not-member"
  fi
done
exact backup-timer-install "$UNIT/aisandbox-backup.timer" 'WantedBy=timers.target'

if grep -n -F 'aisandbox.target' "$ROOT/caddy/Caddyfile" "$ROOT/caddy/Caddyfile.drill"; then
  bad caddy-not-member
else
  ok caddy-not-member
fi

exact prepare-installs-target "$BIN/aisandbox-prepare" 'install -m 0644 -o root -g root "$tree/systemd/aisandbox.target" /etc/systemd/system/aisandbox.target'
exact prepare-disables-group "$BIN/aisandbox-prepare" 'systemctl disable aisandbox.target aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend aisandbox-watchdog aisandbox-backup.timer || true'
if grep -n -E 'systemctl (enable|start) aisandbox\.target' "$BIN/aisandbox-prepare"; then
  bad prepare-does-not-enable-or-start-target
else
  ok prepare-does-not-enable-or-start-target
fi

order_ok() {
  local file="$1" name="$2" n1 n2 n3 n4
  n1=$(grep -n -F -x 'systemctl enable aisandbox.target' "$file" | head -n 1 | cut -d: -f1)
  n2=$(grep -n -F -x 'systemctl enable aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend' "$file" | head -n 1 | cut -d: -f1)
  n3=$(grep -n -F -x 'start_units_after_marker_removed aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend' "$file" | head -n 1 | cut -d: -f1)
  n4=$(grep -n -F -x 'health_wait' "$file" | head -n 1 | cut -d: -f1)
  if [[ -n "$n1" && -n "$n2" && -n "$n3" && -n "$n4" && "$n1" -lt "$n2" && "$n2" -lt "$n3" && "$n3" -lt "$n4" ]]; then
    ok "${name}-enable-before-staged-start"
  else
    bad "${name}-enable-before-staged-start"
    printf 'lines target=%s writers=%s start=%s health=%s\n' "${n1:-}" "${n2:-}" "${n3:-}" "${n4:-}" >&2
  fi
  if grep -n 'systemctl enable' "$file" | grep -q 'watchdog'; then
    bad "${name}-watchdog-not-enabled"
  else
    ok "${name}-watchdog-not-enabled"
  fi
}
order_ok "$BIN/aisandbox-first-start" first-start
order_ok "$BIN/aisandbox-restore" restore

for entry in aisandbox-deploy aisandbox-backup aisandbox-maint; do
  if grep -n -F 'enable aisandbox.target' "$BIN/$entry"; then
    bad "${entry}-does-not-enable-target"
  else
    ok "${entry}-does-not-enable-target"
  fi
done

if grep -n -E 'systemctl (stop|start|is-active) aisandbox\.target' "$BIN"/*; then
  bad no-target-stop-or-readiness
else
  ok no-target-stop-or-readiness
fi

if command -v systemd-analyze >/dev/null 2>&1; then
  if systemd-analyze verify "$UNIT/aisandbox.target" "$UNIT"/aisandbox-*.service "$UNIT/aisandbox-backup.timer"; then
    ok systemd-analyze-verify
  else
    bad systemd-analyze-verify
  fi
else
  printf 'UNAVAILABLE systemd-analyze verify\n'
fi

printf 'passed=%s failed=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
