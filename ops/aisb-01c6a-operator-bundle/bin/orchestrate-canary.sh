#!/usr/bin/env bash
# Operator orchestrator entry. Staging uses this file; it must be in TRANSFER.manifest.
set -eu
PREP=${PREP:?PREP required}
WHICH=${1:?stub|xai}
WORKDIR=${2:?workdir}
VAULT=${3:?vault dir}
JS=${4:?compiled js path}
ENVFILE=${5:-}
PYTHON=${PYTHON3:-python3}
export PYTHONPATH="$PREP/lib${PYTHONPATH:+:$PYTHONPATH}"
if [ -n "$ENVFILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$PREP/config/defaults.env"
  # shellcheck disable=SC1090
  . "$ENVFILE"
  set +a
else
  set -a
  # shellcheck disable=SC1090
  . "$PREP/config/defaults.env"
  set +a
fi
RESOLV=${RESOLV_CONF:-/etc/resolv.conf}
exec "$PYTHON" "$PREP/lib/orchestrate.py" \
  --prep "$PREP" \
  --which "$WHICH" \
  --workdir "$WORKDIR" \
  --vault "$VAULT" \
  --js "$JS" \
  --envfile "${ENVFILE}" \
  --resolv "$RESOLV"
