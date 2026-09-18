"""Route / interface / resolver coverage before overlay or submit.

A YES flag is not evidence.  Coverage is bound to parsed observations or a
validated preflight record with explicit per-family evidence.  Comment-only,
malformed, stale, contradictory, or unsupported resolver/route input is
incomplete.  Empty packet captures are not a coverage failure.

Each address family (IPv4, IPv6) requires explicit inspection evidence
identifying the inspection performed, successful completion, and the output
it produced.  PRESENT means defaults were observed; OBSERVED_ABSENT means a
successful family-specific inspection found no defaults; NOT_OBSERVED means
no valid inspection was performed for that family.  Both families must be at
least OBSERVED_ABSENT for coverage to pass.  An empty successful IPv6-specific
inspection can establish OBSERVED_ABSENT.  An IPv4-only text file cannot.
"""

from __future__ import annotations

import hashlib
import ipaddress
import json
import os
import socket
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Mapping

REQUIRED_CAPTURE_IFACE = "ens5"
PREFLIGHT_SCHEMA = "AISB_01C6A_PREFLIGHT_COVERAGE_V1"
EVIDENCE_SCHEMA = "AISB_01C6A_COVERAGE_EVIDENCE_V1"
DEFAULT_PREFLIGHT_MAX_AGE_SEC = 3600
DEFAULT_EVIDENCE_MAX_AGE_SEC = 3600

FAMILY_PRESENT = "PRESENT"
FAMILY_OBSERVED_ABSENT = "OBSERVED_ABSENT"
FAMILY_NOT_OBSERVED = "NOT_OBSERVED"


def _compute_output_hash(text: str) -> str:
    """SHA-256 hex digest of the UTF-8 encoded text."""
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


@dataclass
class CoverageReport:
    ok: bool
    code: str
    route_ok: bool
    resolver_ok: bool
    loopback_required: bool
    nameservers: list[str] = field(default_factory=list)
    covered_interfaces: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    source: str = "observation"
    ipv4_status: str = FAMILY_NOT_OBSERVED
    ipv6_status: str = FAMILY_NOT_OBSERVED

    @property
    def capture_ifaces(self) -> list[str]:
        ifaces = [REQUIRED_CAPTURE_IFACE]
        if self.loopback_required and "lo" not in ifaces:
            ifaces.append("lo")
        return ifaces


@dataclass
class RouteObservation:
    ifaces: set[str] = field(default_factory=set)
    ipv4_default_devs: list[str] = field(default_factory=list)
    ipv6_default_devs: list[str] = field(default_factory=list)
    unspecified_default_devs: list[str] = field(default_factory=list)
    lo_v4_nets: list[ipaddress.IPv4Network] = field(default_factory=list)
    lo_v6_nets: list[ipaddress.IPv6Network] = field(default_factory=list)
    error: str | None = None
    saw_this_family_route: bool = False
    saw_other_family_default: bool = False


def _fail(code: str, *reasons: str, **kwargs: Any) -> CoverageReport:
    report = CoverageReport(
        ok=False,
        code=code,
        route_ok=bool(kwargs.get("route_ok", False)),
        resolver_ok=bool(kwargs.get("resolver_ok", False)),
        loopback_required=bool(kwargs.get("loopback_required", False)),
        nameservers=list(kwargs.get("nameservers") or []),
        covered_interfaces=list(kwargs.get("covered_interfaces") or []),
        reasons=list(reasons) or [code],
        source=str(kwargs.get("source") or "observation"),
        ipv4_status=str(kwargs.get("ipv4_status") or FAMILY_NOT_OBSERVED),
        ipv6_status=str(kwargs.get("ipv6_status") or FAMILY_NOT_OBSERVED),
    )
    return report


def parse_nameserver_entries(resolv_conf: str) -> tuple[list[str], str | None]:
    """Parse nameserver addresses. Comments and blanks are ignored.

    The first field must be the exact directive ``nameserver``. Prefixes such
    as ``nameserverXYZ`` are not resolver directives.
    """
    if resolv_conf is None:
        return [], "RESOLVER_CONFIG_MISSING"
    found = False
    nameservers: list[str] = []
    for raw in resolv_conf.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith(";"):
            continue
        parts = line.split()
        token0 = parts[0]
        if token0 == "nameserver":
            found = True
            if len(parts) < 2:
                return [], "RESOLVER_NAMESERVER_MALFORMED"
            try:
                addr = ipaddress.ip_address(parts[1])
            except ValueError:
                return [], "RESOLVER_NAMESERVER_MALFORMED"
            nameservers.append(str(addr))
            continue
        if token0.lower().startswith("nameserver"):
            return [], "RESOLVER_DIRECTIVE_INVALID"
    if not found or not nameservers:
        return [], "RESOLVER_CONFIG_INCOMPLETE"
    return nameservers, None


