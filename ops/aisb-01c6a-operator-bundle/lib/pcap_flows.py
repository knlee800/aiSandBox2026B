"""Derive flows from a recorded pcap. Missing parse coverage is INCOMPLETE."""

from __future__ import annotations

import os
import struct
from dataclasses import dataclass, field
from ipaddress import IPv4Address, IPv6Address

from network_evidence import Flow
from pcap_validate import parse_pcap_records, PcapValidationError, pcap_global

ETH_P_IP = 0x0800
ETH_P_IPV6 = 0x86DD
ETH_P_8021Q = 0x8100
ETH_P_8021AD = 0x88A8
DLT_NULL = 0
DLT_EN10MB = 1
DLT_RAW = 12
DLT_RAW_ALT = 101
DLT_LINUX_SLL = 113
DLT_IPV4 = 228
DLT_IPV6 = 229
SUPPORTED_LINKTYPES = frozenset(
    {DLT_NULL, DLT_EN10MB, DLT_RAW, DLT_RAW_ALT, DLT_LINUX_SLL, DLT_IPV4, DLT_IPV6}
)

ETH_P_IP = 0x0800
ETH_P_IPV6 = 0x86DD
ETH_P_8021Q = 0x8100
ETH_P_8021AD = 0x88A8


@dataclass
class PcapFlowObservation:
    packet_count: int
    flows: list[Flow] = field(default_factory=list)
    unparsed: int = 0
    dns_qnames: list[str] = field(default_factory=list)
    parse_complete: bool = False
    message: str = ""


def _u16(data: bytes, off: int) -> int:
    return struct.unpack_from("!H", data, off)[0]


def _parse_dns_qname(payload: bytes) -> str | None:
    if len(payload) < 12:
        return None
    off = 12
    labels = []
    hops = 0
    while off < len(payload) and hops < 32:
        hops += 1
        length = payload[off]
        if length == 0:
            name = ".".join(labels)
            return name or None
        if length & 0xC0 == 0xC0:
            return ".".join(labels) if labels else None
        off += 1
        if off + length > len(payload):
            return None
        try:
            labels.append(payload[off : off + length].decode("idna"))
        except Exception:
            return None
        off += length
    return None


def _parse_l3(packet: bytes, linktype: int) -> tuple[Flow | None, str | None, bool]:
    """Return (flow, dns_qname, parsed). parsed=False means coverage gap."""
    if linktype == DLT_EN10MB:
        return _parse_ethernet(packet)
    if linktype == DLT_LINUX_SLL:
        if len(packet) < 16:
            return None, None, False
        proto = _u16(packet, 14)
        return _parse_ethertype(proto, packet[16:])
    if linktype == DLT_NULL:
        if len(packet) < 4:
            return None, None, False
        family = struct.unpack_from("<I", packet, 0)[0]
        if family in (2, 0x02000000):
            return _parse_ipv4(packet[4:])
        if family in (24, 28, 30, 0x18000000, 0x1C000000, 0x1E000000):
            return _parse_ipv6(packet[4:])
        return None, None, False
    if linktype in (DLT_RAW, DLT_RAW_ALT, DLT_IPV4, DLT_IPV6):
        if not packet:
            return None, None, False
        version = packet[0] >> 4
        if version == 4:
            return _parse_ipv4(packet)
        if version == 6:
            return _parse_ipv6(packet)
        return None, None, False
    return None, None, False


def _parse_ethernet(packet: bytes) -> tuple[Flow | None, str | None, bool]:
    if len(packet) < 14:
        return None, None, False
    ethertype = _u16(packet, 12)
    l3 = 14
    if ethertype in (ETH_P_8021Q, ETH_P_8021AD):
        if len(packet) < 18:
            return None, None, False
        ethertype = _u16(packet, 16)
        l3 = 18
        if ethertype in (ETH_P_8021Q, ETH_P_8021AD):
            if len(packet) < 22:
                return None, None, False
            ethertype = _u16(packet, 20)
            l3 = 22
    return _parse_ethertype(ethertype, packet[l3:])


def _parse_ethertype(ethertype: int, payload: bytes) -> tuple[Flow | None, str | None, bool]:
    if ethertype == ETH_P_IP:
        return _parse_ipv4(payload)
    if ethertype == ETH_P_IPV6:
        return _parse_ipv6(payload)
    return None, None, False


def _parse_ipv4(data: bytes) -> tuple[Flow | None, str | None, bool]:
    if len(data) < 20:
        return None, None, False
    vihl = data[0]
    if (vihl >> 4) != 4:
        return None, None, False
    ihl = (vihl & 0x0F) * 4
    if ihl < 20 or len(data) < ihl:
        return None, None, False
    proto = data[9]
    flags_frag = _u16(data, 6)
    frag_off = flags_frag & 0x1FFF
    more_frag = bool(flags_frag & 0x2000)
    if frag_off or more_frag:
        return None, None, False
    src = str(IPv4Address(data[12:16]))
    dst = str(IPv4Address(data[16:20]))
    l4 = data[ihl:]
    return _parse_l4(src, dst, proto, l4)


