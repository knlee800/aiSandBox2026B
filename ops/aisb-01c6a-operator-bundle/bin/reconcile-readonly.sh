#!/usr/bin/env bash
# Read-only reconcile using recorded IDs. Never sets AISB_01C6A_LIVE_SUBMIT.
# Does not write a credential-bearing env file. Invokes the accepted-script observer.
set -eu
PREP=${PREP:?PREP required}
WHICH=${1:?stub|xai}
ENVFILE=${2:?base env}
IDSFILE=${3:?ids json}
JS=${4:-${AISB_01C6A_RECONCILE_JS:-}}
PYTHON=${PYTHON3:-python3}
export PYTHONPATH="$PREP/lib${PYTHONPATH:+:$PYTHONPATH}"
set -a
# shellcheck disable=SC1090
. "$PREP/config/defaults.env"
# shellcheck disable=SC1090
. "$ENVFILE"
set +a
unset AISB_01C6A_LIVE_SUBMIT || true
if [ -z "$JS" ]; then
  echo "RECONCILE_JS_MISSING" >&2
  exit 2
fi
exec "$PYTHON" "$PREP/lib/reconcile.py" \
  --prep "$PREP" \
  --which "$WHICH" \
  --ids "$IDSFILE" \
  --js "$JS"
