# COLLAB-FILES-01 — Checkpoint

**Task:** COLLAB-FILES-01 — Read-only project file access for collaboration hand-offs through Harness
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-02, including reversing the AGENT-PLATFORM-ORCH-ARCH-01 rule that hand-off jobs omit harnessVersion, for hand-offs that ask for file access only. Registered and admitted in 97d4abf10f9a653bb45f55b7011f6dda6dbf6348. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

A first hand-off may send `fileAccess: true`, carried to children. At approve those jobs go out with `harnessVersion: v1`, `harnessReadOnly: true` and a proof signed over the payload. The worker then registers and advertises only read_file, list_files and search_workspace whatever the global flags say, gives no checkpoint function, skips the snapshot save and publishes no file actions. `harnessReadOnly` without v1, a bad proof, or the tool loop off fails closed with no plain fallback. Jobs without fileAccess are unchanged. Ordinary Agent runs keep their tools. The job stays intent conversation and runMode ask, so it is charged like an Ask.

## Implementer

Cursor CLI, requested grok-4.7-xhigh, one run.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npx jest` | 39 of 39 suites; 1029 passed, 1 skipped |
| ai-service `npm run build` | exit 0 |
| api-gateway `npx jest` | 2531 passed, 7 skipped, 14 failed; only the known smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| Validator | exit 0 at this record |

## Limits

Not deployed; not run against a real provider. A live run needs the tool loop on, the same signing secret on both services, a tool-capable provider and a running session container. The browser-session allow-list does not apply to this internal path. File contents can influence an answer or a hand-off request; approval, the agent list and the absence of write tools limit that.
