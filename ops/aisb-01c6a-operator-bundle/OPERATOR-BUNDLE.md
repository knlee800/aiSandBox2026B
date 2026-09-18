# EXEC-01C6A local operator review bundle

This directory is **not** repository source. It is a local review bundle.

Accepted canary scripts, evidence, deployments, cleanup amendment, and the
2026-09-10T14:54:46Z preflight remain closed. Live execution is unauthorized.

This correction window wired executable adapters into the shipped CLI entry
points (`bin/orchestrate-canary.sh`, `bin/reconcile-readonly.sh`,
`bin/stop-capture-validate.sh`) and separated terminal status from successful
acceptance. It does **not** authorize staging, SSH, capture, PM2, canaries,
or provider calls.

## Binding (accepted, unchanged)

Do not modify accepted source. Do not silently replace claimed hashes.
LF→CRLF on the working tree is confirmed; later compile must bind to **raw
bytes** of the files as they exist on disk.

| File | Raw SHA-256 (actual bytes; bind compile to this) | LF-normalized SHA-256 | Claimed / previously recorded |
|---|---|---|---|
| services/ai-service/scripts/canary-01c6a-stub-submit.ts | `316a58770da990eab79fc0b1712da2441e6856d1c5183a2b9b7f9409dc2cc355` | `740f52e2a387d44b51ecd6392895e2c01d8a31fbbdfa7f5548d7806fcf041966` | claimed = LF-normalized |
| services/ai-service/scripts/canary-01c6a-xai-negative.ts | `459ad1eac4529749591489b986b01fb0d2f631cab99f93a04fbf00254dc4c22c` | `215bd33a92f3faed72abcb78c069ed849ee41a941a996b9439770afa125df284` | claimed = raw bytes |
| docs/AGENT-PLATFORM-EXEC-01C6A-CANARY-EVIDENCE.md | `d223c1e9205030ed26b8ca99dfae1d6b4abcfd31a6a230a9c9721e58f9a15169` | `461ee2b33e667de5a71d0ad199c497bbdf44a0f54bab1e2b168963dac40bf525` | claimed = LF-normalized |

`providerTrafficProof` remains NOT_ESTABLISHED.

## Local correction (TEMP bundle only)

Reviewed ZIP SHA-256 before this coverage correction:

`602aa60567d612e18f200ee9c52cdc7191bff4a366750e96f6eea9689d51fb08`

This pass corrected route-coverage completeness in the TEMP bundle only.
Restoration remains BLOCKED. This coverage correction does not resolve the
restoration blocker and does not authorize live execution. Accepted TypeScript,
evidence, AC, deployments, governance, and the completed preflight were not
changed. No accepted canary-suite rerun. PM2 adapter, watchdog, restoration
architecture, and capture ownership were not modified.

### Capture ownership and signaling

- The function-local `import subprocess` inside `LinuxCapture.send` is removed.
  That name made `subprocess` local for the whole function and broke the POSIX
  privileged `sudo -n kill` path.
- Fresh processes recover identity from the persisted handle / identity file.
- Current process identity is checked before signaling: live argv tokens must
  still be tcpdump with the exact `-i` interface and exact `-w` output path.
  Substring / prefix matches (for example `/tmp/owned.pcap` vs
  `/tmp/owned.pcap.extra`) are not identity. Process start identity is persisted
  and compared across a fresh-process stop. Unreadable, conflicting, or reused
  identity is refused and does not signal.
- Privileged `sudo -n kill` non-zero exits and timeouts are explicit failures.
- A `.py` mock-sudo path is not the real-sudo branch. Tests spy on the
  `/usr/bin/sudo -n kill` argv.

### Deadline enforcement and restoration

- Worker overlay window maximum is **1800** seconds. Gateway maximum is **300**
  seconds. Values that are non-finite, negative, or above those maxima are
  rejected before mutation. 86400 is invalid.
- The window is armed before the first potentially mutating restart. Later marks
  do not restart the clock.
- Restore and verification time is reserved inside those bounds
  (`AISB_01C6A_RESTORE_RESERVE_SEC`; default accounts for capture stop, pcap
  parse, and cumulative PM2 restart/dump, capped at 300s Gateway / 1800s worker).
  Submit, reconcile, capture tail, and pcap-read timeouts are capped to remaining
  work time.
- A wall-clock restore watchdog can restore overlays when the window is due
  even if `supervise()` / capture stop / pcap parse remains blocked. Restore is
  single-owner. After restore starts, overlay apply/restart is refused so a late
  apply cannot re-enable a restored overlay.
- Window violation never returns success. Recovery material is kept unless
  restore matched *and* the window was still inside bounds.
- Manual recovery remains a fallback after a reported failure. It is not the
  enforcement mechanism.

