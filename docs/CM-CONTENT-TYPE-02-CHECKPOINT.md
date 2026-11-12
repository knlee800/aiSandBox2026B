# CM-CONTENT-TYPE-02 — Checkpoint

**Task:** CM-CONTENT-TYPE-02 — More preview content types
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CM-CONTENT-TYPE-01 LOCK. Admitted by the control plane on Keith's "you can keep working on other tasks first".

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and activation | Lane 2 with CONTAINER-MANAGER. The admission record carries the date 2026-11-11 from a stale template; the correct date is 2026-11-12 | 0f3d0e1 |
| 2. Implementation | sonnet subagent (Sonnet 5.5: one container-manager file and its spec) in worktree lane/CM-CONTENT-TYPE-02 as 209c1d7; main had moved, so the control plane cherry-picked it | 9669695 |
| 3. Consolidation and LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**New types in `STANDARD_CONTENT_TYPES`:**

| Extension | Type |
|---|---|
| .pdf | application/pdf |
| .mp3 | audio/mpeg |
| .wav | audio/wav |
| .ogg | audio/ogg |
| .mp4 | video/mp4 |
| .webm | video/webm |
| .webmanifest | application/manifest+json |
| .csv | text/csv; charset=utf-8 |

.avif, .otf, .txt, .xml and .map were already in the map.

- **The .js type** changes from `application/javascript` to `text/javascript; charset=utf-8`, to match .mjs; this is the current HTML standard.
  - The only comparison in the code is `startsWith('text/html')`, and the controller passes the value straight into the header.
  - The control plane found no other use of `application/javascript` in the container-manager or gateway source.
- **Unchanged:** headers, path handling and the text/plain fallback for unknown types.

**Tests:**
- 8 new rows in the `it.each` table, including an uppercase `.CSV`.
- Two assertions now expect `text/javascript`.
- Unknown types and files with no extension still fall back to text/plain.

## Gates

| Gate | Branch (control-plane rerun) | main after the cherry-pick |
|---|---|---|
| container-manager `npm test` | 21 suites, 886 passed (878 + 8), 3 skipped | `src/preview`: 3 suites, 91 passed |
| container-manager `npm run build` | exit 0 | — |
| line endings | the 2 files are LF | 2 of 2 LF |

## Limits

- **Not deployed.** It goes out with STAGING-DEPLOY-POLISH-01.
- **Still falling back to text/plain:** .md, .jsonld, .m4a, .aac, .flac, .mov, .ts and .tsx. The worker found none of them needed for static previews, so this is recorded as an observation, not a follow-up.

CHECKLIST: EVERY 11/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane on the branch and main; 8: no runtime; 10: worker committed only on its branch, cherry-picked by the control plane with autocrlf=false), BACKEND 6/6 (1 to 5: no auth, guard, internal route, template, contract or schema change; 6: no new failures)
FOLLOWUPS: 1 registered (STAGING-DEPLOY-POLISH-01, shared with COS-DRAFTS-POLISH-01) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 2 released EMPTY;
- CONTAINER-MANAGER released UNOWNED;
- not deployed.
