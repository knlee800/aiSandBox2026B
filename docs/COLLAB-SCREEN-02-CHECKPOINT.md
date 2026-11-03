# COLLAB-SCREEN-02 — Checkpoint

**Task:** COLLAB-SCREEN-02 — Stop the collaboration page refresh loop
**Status:** COMPLETE AND LOCKED — 2026-11-03
**Workstream:** AGENT. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith saw the page flicker and show "That did not work. Try again." during COLLAB-LIVE-05. The run itself completed. Admitted to Lane 2 in 51d80016753b5b8d2aff2ae450d76359135cf10d beside the paused live window: the first real use of the GOV-OS-04 pause rule.

## Cause and fix

frontend/hooks/useTranslations.ts returns a new t function on every render. The page listed t, and callbacks built from it, in effect dependencies, so every render fetched the list and the run again and set state: an endless loop. The page now reads t and its callbacks through refs, so the list loads once per project id, the run once per selection, then only on the 5-second timer while active. The shared hook is unchanged. Text and behaviour otherwise unchanged.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 831 passed, 0 failed, including a test that renders with a new t each time and counts fetches |
| frontend `npm run build` | exit 0; tsconfig.tsbuildinfo restored |
| Validator | exit 0 at this record; COLLAB-LIVE-05 resumed, marker off |

## Implementer

Cursor CLI, requested grok-4.7-high, one run.

## Note

The same new-function-per-render pattern can affect any other component that lists t in effect dependencies. Not checked outside this page.
