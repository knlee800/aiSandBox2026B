#!/usr/bin/env bash
# EXEC-01C6A: full-file pcap validation via python3 - argv passing.
# Usage: pcap-validate.sh PREP PCAP TCPDUMP_RC TCPDUMP_ERR
set -eu
PREP=$1
PCAP=$2
TCPDUMP_RC=$3
TCPDUMP_ERR=${4:-}
LIB="$PREP/lib"
# argv after '-' is positional: $1=pcap $2=rc $3=err $4=lib
python3 - "$PCAP" "$TCPDUMP_RC" "$TCPDUMP_ERR" "$LIB" <<'PY'
import sys
sys.path.insert(0, sys.argv[4])
from pcap_validate import validate_pcap_file

pcap = sys.argv[1]
tcpdump_rc = int(sys.argv[2])
err_path = sys.argv[3] or None
result = validate_pcap_file(pcap, tcpdump_rc=tcpdump_rc, tcpdump_err_path=err_path)
print(
    "PCAP_VALIDATE ok=%s code=%s packets=%s bytes=%s tcpdump_rc=%s"
    % (int(result.ok), result.code, result.packet_count, result.bytes_read, result.tcpdump_rc)
)
if not result.ok:
    sys.stderr.write(result.message + "\n")
    raise SystemExit(1)
raise SystemExit(0)
PY
