#!/usr/bin/env bash
# EXEC-01C6A capture lifecycle: ens5 plus conditional loopback.
# Identity from tcpdump-exec pidfile. No pgrep. No sudo-PID guess.
set -eu
PREP=${PREP:?PREP required}
WHICH=${1:?which required}
WORKDIR=${2:?workdir required}
RESOLV_CONF=${3:-/etc/resolv.conf}
PYTHON=${PYTHON3:-python3}
export PYTHONPATH="$PREP/lib${PYTHONPATH:+:$PYTHONPATH}"

NEED_LO=0
if [ -f "$RESOLV_CONF" ]; then
  if grep -E '^[[:space:]]*nameserver[[:space:]]+(127\.0\.0\.53|127\.0\.0\.1|::1)[[:space:]]*$' "$RESOLV_CONF" >/dev/null 2>/dev/null; then
    NEED_LO=1
  fi
fi

"$PYTHON" - "$PREP" "$WHICH" "$WORKDIR" "$NEED_LO" <<'PY'
import os, sys, json
sys.path.insert(0, os.path.join(sys.argv[1], "lib"))
from capture import ENS5_FILTER, LO_FILTER, start_capture, CaptureStartError
from linux_capture import LinuxCapture
from secret_io import live_capable_adapters, require_explicit_live_authorization

prep, which, workdir, need_lo = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1"
if live_capable_adapters(os.environ):
    require_explicit_live_authorization(os.environ, what="capture-lifecycle")
adapter = LinuxCapture(
    sudo_bin=os.environ.get("AISB_SUDO_BIN", "sudo"),
    python_bin=os.environ.get("PYTHON3", sys.executable),
    exec_py=os.path.join(prep, "bin", "tcpdump-exec.py"),
)
handles = []
try:
    h = start_capture(
        name="%s-ens5" % which,
        iface="ens5",
        bpf=ENS5_FILTER,
        workdir=workdir,
        exec_helper=os.path.join(prep, "bin", "tcpdump-exec.py"),
        adapter=adapter,
    )
    handles.append(h)
    if need_lo:
        h2 = start_capture(
            name="%s-lo" % which,
            iface="lo",
            bpf=LO_FILTER,
            workdir=workdir,
            exec_helper=os.path.join(prep, "bin", "tcpdump-exec.py"),
            adapter=adapter,
        )
        handles.append(h2)
except CaptureStartError as exc:
    from capture import stop_capture
    to_stop = list(handles)
    if getattr(exc, "handle", None) is not None and exc.handle not in to_stop:
        to_stop.append(exc.handle)
    for h in to_stop:
        try:
            stop_capture(h, adapter, tail_sec=0)
        except Exception:
            pass
    print("CAPTURE_START_FAIL %s" % exc.code)
    raise SystemExit(2)
for h in handles:
    if not h.listening:
        print("CAPTURE_NOT_LISTENING %s" % h.iface)
        raise SystemExit(2)
    print("CAPTURE_LISTENING iface=%s tcpdump_pid=%s filter=%s" % (h.iface, h.tcpdump_pid, h.filter))
print("CAPTURE_READY count=%s" % len(handles))
PY
