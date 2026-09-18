#!/usr/bin/env bash
# Bounded submitter supervision. Deadlines from validated config. Monotonic clock in Python.
set -eu
PREP=${PREP:?PREP required}
WHICH=${1:?stub|xai}
JS=${2:?compiled js path}
ENVFILE=${3:?env file}
OUT=${4:?stdout path}
STAT=${5:?stat path}
PYTHON=${PYTHON3:-python3}
export PYTHONPATH="$PREP/lib${PYTHONPATH:+:$PYTHONPATH}"
set -a
# shellcheck disable=SC1090
. "$PREP/config/defaults.env"
. "$ENVFILE"
set +a
"$PYTHON" - "$PREP" "$WHICH" "$JS" "$OUT" "$STAT" <<'PY'
import os, sys, json
sys.path.insert(0, os.path.join(sys.argv[1], "lib"))
from config_deadlines import outer_timeout_ms
from supervise import supervise

prep, which, js, out, stat = sys.argv[1:6]
env = dict(os.environ)
timeout_ms = outer_timeout_ms(env)
node = env.get("NODE_BIN", "/usr/bin/node")
result = supervise(
    argv=[node, js],
    env=env,
    timeout_ms=timeout_ms,
    expected_js=js,
    expected_node=node,
)
open(out, "w", encoding="utf-8").write(result.stdout)
open(out + ".err", "w", encoding="utf-8").write(result.stderr)
payload = {
    "exit_code": result.exit_code,
    "timed_out": result.timed_out,
    "killed": result.killed,
    "identity_failed": result.identity_failed,
    "interrupted": result.interrupted,
    "surviving_pids": result.surviving_pids,
    "abandoned": result.abandoned,
    "elapsed_ms": result.elapsed_ms,
    "timeout_ms": timeout_ms,
}
open(stat, "w", encoding="utf-8").write(json.dumps(payload) + "\n")
print("SUPERVISE_DONE %s" % json.dumps(payload))
if result.identity_failed or result.abandoned or result.surviving_pids:
    raise SystemExit(4)
if result.timed_out:
    raise SystemExit(5)
if result.exit_code is None:
    raise SystemExit(4)
raise SystemExit(result.exit_code)
PY
