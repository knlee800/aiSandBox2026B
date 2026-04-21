# PROJ-03-A0 CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-A0
- Title: Add Feature Flag Infrastructure And Recovery Vocabulary Copy Bundle
- Nature: FRONTEND INFRASTRUCTURE / PHASE A PREREQUISITE
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-A0-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase 0 / Slice 0.1

## Objective

Introduce the `PROJECT_FIRST_UX` feature flag and a centralized recovery-vocabulary copy bundle so all Phase A and later slices can be merged behind a kill-switch with zero behavior change when the flag is off.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/feature-flags.ts` | New. Exports `PROJECT_FIRST_UX` boolean. |
| `frontend/lib/recovery-copy.ts` | New. Exports `recoveryCopy` string bundle and `RecoveryCopy` type. |
| `frontend/app/[locale]/app/page.tsx` | Added import anchors for `PROJECT_FIRST_UX` and `recoveryCopy`; no-op reference via `void projectFirstUxAnchors`. |
| `frontend/components/workspace/workspace-shell.tsx` | Added import anchors for `PROJECT_FIRST_UX` and `recoveryCopy`; no-op reference via `void projectFirstUxAnchors`. |
| `frontend/Dockerfile` | Added `ARG NEXT_PUBLIC_PROJECT_FIRST_UX=false` / `ENV NEXT_PUBLIC_PROJECT_FIRST_UX=$NEXT_PUBLIC_PROJECT_FIRST_UX` to Stage 1 build step. |

No other source files were modified.

## Implementation Details

### feature-flags.ts

```ts
export const PROJECT_FIRST_UX = process.env.NEXT_PUBLIC_PROJECT_FIRST_UX === 'true';
```

Kill-switch semantics: the flag evaluates `true` only when the env var is the exact string `"true"`. Any missing value, empty string, or any other value evaluates `false`, preserving today's behavior completely.

### recovery-copy.ts

Exports `recoveryCopy` as a `const` object under three namespaces:

- `actions`: `startNewProject`, `openExistingProject`, `reopenProject`, `tryAgain`, `openOlderVersion`
- `status`: `workspaceDisconnected`, `workspaceStoppedDueToInactivity`, `workspaceFailedToStart`, `workspaceWasRestarted`, `saving`, `allChangesSaved`, `yourWorkIsSaved`, `saveFailedRetry`
- `detail`: `workspaceExpired`, `reconnectByReopening`, `inactivityRecovery`, `failedToStartRecovery`

Also exports `RecoveryCopy` type alias. No component reads these strings yet; the bundle is the single canonical source for later A-phase slices to import rather than scatter inline literals.

### Import anchors in page.tsx and workspace-shell.tsx

```ts
import { PROJECT_FIRST_UX } from '@/lib/feature-flags';
import { recoveryCopy } from '@/lib/recovery-copy';

const projectFirstUxAnchors = {
  enabled: PROJECT_FIRST_UX,
  copy: recoveryCopy,
};
void projectFirstUxAnchors;
```

The `void` expression prevents unused-variable lint failures without introducing any runtime branch. No UI string is changed.

### Dockerfile default

The existing frontend Dockerfile already used the same `ARG`/`ENV` pattern for `API_GATEWAY_URL`:

```dockerfile
ARG API_GATEWAY_URL=http://api-gateway:4000
ENV API_GATEWAY_URL=$API_GATEWAY_URL
```

The A0 addition follows the exact same pattern:

```dockerfile
ARG NEXT_PUBLIC_PROJECT_FIRST_UX=false
ENV NEXT_PUBLIC_PROJECT_FIRST_UX=$NEXT_PUBLIC_PROJECT_FIRST_UX
```

This approach was used rather than inventing a new pattern (e.g. a `.env.local` or a tracked `.env.prod.example` entry) because: (1) the Dockerfile `ARG` default is the only place this repo sets frontend build-time env defaults today; (2) `NEXT_PUBLIC_*` vars must be present at `next build` time, so the Dockerfile build stage is the correct injection point; (3) the default is `false`, which enforces kill-switch semantics in all container builds unless the build-arg is explicitly overridden.

## No Visible UI or Behavior Change

- No user-visible string was changed or replaced.
- No route was added or modified.
- No navigation behavior was changed.
- No session lifecycle logic was changed.
- No new runtime branching was introduced.
- `PROJECT_FIRST_UX` evaluates `false` in every environment that does not explicitly set `NEXT_PUBLIC_PROJECT_FIRST_UX=true` at build time.
- The product is byte-equivalent to its pre-A0 state when the flag is off.

## Validation

### 1. Type-check

Command:

```
cd frontend
npx tsc --noEmit -p tsconfig.json
```

Result: clean exit, no type errors.

### 2. Focused workspace-shell test suite

Command:

```
cd frontend
npx tsx --test components/workspace/workspace-shell.logic.test.ts components/workspace/workspace-shell.test.tsx
```

Result: 87/87 tests pass (21 logic + 63 component + 3 snapshot surface). No regressions.

### 3. Production build

Command:

```
cd frontend
npm run build
```

Result: `✓ Compiled successfully in 4.7s`. Full route table generated with no errors. New `lib/feature-flags.ts` and `lib/recovery-copy.ts` modules tree-shaken into the `/[locale]/app` bundle with no bundle-size concerns.

### 4. Lint

Attempted:

```
cd frontend
npm run lint -- --file app/[locale]/app/page.tsx --file components/workspace/workspace-shell.tsx --file lib/feature-flags.ts --file lib/recovery-copy.ts
```

Result: the `next lint` script in this workspace fails with `Couldn't find any pages or app directory` when the working directory is `frontend/` (the script resolves the app-dir check from the Next.js root, not the script invocation directory). This is a pre-existing script-path limitation unrelated to A0.

Follow-up lint check using `ReadLints` on all four touched source files:

- `frontend/app/[locale]/app/page.tsx` — no linter errors
- `frontend/components/workspace/workspace-shell.tsx` — no linter errors
- `frontend/lib/feature-flags.ts` — no linter errors
- `frontend/lib/recovery-copy.ts` — no linter errors

## Invariants Preserved

| Invariant | Status |
|---|---|
| No behavior change with flag off | ✅ Flag defaults `false`; no branching; product identical to pre-A0 |
| No regression to project-open hydration (PROJ-02-01) | ✅ No changes to `handleOpenWorkspaceProject` or any hydration path |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ No backend or Docker volume changes |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ No changes to snapshot or restore logic |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ No changes to preview service |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ No changes to session stop path or HTTP client timeouts |

## Scope and Non-Goals Confirmed

- No actual UI string changes
- No route additions
- No navigation behavior changes
- No backend env vars or internal-endpoint changes
- No auth changes
- No operator console work
- No history, autosave, or persistence changes