def loopback_required_from_nameservers(nameservers: list[str]) -> bool:
    for item in nameservers:
        try:
            if ipaddress.ip_address(item).is_loopback:
                return True
        except ValueError:
            continue
    return False


def _is_link_listing(tokens: list[str]) -> bool:
    if len(tokens) < 2:
        return False
    first = tokens[0].rstrip(":")
    return first.isdigit() and tokens[1].endswith(":")


def _dev_from(tokens: list[str]) -> str | None:
    if "dev" not in tokens:
        return None
    idx = tokens.index("dev")
    if idx + 1 >= len(tokens):
        return None
    return tokens[idx + 1]


def _default_family(tokens: list[str], dest: str) -> int | None:
    if "via" in tokens:
        idx = tokens.index("via")
        if idx + 1 < len(tokens):
            try:
                return ipaddress.ip_address(tokens[idx + 1]).version
            except ValueError:
                pass
    if dest in ("0.0.0.0/0", "0.0.0.0"):
        return 4
    if dest in ("::/0", "::"):
        return 6
    try:
        net = ipaddress.ip_network(dest, strict=False)
        if net.prefixlen == 0:
            return net.version
    except ValueError:
        pass
    return None


def _is_default_dest(dest: str) -> bool:
    if dest in ("default", "0.0.0.0/0", "::/0"):
        return True
    try:
        net = ipaddress.ip_network(dest, strict=False)
        return net.prefixlen == 0
    except ValueError:
        return False


def parse_route_observation(route_table: str) -> RouteObservation:
    """Parse ``ip route`` observations. Link listings are not routing coverage."""
    obs = RouteObservation()
    if route_table is None or not str(route_table).strip():
        obs.error = "ROUTE_OBSERVATION_MISSING"
        return obs
    saw_route_line = False
    for raw in route_table.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        tokens = line.split()
        if _is_link_listing(tokens):
            continue
        saw_route_line = True
        dest = tokens[0]
        dest_token = dest
        if dest == "local" and len(tokens) > 1:
            dest_token = tokens[1]
        dev = _dev_from(tokens)
        if _is_default_dest(dest) or (dest == "local" and _is_default_dest(dest_token)):
            family = _default_family(tokens, dest_token)
            if not dev:
                obs.error = "ROUTE_DEFAULT_MISSING_DEV"
                return obs
            if family == 4:
                obs.ipv4_default_devs.append(dev)
            elif family == 6:
                obs.ipv6_default_devs.append(dev)
            else:
                obs.unspecified_default_devs.append(dev)
            obs.ifaces.add(dev)
            continue
        if not dev:
            continue
        try:
            net = ipaddress.ip_network(dest_token, strict=False)
        except ValueError:
            continue
        if dev == "lo":
            if isinstance(net, ipaddress.IPv4Network):
                obs.lo_v4_nets.append(net)
            elif isinstance(net, ipaddress.IPv6Network):
                obs.lo_v6_nets.append(net)
    if not saw_route_line:
        obs.error = "ROUTE_OBSERVATION_NOT_ROUTE"
        return obs
    defaults = obs.ipv4_default_devs + obs.ipv6_default_devs + obs.unspecified_default_devs
    if not defaults:
        obs.error = "ROUTE_DEFAULT_MISSING"
        return obs
    if any(dev != REQUIRED_CAPTURE_IFACE for dev in defaults):
        obs.error = "ROUTE_DEFAULT_NOT_ENS5"
        return obs
    obs.ifaces.add(REQUIRED_CAPTURE_IFACE)
    if obs.lo_v4_nets or obs.lo_v6_nets:
        obs.ifaces.add("lo")
    return obs