def _parse_ipv6(data: bytes) -> tuple[Flow | None, str | None, bool]:
    if len(data) < 40:
        return None, None, False
    if (data[0] >> 4) != 6:
        return None, None, False
    nxt = data[6]
    src = str(IPv6Address(data[8:24]))
    dst = str(IPv6Address(data[24:40]))
    off = 40
    for _ in range(8):
        if nxt not in (0, 43, 44, 60, 51):
            break
        if nxt == 44:
            return None, None, False
        if off + 2 > len(data):
            return None, None, False
        hdrlen = data[off + 1]
        nxt_hdr = data[off]
        if nxt == 51:
            off += (hdrlen + 2) * 4
        else:
            off += (hdrlen + 1) * 8
        nxt = nxt_hdr
    return _parse_l4(src, dst, nxt, data[off:])


def _tcp_payload(payload: bytes) -> bytes | None:
    if len(payload) < 20:
        return None
    data_off = (payload[12] >> 4) * 4
    if data_off < 20 or len(payload) < data_off:
        return None
    return payload[data_off:]


def _parse_l4(src: str, dst: str, proto: int, payload: bytes) -> tuple[Flow | None, str | None, bool]:
    if proto == 6:
        if len(payload) < 4:
            return None, None, False
        sport = _u16(payload, 0)
        dport = _u16(payload, 2)
        qname = None
        if sport == 53 or dport == 53:
            tcp_data = _tcp_payload(payload)
            if tcp_data is None:
                return Flow(src, dst, sport, dport, "tcp"), None, False
            if len(tcp_data) < 2:
                return Flow(src, dst, sport, dport, "tcp"), None, False
            dns_len = _u16(tcp_data, 0)
            dns_msg = tcp_data[2:]
            if dns_len > len(dns_msg):
                return Flow(src, dst, sport, dport, "tcp"), None, False
            qname = _parse_dns_qname(dns_msg[:dns_len] if dns_len else dns_msg)
        return Flow(src, dst, sport, dport, "tcp", dns_qname=qname), qname, True
    if proto == 17:
        if len(payload) < 8:
            return None, None, False
        sport = _u16(payload, 0)
        dport = _u16(payload, 2)
        qname = None
        dns_payload = payload[8:]
        if dport == 53 or sport == 53:
            qname = _parse_dns_qname(dns_payload)
        return Flow(src, dst, sport, dport, "udp", dns_qname=qname), qname, True
    if proto == 1 or proto == 58:
        return Flow(src, dst, None, None, "icmp"), None, True
    return None, None, False


def iter_pcap_packets(data: bytes) -> list[bytes]:
    if len(data) < 24:
        raise PcapValidationError("PCAP_TOO_SHORT", "pcap shorter than 24-byte global header")
    magic = struct.unpack_from("<I", data, 0)[0]
    if magic in (0xA1B2C3D4, 0xA1B23C4D):
        u32 = "<I"
    elif magic in (0xD4C3B2A1, 0x4D3CB2A1):
        u32 = ">I"
    else:
        raise PcapValidationError("PCAP_MAGIC", "unrecognized pcap magic for flow parse")
    off = 24
    packets: list[bytes] = []
    while off < len(data):
        if off + 16 > len(data):
            raise PcapValidationError("PCAP_TRUNCATED_HEADER", f"truncated header at {off}")
        incl_len = struct.unpack_from(u32, data, off + 8)[0]
        off += 16
        if off + incl_len > len(data):
            raise PcapValidationError("PCAP_TRUNCATED_RECORD", f"truncated record incl_len={incl_len}")
        packets.append(data[off : off + incl_len])
        off += incl_len
    return packets


def parse_pcap_flows(pcap_path: str) -> PcapFlowObservation:
    if not os.path.isfile(pcap_path):
        return PcapFlowObservation(
            packet_count=0,
            parse_complete=False,
            message="PCAP_MISSING",
        )
    with open(pcap_path, "rb") as f:
        data = f.read()
    try:
        count = parse_pcap_records(data)
        packets = iter_pcap_packets(data)
        _u32, linktype, _snaplen = pcap_global(data)
    except PcapValidationError as exc:
        return PcapFlowObservation(
            packet_count=0,
            parse_complete=False,
            message=exc.code,
        )
    if linktype not in SUPPORTED_LINKTYPES:
        return PcapFlowObservation(
            packet_count=count,
            unparsed=count,
            parse_complete=False,
            message="UNSUPPORTED_LINKTYPE",
        )
    if count != len(packets):
        return PcapFlowObservation(
            packet_count=count,
            unparsed=count,
            parse_complete=False,
            message="PCAP_PACKET_COUNT_MISMATCH",
        )
    flows: list[Flow] = []
    qnames: list[str] = []
    unparsed = 0
    dns_unparsed = 0
    for pkt in packets:
        flow, qname, parsed = _parse_l3(pkt, linktype)
        if not parsed:
            unparsed += 1
            continue
        if flow is not None:
            flows.append(flow)
            dns_port = (flow.dport == 53 or flow.sport == 53)
            if flow.proto in ("udp", "tcp") and dns_port and not qname:
                dns_unparsed += 1
            if qname:
                qnames.append(qname)
    parse_complete = unparsed == 0 and dns_unparsed == 0
    message = "OK"
    if unparsed:
        message = "UNPARSED_PACKETS"
    elif dns_unparsed:
        message = "DNS_QNAME_UNPARSED"
    return PcapFlowObservation(
        packet_count=count,
        flows=flows,
        unparsed=unparsed + dns_unparsed,
        dns_qnames=qnames,
        parse_complete=parse_complete,
        message=message,
    )
