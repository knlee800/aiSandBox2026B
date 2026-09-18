#!/usr/bin/env python3
"""Mock tcpdump for local capture lifecycle tests. Not a packet sniffer."""

from __future__ import annotations

import argparse
import os
import signal
import struct
import sys
import time


def write_empty_pcap(path: str) -> None:
    # Little-endian pcap global header, Ethernet, snaplen 65535
    header = struct.pack("<IHHIIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
    with open(path, "ab") as f:
        if os.path.getsize(path) == 0:
            f.write(header)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("-nn", action="store_true")
    parser.add_argument("-i", dest="iface", required=False)
    parser.add_argument("-U", action="store_true")
    parser.add_argument("-w", dest="pcap")
    parser.add_argument("-r", dest="read_pcap")
    parser.add_argument("filter", nargs="*")
    args, _unknown = parser.parse_known_args(argv)

    if args.read_pcap:
        fail = os.environ.get("MOCK_TCPDUMP_READ_FAIL")
        if fail == "1":
            print("tcpdump: mock read failure", file=sys.stderr)
            return 1
        if not os.path.isfile(args.read_pcap):
            print("tcpdump: no such file", file=sys.stderr)
            return 1
        # Whole-file read: consume every byte. Do not use -c.
        with open(args.read_pcap, "rb") as f:
            f.read()
        return 0

    iface = args.iface or "ens5"
    pidfile = os.environ.get("AISB_TCPDUMP_PIDFILE")
    if pidfile:
        with open(pidfile, "w", encoding="utf-8") as f:
            f.write(str(os.getpid()) + "\n")
    print(f"tcpdump: listening on {iface}, link-type EN10MB (Ethernet), snapshot length 262144 bytes", file=sys.stderr)
    sys.stderr.flush()
    if args.pcap:
        open(args.pcap, "wb").close()
        write_empty_pcap(args.pcap)

    stopping = {"n": 0}

    def handle_int(_signum, _frame):
        stopping["n"] = 1

    signal.signal(signal.SIGINT, handle_int)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_int)

    while stopping["n"] == 0:
        time.sleep(0.05)
        if os.environ.get("MOCK_TCPDUMP_HOLD") == "1":
            continue
        pidfile = os.environ.get("AISB_TCPDUMP_PIDFILE")
        if pidfile and os.path.isfile(pidfile + ".stop"):
            break
    print("0 packets captured", file=sys.stderr)
    print("0 packets received by filter", file=sys.stderr)
    dropped = os.environ.get("MOCK_TCPDUMP_KERNEL_DROP", "0")
    print(f"{dropped} packets dropped by kernel", file=sys.stderr)
    sys.stderr.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
