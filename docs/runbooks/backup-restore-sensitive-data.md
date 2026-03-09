# Runbook: Backup / Restore Sensitive Data Protection Handling

## Title

Backup / Restore Sensitive Data Protection Handling

## Trigger

- Before any backup operation
- Before any restore operation
- Quarterly backup security review (per PHASE-63A Section 8.2)

## Severity

Operational. Failure to protect backups may trigger P1 if exposure confirmed.

## Purpose

Ensure backups and restored data are encrypted, off-host, access-controlled, and protected at restore time.

## Prerequisites

- Access to backup procedures (docs/backup/*)
- Access to restore runbooks (postgresql-restore, configuration-restore, full-stack-rebuild)

## Pre-Backup Verification

1. **Encryption** — PostgreSQL dumps and config backups must be encrypted (e.g. GPG, cloud provider encryption).
2. **Off-host storage** — Backups must not reside only on production node.
3. **Access control** — Restrict to operators; no application access.
4. **Integrity** — Checksum verification per docs/backup/backup-verification.md.

## Pre-Restore Verification

1. **Restore target** — Staging or isolated test only; never restore into production as a drill.
2. **Backup integrity** — Verify checksum before restore.
3. **Access controls** — Restore target must have same access controls as production.

## Restore-Time Protection

1. **Network** — Restored data must not be exposed to untrusted networks.
2. **Post-restore** — Verify no residual sensitive data in logs or temp files.
3. **Cleanup** — Remove or secure any copies used for drill.

## Quarterly Backup Security Review

| Check | Expectation |
|-------|-------------|
| Backups encrypted | Yes |
| Off-host storage | Yes |
| Access restricted | Operators only |
| Retention per policy | Documented |

## Evidence / Sign-off

- Backup security review: document findings; platform owner or operator sign-off.
- Per PHASE-63A Section 8.3.

**Reference:** PHASE-63A-DESIGN.md Section 6, PHASE-61A-DESIGN.md
