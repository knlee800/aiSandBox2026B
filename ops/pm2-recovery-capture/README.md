# PM2-RECOVERY-CAPTURE-01 — Bounded PM2 Observation Capture Mechanism

## Purpose

This tool captures a single `pm2 jlist` observation under strict
supervision with bounded deadlines (30/5/5 s), private storage, and
exact-byte hashing. It implements the pipe/EOF architecture from the
frozen design document `docs/PM2-RECOVERY-CAPTURE-01-STAGE-START.md`.

## Constraints

- **Linux only.** Uses POSIX signals (`SIGCHLD`, `SIGTERM`, `SIGKILL`),
  `os.waitpid`, `select.poll`, and Unix domain sockets.
- **Python >= 3.6.** All APIs are stdlib; no third-party dependencies.
  `capture_output=True` (3.7+) is not used.
- **No automatic retry, cleanup, or host correction** (Q3-A NO_RETRY).
- **Fake-only verification.** Tests use synthetic data only. No real PM2
  binary, daemon, socket, or environment secrets.

## Usage

```
python3 capture.py \
  --account <user>         \
  --pm2-binary <path>      \
  --pm2-home <path>        \
  --observation-id <id>    \
  --host <hostname>        \
  --captured-by <string>   \
  --acq-record <id>        \
  --output-dir <path>
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | COMPLETED — all artifacts finalized |
| 1    | FAILED — pre-invocation failure |
| 2    | FAILED — post-launch or finalization failure |
| 3    | DEFERRED — partial stream persisted |
| 10   | USAGE — invalid arguments or missing tools |

## Files

| File | Purpose |
|------|---------|
| `capture.py` | Capture mechanism script |
| `tests/test_capture.py` | Fake-only test suite (pytest) |
| `.gitattributes` | Line-ending convention |
| `SHA256SUMS` | Integrity manifest |
| `README.md` | This file |

## Requirements Predecessor

PM2-RECOVERY-ACQUISITION-01 (`docs/PM2-RECOVERY-ACQUISITION-01-STAGE-START.md`).

## Implementation Predecessor

PM2-RECOVERY-VERIFY-01 (`ops/pm2-recovery-verify/compare_dual_env.py`).

## Testing

```
cd ops/pm2-recovery-capture
python3 -m pytest tests/test_capture.py -v
```

Requires Linux with Python >= 3.6 and pytest >= 3.0.

## Operational Status

- **MECHANISM_ESTABLISHED:** NO
- **P7_ACCEPTED:** NO
- **HOST_CLEAN:** NO
- **Operational authorization:** NONE
- This tool has not been transferred, installed, or executed against
  any live PM2 environment.