def parse_family_observation(route_table: str, family: int) -> RouteObservation:
    """Parse one family's inspection output. Empty output is not an error.

    Unspecified ``default`` lines are attributed to *family*.  Output that
    contains only the other family's defaults is a mismatch, not observed
    absence.
    """
    obs = RouteObservation()
    if route_table is None or not str(route_table).strip():
        return obs
    saw_route_line = False
    for raw in route_table.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        tokens = line.split()
        if _is_link_listing(tokens):
            continue
        saw_route_line = True
        dest = tokens[0]
        dest_token = dest
        if dest == "local" and len(tokens) > 1:
            dest_token = tokens[1]
        dev = _dev_from(tokens)
        if _is_default_dest(dest) or (dest == "local" and _is_default_dest(dest_token)):
            line_family = _default_family(tokens, dest_token)
            if line_family is None:
                line_family = family
            if not dev:
                obs.error = "ROUTE_DEFAULT_MISSING_DEV"
                return obs
            if line_family == 4:
                obs.ipv4_default_devs.append(dev)
            elif line_family == 6:
                obs.ipv6_default_devs.append(dev)
            else:
                obs.unspecified_default_devs.append(dev)
            if line_family == family:
                obs.ifaces.add(dev)
                obs.saw_this_family_route = True
            else:
                obs.saw_other_family_default = True
            continue
        if not dev:
            continue
        try:
            net = ipaddress.ip_network(dest_token, strict=False)
        except ValueError:
            continue
        if net.version == family:
            obs.saw_this_family_route = True
        if dev == "lo":
            if isinstance(net, ipaddress.IPv4Network):
                obs.lo_v4_nets.append(net)
            elif isinstance(net, ipaddress.IPv6Network):
                obs.lo_v6_nets.append(net)
    if not saw_route_line:
        obs.error = "ROUTE_OBSERVATION_NOT_ROUTE"
        return obs
    this_defaults = obs.ipv4_default_devs if family == 4 else obs.ipv6_default_devs
    if family == 4:
        this_defaults = this_defaults + obs.unspecified_default_devs
    else:
        this_defaults = this_defaults + obs.unspecified_default_devs
    if obs.saw_other_family_default and not obs.saw_this_family_route and not this_defaults:
        obs.error = "ROUTE_FAMILY_OUTPUT_MISMATCH"
        return obs
    if this_defaults:
        if any(dev != REQUIRED_CAPTURE_IFACE for dev in this_defaults):
            obs.error = "ROUTE_DEFAULT_NOT_ENS5"
            return obs
        obs.ifaces.add(REQUIRED_CAPTURE_IFACE)
    if obs.lo_v4_nets or obs.lo_v6_nets:
        obs.ifaces.add("lo")
    return obs


def parse_route_interfaces(route_table: str) -> tuple[set[str], str | None]:
    obs = parse_route_observation(route_table)
    return set(obs.ifaces), obs.error


def load_preflight_record(raw: Mapping[str, Any] | str | None) -> dict[str, Any] | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        try:
            obj = json.loads(text)
        except json.JSONDecodeError as exc:
            raise CoverageParseError("PREFLIGHT_RECORD_MALFORMED", str(exc)) from exc
    else:
        obj = dict(raw)
    if not isinstance(obj, dict):
        raise CoverageParseError("PREFLIGHT_RECORD_MALFORMED", "preflight is not an object")
    return obj


