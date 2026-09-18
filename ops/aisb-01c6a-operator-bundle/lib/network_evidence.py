"""Independent network-evidence classification.

Script routing evidence is never treated as independently observed zero
provider traffic. Encrypted DNS/DoH and unexplained HTTPS stay unresolved.
A pre-window ss row does not establish purpose.
"""

from __future__ import annotations

import ipaddress
from dataclasses import dataclass, field


SCRIPT_FIELD = "NOT_ESTABLISHED"


@dataclass
class Flow:
    src: str
    dst: str
    sport: int | None
    dport: int | None
    proto: str  # tcp/udp
    dns_qname: str | None = None


@dataclass
class NetworkEvidence:
    independent_result: str  # PASS | FAIL | INCOMPLETE
    script_provider_traffic_proof: str
    reasons: list[str] = field(default_factory=list)
    unexplained_https: list[str] = field(default_factory=list)
    encrypted_dns: list[str] = field(default_factory=list)
    xai_address_hits: list[str] = field(default_factory=list)


def _ip(value: str) -> str:
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return value


def classify_network(
    *,
    capture_lifecycle_ok: bool,
    lifecycle_reason: str,
    flows: list[Flow],
    xai_addrs: set[str],
    ss_before: set[str],
    dns_qnames: list[str],
    coverage_complete: bool = True,
    coverage_reason: str = "",
    route_coverage_ok: bool = True,
    resolver_coverage_ok: bool = True,
) -> NetworkEvidence:
    evidence = NetworkEvidence(
        independent_result="INCOMPLETE",
        script_provider_traffic_proof=SCRIPT_FIELD,
    )
    if not capture_lifecycle_ok:
        evidence.reasons.append(lifecycle_reason or "CAPTURE_LIFECYCLE_INCOMPLETE")
        return evidence
    if not coverage_complete:
        evidence.reasons.append(coverage_reason or "CAPTURE_PARSE_INCOMPLETE")
        return evidence
    if not route_coverage_ok:
        evidence.reasons.append("ROUTE_COVERAGE_MISSING")
        return evidence
    if not resolver_coverage_ok:
        evidence.reasons.append("RESOLVER_COVERAGE_MISSING")
        return evidence

    xai_norm = {_ip(a) for a in xai_addrs}
    hits = []
    unexplained = []
    encrypted = []
    for flow in flows:
        dst = _ip(flow.dst)
        dport = flow.dport
        sport = flow.sport
        ports = {p for p in (dport, sport) if p is not None}
        if dst in xai_norm or _ip(flow.src) in xai_norm:
            hits.append(f"{flow.src}->{flow.dst}:{dport}")
            continue
        if 853 in ports:
            encrypted.append(f"{flow.dst}:{dport}")
            continue
        if ports & {80, 443}:
            # ss_before does not attribute purpose; dest remains unexplained.
            _ = ss_before  # retained for operator context only
            unexplained.append(f"{flow.dst}:{dport if dport in (80, 443) else sport}")
        if flow.dns_qname and "api.x.ai" in flow.dns_qname.lower():
            evidence.reasons.append(f"DNS_QNAME api.x.ai via {flow.dst}")

    for q in dns_qnames:
        if "api.x.ai" in q.lower():
            evidence.reasons.append(f"DNS_QNAME {q}")

    evidence.xai_address_hits = hits
    evidence.unexplained_https = unexplained
    evidence.encrypted_dns = encrypted

    if hits:
        evidence.independent_result = "FAIL"
        evidence.reasons.append("PACKET_TO_XAI_ADDRESS")
        return evidence
    if encrypted:
        evidence.independent_result = "INCOMPLETE"
        evidence.reasons.append("ENCRYPTED_DNS_UNRESOLVED")
        return evidence
    if unexplained:
        evidence.independent_result = "INCOMPLETE"
        evidence.reasons.append("UNEXPLAINED_HTTPS")
        return evidence
    if any("DNS_QNAME" in r for r in evidence.reasons):
        evidence.independent_result = "INCOMPLETE"
        return evidence
    evidence.independent_result = "PASS"
    evidence.reasons.append("NO_XAI_ADDR_HITS_NO_UNRESOLVED_HTTPS")
    return evidence
