#!/bin/bash
# Correction a operational case. Static order is tests/static/t-phase-and-q3.sh.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=/dev/null
source "$HERE/../lib/operational-gate.sh"
operational_gate
# shellcheck source=/dev/null
source "$HERE/../lib/case-helpers.sh"
AISB_CASE_NAME=ta-q3-order
case_begin "$AISB_CASE_NAME"
sha=${1:?sha}
before_g="$(systemctl show -p ActiveEnterTimestamp --value aisandbox-gateway)"
printf 'DISPOSABLE_NAMESPACE=1\nQ3_EXPECT_ID=00000000-0000-4000-8000-0000000000a3\n' > /etc/aisandbox/ops-test-mode
chmod 0600 /etc/aisandbox/ops-test-mode
cat > /etc/aisandbox/q3-inject.sql <<'SQL'
INSERT INTO usage_records (execution_id, api_key_id, user_id, session_id, conversation_id, provider, adapter, execution_status)
VALUES ('00000000-0000-4000-8000-0000000000a3', 'k', 'u', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000c3', 'stub', 'stub', 'pending');
SQL
chmod 0600 /etc/aisandbox/q3-inject.sql
set +e
/usr/local/sbin/aisandbox-deploy "$sha"
rc=$?
set -e
[[ "$rc" -eq 11 ]]
test ! -f /var/lib/aisandbox-ops/maintenance
active_g="$(systemctl is-active aisandbox-gateway || true)"
active_f="$(systemctl is-active aisandbox-frontend || true)"
[[ "$active_g" == "active" && "$active_f" == "active" ]]
runuser -u postgres -- psql -d aisandbox -Atc "SELECT execution_status FROM usage_records WHERE execution_id='00000000-0000-4000-8000-0000000000a3'" | grep -qx pending
after_g="$(systemctl show -p ActiveEnterTimestamp --value aisandbox-gateway)"
[[ "$after_g" != "$before_g" ]]
