#!/usr/bin/env bash
# Stop a recorded capture by tcpdump pid (from handle/pidfile), then validate the pcap.
# Tail seconds must be 0 unless execution terminal was established.
set -eu
PREP=${PREP:?PREP required}
WORKDIR=$1
NAME=$2
TAIL_SEC=${3:-0}
PYTHON=${PYTHON3:-python3}
export PYTHONPATH="$PREP/lib${PYTHONPATH:+:$PYTHONPATH}"
exec "$PYTHON" "$PREP/lib/capture.py" stop \
  --prep "$PREP" \
  --workdir "$WORKDIR" \
  --name "$NAME" \
  --tail-sec "$TAIL_SEC"