class CoverageParseError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _as_unix_timestamp(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return float(text)
        except ValueError:
            pass
        iso = text[:-1] + "+00:00" if text.endswith("Z") else text
        try:
            return datetime.fromisoformat(iso).timestamp()
        except ValueError:
            return None
    return None


def _generic_default_fields(record: Mapping[str, Any]) -> list[str]:
    found: list[str] = []
    rec_defaults = record.get("defaults") or record.get("default_devs")
    if isinstance(rec_defaults, list):
        found.extend(str(x) for x in rec_defaults if x)
    for key in ("default_dev", "default_interface"):
        value = record.get(key)
        if value:
            found.append(str(value))
    return found


def _family_default_dev(record: Mapping[str, Any], family: int) -> str | None:
    key = "default_ipv4_dev" if family == 4 else "default_ipv6_dev"
    value = record.get(key)
    if value:
        return str(value)
    return None


def _validate_preflight(
    record: Mapping[str, Any],
    *,
    nameservers: list[str],
    loopback_required: bool,
    ifaces: set[str],
    now_unix: float,
    max_age_sec: float,
    expected_hostname: str,
    observation: RouteObservation | None = None,
    ipv4_status: str = FAMILY_NOT_OBSERVED,
    ipv6_status: str = FAMILY_NOT_OBSERVED,
    route_table: str = "",
    route_table_v6: str = "",
) -> str | None:
    schema = record.get("schema") or record.get("schema_id")
    if schema not in (None, PREFLIGHT_SCHEMA, EVIDENCE_SCHEMA) and schema != "v1":
        return "PREFLIGHT_SCHEMA_UNSUPPORTED"
    raw_ts = record.get("checked_at_unix")
    if raw_ts is None:
        raw_ts = record.get("checked_at")
    checked_f = _as_unix_timestamp(raw_ts)
    if checked_f is None:
        return "PREFLIGHT_TIMESTAMP_MISSING" if raw_ts is None else "PREFLIGHT_TIMESTAMP_MALFORMED"
    if checked_f != checked_f or checked_f < 0:
        return "PREFLIGHT_TIMESTAMP_MALFORMED"
    age = now_unix - checked_f
    if age > max_age_sec:
        return "PREFLIGHT_STALE"
    if age < -max_age_sec:
        return "PREFLIGHT_TIMESTAMP_MALFORMED"
    host = record.get("hostname") or record.get("host") or record.get("observed_on_host")
    if not host:
        return "PREFLIGHT_HOST_MISSING"
    if str(host) != str(expected_hostname):
        return "PREFLIGHT_HOST_MISMATCH"
    rec_ifaces = record.get("interfaces") or record.get("covered_interfaces") or []
    if not isinstance(rec_ifaces, list) or not rec_ifaces:
        return "PREFLIGHT_INTERFACES_MISSING"
    rec_ifaces_s = {str(x) for x in rec_ifaces}
    if REQUIRED_CAPTURE_IFACE not in rec_ifaces_s:
        return "PREFLIGHT_ENS5_MISSING"
    rec_ns = record.get("nameservers") or []
    if not isinstance(rec_ns, list) or not rec_ns:
        return "PREFLIGHT_NAMESERVERS_MISSING"
    parsed_ns: list[str] = []
    for item in rec_ns:
        try:
            parsed_ns.append(str(ipaddress.ip_address(str(item))))
        except ValueError:
            return "PREFLIGHT_NAMESERVER_MALFORMED"
    if nameservers and {str(ipaddress.ip_address(n)) for n in nameservers} != set(parsed_ns):
        return "PREFLIGHT_RESOLVER_CONTRADICTORY"

    generic = _generic_default_fields(record)
    v4_dev = _family_default_dev(record, 4)
    v6_dev = _family_default_dev(record, 6)
    if generic and not v4_dev and not v6_dev:
        if ipv4_status == FAMILY_NOT_OBSERVED or ipv6_status == FAMILY_NOT_OBSERVED:
            return "PREFLIGHT_GENERIC_DEFAULT_DEV"
        if any(dev != REQUIRED_CAPTURE_IFACE for dev in generic):
            return "PREFLIGHT_DEFAULT_NOT_ENS5"
    else:
        family_devs = [d for d in (v4_dev, v6_dev) if d]
        if not family_devs and not generic:
            return "PREFLIGHT_DEFAULT_MISSING"
        if any(dev != REQUIRED_CAPTURE_IFACE for dev in family_devs + generic):
            return "PREFLIGHT_DEFAULT_NOT_ENS5"
        if ipv4_status == FAMILY_PRESENT and v4_dev and v4_dev != REQUIRED_CAPTURE_IFACE:
            return "PREFLIGHT_DEFAULT_NOT_ENS5"
        if ipv6_status == FAMILY_PRESENT and v6_dev and v6_dev != REQUIRED_CAPTURE_IFACE:
            return "PREFLIGHT_DEFAULT_NOT_ENS5"
        if ipv6_status == FAMILY_OBSERVED_ABSENT and v6_dev:
            return "PREFLIGHT_IPV6_DEFAULT_CONTRADICTORY"
        if ipv4_status == FAMILY_OBSERVED_ABSENT and v4_dev:
            return "PREFLIGHT_IPV4_DEFAULT_CONTRADICTORY"

    bind_err = _preflight_output_binding(record, route_table, route_table_v6)
    if bind_err:
        return bind_err

    rec_loop = record.get("loopback_required")
    if rec_loop is not None and bool(rec_loop) != bool(loopback_required):
        return "PREFLIGHT_LOOPBACK_CONTRADICTORY"
    if loopback_required and "lo" not in rec_ifaces_s:
        return "PREFLIGHT_LOOPBACK_MISSING"
    if ifaces and REQUIRED_CAPTURE_IFACE in ifaces:
        if REQUIRED_CAPTURE_IFACE not in rec_ifaces_s:
            return "PREFLIGHT_ROUTE_CONTRADICTORY"
    if observation is not None and observation.error:
        return observation.error
    return None


def _loopback_addrs(nameservers: list[str]) -> list[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    found: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
    for item in nameservers:
        addr = ipaddress.ip_address(item)
        if addr.is_loopback:
            found.append(addr)
    return found


def _lo_covers(addr: ipaddress.IPv4Address | ipaddress.IPv6Address, obs: RouteObservation) -> bool:
    if addr.version == 4:
        return any(addr in net for net in obs.lo_v4_nets)
    return any(addr in net for net in obs.lo_v6_nets)


def _inspection_family(inspection: str) -> int | None:
    text = (inspection or "").strip().lower()
    if not text:
        return None
    is_v6 = any(token in text for token in ("-6", "ipv6", "ip6"))
    is_v4 = any(token in text for token in ("-4", "ipv4", "ip4"))
    if is_v6 and not is_v4:
        return 6
    if is_v4 and not is_v6:
        return 4
    if is_v6 and is_v4:
        return None
    if "route" in text:
        return 4
    return None


def _family_block(container: Mapping[str, Any], family: int) -> Mapping[str, Any] | None:
    key = "ipv4" if family == 4 else "ipv6"
    block = container.get(key)
    if isinstance(block, dict):
        return block
    return None


def _outputs_from_preflight(record: Mapping[str, Any]) -> tuple[str, str]:
    v4 = record.get("ipv4_output") or record.get("route_table") or ""
    v6 = record.get("ipv6_output") or record.get("route_table_v6") or ""
    v4_block = _family_block(record, 4)
    v6_block = _family_block(record, 6)
    if not v4 and v4_block is not None:
        v4 = v4_block.get("output") or ""
    if not v6 and v6_block is not None:
        v6 = v6_block.get("output") or ""
    nested = record.get("evidence")
    if isinstance(nested, dict):
        n4, n6 = _outputs_from_preflight(nested)
        if not v4:
            v4 = n4
        if not v6:
            v6 = n6
    return str(v4), str(v6)


def _evidence_from_preflight(record: Mapping[str, Any] | None) -> Mapping[str, Any] | None:
    if not record:
        return None
    nested = record.get("evidence")
    if isinstance(nested, dict):
        return nested
    v4 = _family_block(record, 4)
    v6 = _family_block(record, 6)
    if v4 is not None and "inspection" in v4:
        return record
    if v6 is not None and "inspection" in v6:
        return record
    return None


def _preflight_output_binding(
    record: Mapping[str, Any],
    route_table: str,
    route_table_v6: str,
) -> str | None:
    has_raw = bool(str(route_table).strip() or str(route_table_v6).strip())
    if not has_raw:
        return None
    ev = record.get("evidence") if isinstance(record.get("evidence"), dict) else record
    if not isinstance(ev, Mapping):
        return "PREFLIGHT_OUTPUT_BINDING_MISSING"
    v4 = _family_block(ev, 4)
    v6 = _family_block(ev, 6)
    if v4 is None and v6 is None:
        return "PREFLIGHT_OUTPUT_BINDING_MISSING"
    if v4 is not None:
        expected = v4.get("output_sha256")
        if not expected:
            return "PREFLIGHT_OUTPUT_BINDING_MISSING"
        if str(expected) != _compute_output_hash(route_table):
            return "PREFLIGHT_OUTPUT_BINDING_MISMATCH"
    if v6 is not None:
        expected = v6.get("output_sha256")
        if not expected:
            return "PREFLIGHT_OUTPUT_BINDING_MISSING"
        if str(expected) != _compute_output_hash(route_table_v6):
            return "PREFLIGHT_OUTPUT_BINDING_MISMATCH"
    return None


def _validate_family_evidence(
    record: Mapping[str, Any],
    output: str,
    family: int,
) -> str | None:
    """Validate a single family evidence record. *family* is 4 or 6."""
    label = "IPV4" if family == 4 else "IPV6"
    inspection = record.get("inspection")
    if not inspection or not isinstance(inspection, str) or not inspection.strip():
        return f"EVIDENCE_{label}_INSPECTION_MISSING"
    identified = _inspection_family(inspection)
    if identified != family:
        return f"EVIDENCE_{label}_INSPECTION_NOT_FAMILY"
    success = record.get("success")
    if not isinstance(success, bool):
        return f"EVIDENCE_{label}_SUCCESS_MISSING"
    if not success:
        return f"EVIDENCE_{label}_FAILED"
    expected_hash = record.get("output_sha256")
    if not expected_hash or not isinstance(expected_hash, str):
        return f"EVIDENCE_{label}_BINDING_MISSING"
    actual_hash = _compute_output_hash(output)
    if actual_hash != expected_hash:
        return f"EVIDENCE_{label}_BINDING_MISMATCH"
    return None


def _validate_evidence(
    evidence: Mapping[str, Any],
    *,
    route_table: str,
    route_table_v6: str,
    now_unix: float,
    max_age_sec: float,
    expected_hostname: str,
) -> tuple[dict[int, str], str | None]:
    """Validate coverage evidence and return per-family statuses.

    Returns ``(family_statuses, error_or_None)``.  *family_statuses* maps
    address family (4 or 6) to PRESENT / OBSERVED_ABSENT / NOT_OBSERVED.
    If *error_or_None* is set, coverage must be rejected.
    """
    schema = evidence.get("schema")
    if schema is not None and schema not in (EVIDENCE_SCHEMA, PREFLIGHT_SCHEMA, "v1"):
        return {}, "EVIDENCE_SCHEMA_UNSUPPORTED"

    raw_ts = evidence.get("checked_at_unix")
    if raw_ts is None:
        raw_ts = evidence.get("checked_at")
    checked_f = _as_unix_timestamp(raw_ts)
    if checked_f is None:
        code = "EVIDENCE_TIMESTAMP_MISSING" if raw_ts is None else "EVIDENCE_TIMESTAMP_MALFORMED"
        return {}, code
    if checked_f != checked_f or checked_f < 0:
        return {}, "EVIDENCE_TIMESTAMP_MALFORMED"
    age = now_unix - checked_f
    if age > max_age_sec:
        return {}, "EVIDENCE_STALE"
    if age < -max_age_sec:
        return {}, "EVIDENCE_TIMESTAMP_MALFORMED"

    host = evidence.get("hostname") or evidence.get("host") or evidence.get("observed_on_host")
    if not host:
        return {}, "EVIDENCE_HOST_MISSING"
    if str(host) != str(expected_hostname):
        return {}, "EVIDENCE_HOST_MISMATCH"

    statuses: dict[int, str] = {}

    v4_ev = evidence.get("ipv4")
    if v4_ev is None or not isinstance(v4_ev, dict):
        statuses[4] = FAMILY_NOT_OBSERVED
    else:
        v4_err = _validate_family_evidence(v4_ev, route_table, 4)
        if v4_err:
            return {}, v4_err
        statuses[4] = FAMILY_PRESENT if str(route_table).strip() else FAMILY_OBSERVED_ABSENT

    v6_ev = evidence.get("ipv6")
    if v6_ev is None or not isinstance(v6_ev, dict):
        statuses[6] = FAMILY_NOT_OBSERVED
    else:
        v6_err = _validate_family_evidence(v6_ev, route_table_v6, 6)
        if v6_err:
            return {}, v6_err
        statuses[6] = FAMILY_PRESENT if str(route_table_v6).strip() else FAMILY_OBSERVED_ABSENT

    return statuses, None


def _merge_obs(left: RouteObservation | None, right: RouteObservation | None) -> RouteObservation:
    merged = RouteObservation()
    for src in (left, right):
        if src is None:
            continue
        merged.ifaces |= src.ifaces
        merged.ipv4_default_devs.extend(src.ipv4_default_devs)
        merged.ipv6_default_devs.extend(src.ipv6_default_devs)
        merged.unspecified_default_devs.extend(src.unspecified_default_devs)
        merged.lo_v4_nets.extend(src.lo_v4_nets)
        merged.lo_v6_nets.extend(src.lo_v6_nets)
    return merged


def _family_defaults(obs: RouteObservation, family: int) -> list[str]:
    if family == 4:
        return list(obs.ipv4_default_devs) + list(obs.unspecified_default_devs)
    return list(obs.ipv6_default_devs) + list(obs.unspecified_default_devs)


def assess_coverage(
    *,
    resolv_conf: str,
    route_table: str = "",
    route_table_v6: str = "",
    evidence: Mapping[str, Any] | None = None,
    preflight: Mapping[str, Any] | str | None = None,
    now_unix: float | None = None,
    max_age_sec: float | None = None,
    route_flag_yes: bool = False,
    expected_hostname: str | None = None,
) -> CoverageReport:
    """Decide coverage from parsed observations and/or a validated preflight.

    ``route_flag_yes`` is recorded only.  It never satisfies route coverage.

    Both IPv4 and IPv6 require explicit inspection evidence.  Without evidence,
    neither family is covered and coverage fails.  An unrelated fresh preflight
    cannot validate arbitrary raw text.
    """
    _ = route_flag_yes  # unsubstantiated YES is not evidence
    clock = time.time if now_unix is None else (lambda: now_unix)
    age_limit = DEFAULT_PREFLIGHT_MAX_AGE_SEC if max_age_sec is None else float(max_age_sec)
    host_expect = socket.gethostname() if expected_hostname is None else expected_hostname

    nameservers, ns_err = parse_nameserver_entries(resolv_conf)
    if ns_err:
        return _fail(ns_err, ns_err, nameservers=nameservers, source="observation")
    loopback_ns = _loopback_addrs(nameservers)
    loopback_required = bool(loopback_ns)
    ns_versions = {ipaddress.ip_address(item).version for item in nameservers}
    non_loop_v6 = any(
        ipaddress.ip_address(item).version == 6 and not ipaddress.ip_address(item).is_loopback
        for item in nameservers
    )

    try:
        record = load_preflight_record(preflight)
    except CoverageParseError as exc:
        return _fail(exc.code, str(exc), nameservers=nameservers, loopback_required=loopback_required)

    raw_v4 = route_table or ""
    raw_v6 = route_table_v6 or ""
    if record is not None:
        pf_v4, pf_v6 = _outputs_from_preflight(record)
        if not str(raw_v4).strip() and pf_v4:
            raw_v4 = pf_v4
        if not str(raw_v6).strip() and str(pf_v6):
            raw_v6 = pf_v6

    evidence_obj: Mapping[str, Any] | None = evidence
    if evidence_obj is None and record is not None:
        evidence_obj = _evidence_from_preflight(record)

    ipv4_status = FAMILY_NOT_OBSERVED
    ipv6_status = FAMILY_NOT_OBSERVED
    has_raw = bool(str(raw_v4).strip() or str(raw_v6).strip())
    if evidence_obj is None and record is None and not has_raw:
        return _fail(
            "ROUTE_COVERAGE_MISSING",
            "ROUTE_COVERAGE_MISSING",
            nameservers=nameservers,
            resolver_ok=True,
            loopback_required=loopback_required,
            source="missing",
        )

    if evidence_obj is not None:
        family_statuses, ev_err = _validate_evidence(
            evidence_obj,
            route_table=raw_v4,
            route_table_v6=raw_v6,
            now_unix=float(clock()),
            max_age_sec=age_limit,
            expected_hostname=host_expect,
        )
        if ev_err:
            return _fail(
                ev_err, ev_err,
                nameservers=nameservers,
                loopback_required=loopback_required,
                source="evidence",
                ipv4_status=ipv4_status,
                ipv6_status=ipv6_status,
            )
        ipv4_status = family_statuses.get(4, FAMILY_NOT_OBSERVED)
        ipv6_status = family_statuses.get(6, FAMILY_NOT_OBSERVED)

    if ipv4_status == FAMILY_NOT_OBSERVED:
        return _fail(
            "EVIDENCE_IPV4_NOT_OBSERVED",
            "EVIDENCE_IPV4_NOT_OBSERVED",
            nameservers=nameservers,
            loopback_required=loopback_required,
            source="evidence",
            ipv4_status=ipv4_status,
            ipv6_status=ipv6_status,
        )
    if ipv6_status == FAMILY_NOT_OBSERVED:
        return _fail(
            "EVIDENCE_IPV6_NOT_OBSERVED",
            "EVIDENCE_IPV6_NOT_OBSERVED",
            nameservers=nameservers,
            loopback_required=loopback_required,
            source="evidence",
            ipv4_status=ipv4_status,
            ipv6_status=ipv6_status,
        )

    ifaces: set[str] = set()
    source = "observation"
    obs_v4: RouteObservation | None = None
    obs_v6: RouteObservation | None = None

    if ipv4_status == FAMILY_PRESENT or str(raw_v4).strip():
        obs_v4 = parse_family_observation(raw_v4, 4)
        if ipv4_status == FAMILY_PRESENT:
            if obs_v4.error:
                code = (
                    "EVIDENCE_IPV4_OUTPUT_WRONG_FAMILY"
                    if obs_v4.error == "ROUTE_FAMILY_OUTPUT_MISMATCH"
                    else obs_v4.error
                )
                return _fail(
                    code, code,
                    nameservers=nameservers,
                    loopback_required=loopback_required,
                    covered_interfaces=sorted(obs_v4.ifaces),
                    ipv4_status=ipv4_status,
                    ipv6_status=ipv6_status,
                )
            if not _family_defaults(obs_v4, 4):
                ipv4_status = FAMILY_OBSERVED_ABSENT
            else:
                ipv4_status = FAMILY_PRESENT
                ifaces |= obs_v4.ifaces
        elif obs_v4.error and obs_v4.error not in ("ROUTE_OBSERVATION_MISSING",):
            pass
        else:
            ifaces |= obs_v4.ifaces

    if ipv6_status == FAMILY_PRESENT:
        obs_v6 = parse_family_observation(raw_v6, 6)
        if obs_v6.error:
            code = (
                "EVIDENCE_IPV6_OUTPUT_WRONG_FAMILY"
                if obs_v6.error == "ROUTE_FAMILY_OUTPUT_MISMATCH"
                else obs_v6.error
            )
            return _fail(
                code, code,
                nameservers=nameservers,
                loopback_required=loopback_required,
                covered_interfaces=sorted(ifaces | obs_v6.ifaces),
                ipv4_status=ipv4_status,
                ipv6_status=ipv6_status,
            )
        if not _family_defaults(obs_v6, 6):
            ipv6_status = FAMILY_OBSERVED_ABSENT
        else:
            ipv6_status = FAMILY_PRESENT
            ifaces |= obs_v6.ifaces
    elif ipv6_status == FAMILY_OBSERVED_ABSENT:
        if str(raw_v6).strip():
            obs_v6 = parse_family_observation(raw_v6, 6)
            if obs_v6.error == "ROUTE_FAMILY_OUTPUT_MISMATCH":
                return _fail(
                    "EVIDENCE_IPV6_OUTPUT_WRONG_FAMILY",
                    "EVIDENCE_IPV6_OUTPUT_WRONG_FAMILY",
                    nameservers=nameservers,
                    loopback_required=loopback_required,
                    covered_interfaces=sorted(ifaces),
                    ipv4_status=ipv4_status,
                    ipv6_status=FAMILY_NOT_OBSERVED,
                )

    obs = _merge_obs(obs_v4, obs_v6)
    ifaces |= set(obs.ifaces)

    if ipv4_status != FAMILY_PRESENT and ipv6_status != FAMILY_PRESENT:
        return _fail(
            "ROUTE_DEFAULT_MISSING",
            "ROUTE_DEFAULT_MISSING",
            nameservers=nameservers,
            loopback_required=loopback_required,
            covered_interfaces=sorted(ifaces),
            ipv4_status=ipv4_status,
            ipv6_status=ipv6_status,
        )

    if 4 in ns_versions and ipv4_status != FAMILY_PRESENT:
        return _fail(
            "ROUTE_IPV4_DEFAULT_MISSING",
            "ROUTE_IPV4_DEFAULT_MISSING",
            nameservers=nameservers,
            loopback_required=loopback_required,
            covered_interfaces=sorted(ifaces),
            ipv4_status=ipv4_status,
            ipv6_status=ipv6_status,
        )
    if (6 in ns_versions and non_loop_v6) and ipv6_status != FAMILY_PRESENT:
        return _fail(
            "ROUTE_IPV6_DEFAULT_MISSING",
            "ROUTE_IPV6_DEFAULT_MISSING",
            nameservers=nameservers,
            loopback_required=loopback_required,
            covered_interfaces=sorted(ifaces),
            ipv4_status=ipv4_status,
            ipv6_status=ipv6_status,
        )
    for addr in loopback_ns:
        if not _lo_covers(addr, obs):
            return _fail(
                "LOOPBACK_COVERAGE_MISSING",
                "LOOPBACK_COVERAGE_MISSING",
                nameservers=nameservers,
                resolver_ok=True,
                route_ok=True,
                loopback_required=True,
                covered_interfaces=sorted(ifaces),
                ipv4_status=ipv4_status,
                ipv6_status=ipv6_status,
            )

    if record is not None:
        source = "preflight" if not has_raw else "observation+preflight"
        pre_err = _validate_preflight(
            record,
            nameservers=nameservers,
            loopback_required=loopback_required,
            ifaces=ifaces,
            now_unix=float(clock()),
            max_age_sec=age_limit,
            expected_hostname=host_expect,
            observation=obs if (obs.ipv4_default_devs or obs.ipv6_default_devs) else None,
            ipv4_status=ipv4_status,
            ipv6_status=ipv6_status,
            route_table=raw_v4,
            route_table_v6=raw_v6,
        )
        if pre_err:
            return _fail(
                pre_err,
                pre_err,
                nameservers=nameservers,
                loopback_required=loopback_required,
                covered_interfaces=sorted(ifaces),
                source=source,
                ipv4_status=ipv4_status,
                ipv6_status=ipv6_status,
            )
        rec_ifaces = record.get("interfaces") or record.get("covered_interfaces") or []
        ifaces = ifaces | {str(x) for x in rec_ifaces}

    if REQUIRED_CAPTURE_IFACE not in ifaces:
        return _fail(
            "ROUTE_ENS5_UNCOVERED",
            "ROUTE_ENS5_UNCOVERED",
            nameservers=nameservers,
            resolver_ok=True,
            loopback_required=loopback_required,
            covered_interfaces=sorted(ifaces),
            source=source,
            ipv4_status=ipv4_status,
            ipv6_status=ipv6_status,
        )
    if loopback_required and "lo" not in ifaces:
        return _fail(
            "LOOPBACK_COVERAGE_MISSING",
            "LOOPBACK_COVERAGE_MISSING",
            nameservers=nameservers,
            resolver_ok=True,
            route_ok=True,
            loopback_required=True,
            covered_interfaces=sorted(ifaces),
            source=source,
            ipv4_status=ipv4_status,
            ipv6_status=ipv6_status,
        )
    return CoverageReport(
        ok=True,
        code="COVERAGE_OK",
        route_ok=True,
        resolver_ok=True,
        loopback_required=loopback_required,
        nameservers=nameservers,
        covered_interfaces=sorted(ifaces),
        reasons=["COVERAGE_OK"],
        source=source,
        ipv4_status=ipv4_status,
        ipv6_status=ipv6_status,
    )


def coverage_from_env_files(
    *,
    resolv_conf: str,
    route_table_text: str = "",
    route_table_v6_text: str = "",
    evidence_text: str = "",
    preflight_text: str = "",
    route_flag_yes: bool = False,
    now_unix: float | None = None,
    max_age_sec: float | None = None,
) -> CoverageReport:
    preflight_obj: Mapping[str, Any] | str | None = preflight_text or None
    evidence_obj: Mapping[str, Any] | None = None
    if evidence_text and evidence_text.strip():
        try:
            evidence_obj = json.loads(evidence_text)
        except (json.JSONDecodeError, TypeError):
            return _fail("EVIDENCE_MALFORMED", "EVIDENCE_MALFORMED")
    return assess_coverage(
        resolv_conf=resolv_conf,
        route_table=route_table_text,
        route_table_v6=route_table_v6_text,
        evidence=evidence_obj,
        preflight=preflight_obj,
        now_unix=now_unix,
        max_age_sec=max_age_sec,
        route_flag_yes=route_flag_yes,
    )


def read_optional_file(path: str | None) -> str:
    if not path:
        return ""
    if not os.path.isfile(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read()
