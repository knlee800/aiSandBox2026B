#!/usr/bin/env bash
# Independent overlay restore. HMAC ABSENT→EMPTY only if later-authorized env is set.
set -eu
PREP=${PREP:?PREP required}
VAULT=${1:?vault dir}
PYTHON=${PYTHON3:-python3}
export PYTHONPATH="$PREP/lib${PYTHONPATH:+:$PYTHONPATH}"
"$PYTHON" - "$PREP" "$VAULT" <<'PY'
import os, sys
sys.path.insert(0, os.path.join(sys.argv[1], "lib"))
from overlay_restore import CliPm2, restore_overlays

prep, vault = sys.argv[1], sys.argv[2]
pm2_bin = os.environ.get("PM2_BIN", "pm2")
hmac_auth = os.environ.get("AISB_01C6A_HMAC_ABSENT_EMPTY_RESTORE_AUTHORIZED", "")
authorized = hmac_auth.strip() in ("1", "YES", "TRUE", "yes", "true")
apps = [os.environ.get("GATEWAY_APP", "aisandbox-api-gateway"), os.environ.get("WORKER_APP", "aisandbox-ai-service")]
result = restore_overlays(vault, apps, CliPm2(pm2_bin), hmac_absent_empty_authorized=authorized)
print("RESTORE ok=%s matched=%s pending_hmac=%s preserved=%s" % (
    int(result.ok), int(result.matched), int(result.pending_hmac_authorization), int(result.preserved_vault)))
if not result.ok:
    raise SystemExit(1)
raise SystemExit(0)
PY
