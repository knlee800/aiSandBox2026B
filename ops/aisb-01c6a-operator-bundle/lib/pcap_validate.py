"""Validate a pcap by packet records, not by reading bytes to EOF alone.

tcpdump -r non-zero is a failure even if the file parses.
"""

from __future__ import annotations

import argparse
import os
import struct
import sys
from dataclasses import dataclass

PCAP_MAGIC_LE = 0xA1B2C3D4
PCAP_MAGIC_BE = 0xD4C3B2A1
PCAP_NSEC_LE = 0xA1B23C4D
PCAP_NSEC_BE = 0x4D3CB2A1
PCAPNG_BLOCK_TYPE = 0x0A0D0D0A


class PcapValidationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class PcapValidation:
    ok: bool
    code: str
    packet_count: int
    bytes_read: int
    tcpdump_rc: int | None
    message: str


def _u32(fmt: str, data: bytes, off: int) -> int:
    return struct.unpack_from(fmt, data, off)[0]


def pcap_global(data: bytes) -> tuple[str, int, int]:
    """Return (u32 format, linktype, snaplen) for a classic pcap."""
    if len(data) < 24:
        raise PcapValidationError("PCAP_TOO_SHORT", "pcap shorter than 24-byte global header")
    magic = struct.unpack_from("<I", data, 0)[0]
    if magic in (PCAP_MAGIC_LE, PCAP_NSEC_LE):
        u32 = "<I"
        u16 = "<H"
    elif magic in (PCAP_MAGIC_BE, PCAP_NSEC_BE):
        u32 = ">I"
        u16 = ">H"
    else:
        raise PcapValidationError("PCAP_MAGIC", "unrecognized pcap magic for global header")
    major = struct.unpack_from(u16, data, 4)[0]
    minor = struct.unpack_from(u16, data, 6)[0]
    if major == 0 and minor == 0:
        raise PcapValidationError("PCAP_VERSION", "pcap version 0.0 is invalid")
    snaplen = _u32(u32, data, 16)
    if snaplen == 0:
        raise PcapValidationError("PCAP_SNAPLEN", "snaplen 0 is invalid")
    linktype = _u32(u32, data, 20)
    return u32, linktype, snaplen


def parse_pcap_records(data: bytes) -> int:
    if len(data) < 24:
        raise PcapValidationError("PCAP_TOO_SHORT", "pcap shorter than 24-byte global header")
    magic = struct.unpack_from("<I", data, 0)[0]
    if magic not in (PCAP_MAGIC_LE, PCAP_NSEC_LE, PCAP_MAGIC_BE, PCAP_NSEC_BE):
        block = struct.unpack_from("<I", data, 0)[0]
        if block == PCAPNG_BLOCK_TYPE or struct.unpack_from(">I", data, 0)[0] == PCAPNG_BLOCK_TYPE:
            return parse_pcapng_records(data)
        raise PcapValidationError("PCAP_MAGIC", "unrecognized pcap/pcapng magic")

    u32, _linktype, snaplen = pcap_global(data)

    off = 24
    count = 0
    while off < len(data):
        if off + 16 > len(data):
            raise PcapValidationError(
                "PCAP_TRUNCATED_HEADER",
                f"truncated packet header at offset {off} remaining={len(data) - off}",
            )
        incl_len = _u32(u32, data, off + 8)
        orig_len = _u32(u32, data, off + 12)
        if incl_len > snaplen + 0x100000:  # absurd
            raise PcapValidationError("PCAP_INCL_LEN", f"incl_len {incl_len} exceeds snaplen bound")
        if orig_len < incl_len:
            raise PcapValidationError("PCAP_ORIG_LEN", f"orig_len {orig_len} < incl_len {incl_len}")
        off += 16
        if off + incl_len > len(data):
            raise PcapValidationError(
                "PCAP_TRUNCATED_RECORD",
                f"truncated packet record #{count} incl_len={incl_len}",
            )
        off += incl_len
        count += 1
    return count