### Coverage preconditions

- Route / interface / resolver coverage is established before overlay or submit.
- `AISB_01C6A_ROUTE_COVERAGE_OK=YES` is not evidence.
- Raw-file and preflight inputs use one contract. Both IPv4 and IPv6 require
  fresh, host-bound evidence identifying the inspection performed, successful
  completion, and the output it produced (`AISB_01C6A_COVERAGE_EVIDENCE`,
  `AISB_01C6A_ROUTE_TABLE_FILE`, `AISB_01C6A_ROUTE_TABLE_V6_FILE`, and/or a
  preflight record that carries the same family evidence).
- Family status is `PRESENT`, `OBSERVED_ABSENT`, or `NOT_OBSERVED`. An empty
  successful IPv6-specific inspection (`ip -6 route show`) can establish
  `OBSERVED_ABSENT`. An IPv4-only text file cannot.
- Evidence metadata must hash-bind to the actual route output it accompanies.
  An unrelated fresh preflight cannot validate arbitrary raw text.
- Generic `default_dev` is not a substitute for family-specific observations.
  Every applicable default route is inspected, not only the last line. An
  interface name in an `ip link` listing is not routing coverage.
- Nameserver entries require the exact `nameserver` directive and a valid
  address. `nameserverXYZ` is not a resolver directive. Comment-only, malformed,
  stale, mismatched, contradictory, or unsupported coverage is incomplete.
- Loopback capture is required for every loopback nameserver (any 127.0.0.0/8
  address and `::1`), with explicit `lo` route evidence covering that address.
- Missing, failed, stale, mismatched, or contradictory evidence yields zero
  overlay restarts and zero submit spawns.
- Unsupported packet parsing stays INCOMPLETE. A valid empty capture may PASS
  observation predicates; traffic is not generated to make a pcap nonempty.

Specified overlays are applied by the real driver (`apply_overlays=None`):

- Worker (`aisandbox-ai-service`), 30-minute window: tool-loop, HMAC, dummy
  `XAI_API_KEY` only when the observed process env is not already the intended
  value.
- Gateway (`aisandbox-api-gateway`) HMAC + `GLOBAL_EXECUTION_ENABLED=true`
  for **xAI only**, ≤5-minute window.
- Stub does **not** enable Gateway execution.
- HMAC ABSENT→EMPTY authorization is checked **before** the first PM2
  mutation. Unrestorable ABSENT (including overlaying `XAI_API_KEY` that is
  currently ABSENT) is refused before mutation.
- Baseline capture is fail-closed: read failure, missing/duplicate app, or
  vault write failure stops before mutation. Observed ABSENT is stored as
  ABSENT.

Accepted xAI result contract is `outcome` / `executionId` / `requestId` /
`httpStatus` / `proofAccepted` / `providerTrafficProof` / `directEnqueueUsed`
/ `automaticRetryCount` / `postAck`. A valid `EXPECTED_XAI_REJECTION` is
terminal without `jobState` / `executionStatus`. CLI exit 0 is
`OBSERVATION_COMPLETE` even when `next_canary_allowed` is false for xAI.
Completed stub jobs already removed from Redis (`jobState=missing`) can still
be terminal.

Linux supervision reaps owned descendants after the parent exits, including
Windows job/Toolhelp descendants. Capture signaling targets the recorded
tcpdump PID, not the sudo parent, and stop/read operations are bounded.

Protected recovery material is deleted only after every required restore
comparison succeeds **and** the overlay window was not exceeded.
`vault_preserved` is taken from the actual remaining files. An unresolved
earlier vault is refused, not overwritten.

## Helpers

All files under `bin/`, `lib/`, and `config/` are transfer-required. Staging must
not assume extra tools. `bin/verify-transfer.sh` is fail-closed.

HMAC ABSENT→EMPTY is a named exception requiring later
`AISB_01C6A_HMAC_ABSENT_EMPTY_RESTORE_AUTHORIZED`. It is not extended to other variables.
PM2 `--update-env` merge cannot restore ABSENT; unsupported ABSENT restoration is
refused before mutation.

Baseline failed jobs 1/2/3 remain untouched. Usage and credit rows are retained.
Later authorized cleanup remains targeted canary-job removal, disposable-session
termination, and API-key soft-revocation.

## Not READY for live execution

This bundle is local review only. Compile/transfer/SSH/capture/PM2/keys/canaries
did not run. Coverage correction does not resolve the restoration blocker or
authorize live execution.

Windows unit tests do not prove real `sudo`, `/proc` cmdline, or Linux PID-reuse
behavior. Those paths are exercised with a subprocess-command spy and, where
the OS supports it, an owned disposable mock-tcpdump process.
