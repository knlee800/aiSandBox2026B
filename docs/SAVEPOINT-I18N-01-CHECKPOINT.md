# SAVEPOINT-I18N-01 — Checkpoint

**Task:** SAVEPOINT-I18N-01 — Translate the hardcoded Save Point text in the workspace History panel
**Status:** COMPLETE AND LOCKED — 2026-10-30
**Workstream:** PRODUCT. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** the follow-up candidate in docs/CLEAN-BASELINE-DEPLOY-01-CHECKPOINT.md and the read-only investigation of 2026-10-30.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Registration and admission | registered on Keith's approval, then admitted to Lane 1 with FRONTEND and I18N | c169398b5f089db18a5c81e1979c00c4363fe0ba, 800c579291c702d85c1f263b474cafac297c2ed2 |
| 1. Implementation | Cursor CLI (cursor-delegate), grok-4.7-high, session 2f7e51ce-9967-4360-8f2c-54fd1b60fc03, one run | 1d54724507e11eefe24eb11789e2209fd7d5156b |
| 2. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| File | Change |
|---|---|
| `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | 9 new flat keys in the workspace namespace (not stateMessage, whose key sets are frozen by tests) |
| `frontend/components/workspace/workspace-shell.tsx` | 6 literal occurrences replaced; module-level workspaceCopy added beside stateMessageCopy |
| `frontend/app/[locale]/app/page.tsx` | 4 literal occurrences replaced; getWorkspaceMessages added; error.message still takes priority over the fallback |
| `frontend/components/workspace/workspace-shell.test.tsx` | 3 new tests: keys in all locales, exact English values, old literals gone from both sources |

English text is unchanged. Not changed: the raw HTTP detail from workspace-checkpoint-create.logic.ts that the panel shows when a request fails, other hardcoded History labels, routing, styling and test IDs.

## Validation (reviewer, Node v22.14.0)

| Gate | Result | Baseline |
|---|---|---|
| frontend `npx tsc --noEmit` | exit 0 | exit 0 |
| frontend `npm test` | 789/789 | 786/786 |
| frontend `npm run build` | exit 0 | exit 0 |

Evidence copied to `C:\Users\knlee\aisb-preflight\SAVEPOINT-I18N-01\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-frontend-test.txt` | 170142 | `d504e9c4f5ddd3eef755dd8550f8a99b9e98f8d6f970393208b50d3aa76da496` |
| `reviewer-frontend-build.txt` | 2855 | `fade5cea4793525e8e5c9e3d6d9ad5edba814e2d88a5ee9dcc528747d9e6bfd9` |
| `reviewer-frontend-test-baseline.txt` | 169522 | `a231500eb317ada6aafe0b884f407ff510ac8d8b90529d1d5b0c7a52ad885d1d` |
| `cursor-brief.txt` | 6323 | `59d40bfa1d91c2b6f735c14c6f0ec4cbdd0eb3699cf83eb570080a4b92b39b50` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| All 10 occurrences come from translation keys, and the 9 keys exist in en, zh-TW and zh-CN | met |
| The English text is byte-for-byte what it was | met (test on exact values; diff review) |
| New tests check the keys in all locales and that the old literals are gone | met (3 new tests) |
| frontend tsc, npm test and npm run build pass on Node v22.14.0 with no new failures | met (789/789) |
| Only the write-scope files change, and page.tsx is the only file changed under frontend/app/ | met (six files) |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Open items

- Not deployed: ainow-staging-01 runs 7317749 until a separately authorized deploy.
- No browser check was run (LOCAL-TESTS). The zh-TW and zh-CN wording was written by the control plane from existing terms and has not been seen in a browser.
- Possible follow-ups, not registered: the raw HTTP detail shown when a request fails, and other hardcoded History labels such as Controls and Checkpoint Browser.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-30 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED; GOVERNANCE UNOWNED.