def parse_pcapng_records(data: bytes) -> int:
    """Count Enhanced Packet / Simple Packet blocks. Fail on truncated blocks."""
    off = 0
    packets = 0
    if len(data) < 12:
        raise PcapValidationError("PCAPNG_TOO_SHORT", "pcapng shorter than SHB")
    while off < len(data):
        if off + 8 > len(data):
            raise PcapValidationError("PCAPNG_TRUNCATED_HEADER", f"truncated block header at {off}")
        block_type = struct.unpack_from("<I", data, off)[0]
        if off == 0 and block_type != PCAPNG_BLOCK_TYPE:
            block_type = struct.unpack_from(">I", data, off)[0]
            endian = ">"
        else:
            endian = "<"
        total_len = struct.unpack_from(endian + "I", data, off + 4)[0]
        if total_len < 12 or off + total_len > len(data):
            raise PcapValidationError("PCAPNG_TRUNCATED_BLOCK", f"block at {off} total_len={total_len}")
        trailer = struct.unpack_from(endian + "I", data, off + total_len - 4)[0]
        if trailer != total_len:
            raise PcapValidationError("PCAPNG_TRAILER", "block length trailer mismatch")
        # Enhanced Packet Block type 6, Simple Packet Block type 3
        if block_type in (6, 3):
            packets += 1
        off += total_len
    return packets


def validate_pcap_file(
    pcap_path: str,
    tcpdump_rc: int | None = None,
    tcpdump_err_path: str | None = None,
) -> PcapValidation:
    if tcpdump_rc is not None and tcpdump_rc != 0:
        err = ""
        if tcpdump_err_path and os.path.isfile(tcpdump_err_path):
            with open(tcpdump_err_path, "r", encoding="utf-8", errors="replace") as ef:
                err = ef.read()[:2000]
        return PcapValidation(
            ok=False,
            code="TCPDUMP_READ_NONZERO",
            packet_count=0,
            bytes_read=0,
            tcpdump_rc=tcpdump_rc,
            message=f"tcpdump -r exited {tcpdump_rc}; full-file read failed. {err}".strip(),
        )
    if not os.path.isfile(pcap_path):
        raise PcapValidationError("PCAP_MISSING", f"pcap not found: {pcap_path}")
    with open(pcap_path, "rb") as f:
        data = f.read()
    try:
        count = parse_pcap_records(data)
    except PcapValidationError as exc:
        return PcapValidation(
            ok=False,
            code=exc.code,
            packet_count=0,
            bytes_read=len(data),
            tcpdump_rc=tcpdump_rc,
            message=str(exc),
        )
    return PcapValidation(
        ok=True,
        code="PCAP_RECORDS_OK",
        packet_count=count,
        bytes_read=len(data),
        tcpdump_rc=tcpdump_rc,
        message=f"parsed {count} packet records",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate pcap packet records")
    parser.add_argument("pcap")
    parser.add_argument("tcpdump_rc", nargs="?", default="0")
    parser.add_argument("tcpdump_err", nargs="?", default="")
    args = parser.parse_args(argv)
    try:
        rc = int(args.tcpdump_rc)
    except ValueError:
        print("TCPDUMP_RC_NOT_INT", file=sys.stderr)
        return 2
    result = validate_pcap_file(args.pcap, tcpdump_rc=rc, tcpdump_err_path=args.tcpdump_err or None)
    print(
        f"PCAP_VALIDATE ok={int(result.ok)} code={result.code} packets={result.packet_count} "
        f"bytes={result.bytes_read} tcpdump_rc={result.tcpdump_rc}"
    )
    if not result.ok:
        print(result.message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    # Support both `python pcap_validate.py FILE` and `python3 - "$PCAP" <<'PY'`
    # by remaining a normal module. The bash heredoc imports this module.
    raise SystemExit(main(sys.argv[1:]))
