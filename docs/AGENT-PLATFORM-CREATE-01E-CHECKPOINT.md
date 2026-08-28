# AGENT-PLATFORM-CREATE-01E — Final Checkpoint

**Task ID:** AGENT-PLATFORM-CREATE-01E
**Title:** First Product-Facing Single-Shot Ask UI for Persisted User-Created Agents
**Step:** 4 — Independent Verification / Checkpoint / Final Lock
**Date:** 2026-08-28
**Verdict:** COMPLETE AND LOCKED — PASS
**Implementation SHA:** `b6b94516aff9981101ae8815aec2e2d36b8b231b`

---

## 1. Task Identity

| Field | Value |
|---|---|
| Task ID | AGENT-PLATFORM-CREATE-01E |
| Family | AGENT PLATFORM / CREATE (successor after 01A/01B/01C/01D COMPLETE AND LOCKED) |
| Lane | Lane 1 |
| Lifecycle | 4-step |
| Evidence class | LOCAL-TESTS + MANUAL_BROWSER_SMOKE |

---

## 2. Step lifecycle record

| Step | Status | HEAD | Date |
|---|---|---|---|
| Step 1 — Registration | COMPLETE | `5156db4daa20902fb1a2a6a48f9c0392b43b05c1` | 2026-08-28 |
| Step 2 — UX/session/source-path stage-start + contract freeze | COMPLETE | `7a4a0970f976417ca680f384139ccd72e240469f` | 2026-08-28 |
| Step 3 — Implementation + automated validation + staging deployment + manual browser smoke | COMPLETE | `b6b94516aff9981101ae8815aec2e2d36b8b231b` (base was `a2942d18b837014c33e344171e0b180cfa06ad7f`) | 2026-08-28 |
| Step 4 — Independent verification / checkpoint / lock | COMPLETE | (this document; no production source changes) | 2026-08-28 |

Step 2 stage-start document: `docs/AGENT-PLATFORM-CREATE-01E-STAGE-START.md`

---

## 3. Step 4 base preconditions (verified)

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `b6b94516aff9981101ae8815aec2e2d36b8b231b` |
| Tree | CLEAN (`git status --short` empty) |
| Recent log | `b6b9451 implement AGENT-PLATFORM-CREATE-01E user-agent Ask UI` |
| AGENT-PLATFORM-CREATE-01E | ACTIVE — Step 3 COMPLETE — Step 4 PENDING ✅ |
| Lane 1 | ACTIVE with AGENT-PLATFORM-CREATE-01E ✅ |
| Lane 2 | EMPTY ✅ |
| Lane 3 | DISABLED ✅ |
| FRONTEND | OWNED by AGENT-PLATFORM-CREATE-01E ✅ |
| I18N | OWNED by AGENT-PLATFORM-CREATE-01E ✅ |
| GATEWAY | UNOWNED / READ ONLY ✅ |
| GOVERNANCE | UNOWNED at Step 4 start ✅ |

---

## 4. Step 3 write-set verification

Committed Step 3 files (`git show --name-only HEAD`):

| File | Role |
|---|---|
| `frontend/components/platform/agent-detail-panel.tsx` | MUST-WRITE — user-created Ask CTA |
| `frontend/components/platform/platform-dashboard.tsx` | MUST-WRITE — wire Ask label into detail panel |
| `frontend/components/workspace/workspace-execution-intent.logic.ts` | MUST-WRITE — query parse + agentId payload helper |
| `frontend/app/[locale]/app/page.tsx` | MUST-WRITE — bind query, force Ask, spread helper on both execute sites, map 404 copy |
| `frontend/components/workspace/workspace-shell.tsx` | MUST-WRITE — bound chip; disable Build while bound |
| `frontend/messages/en.json` | MUST-WRITE — new i18n keys |
| `frontend/messages/zh-TW.json` | MUST-WRITE — new i18n keys |
| `frontend/messages/zh-CN.json` | MUST-WRITE — new i18n keys |
| `frontend/components/platform/platform-dashboard.test.ts` | MUST-WRITE — entry + i18n tests |
| `frontend/components/workspace/workspace-execution-intent.logic.test.ts` | MUST-WRITE — payload / query / harness / Build-escape tests |
| `frontend/components/workspace/workspace-shell.test.tsx` | MUST-WRITE — chip + Build-locked + no hardcoded English |
| `TASKS.md` | Governance mirror (Step 3 end-state) |
| `TASKS_BACKLOG_FULL.md` | Governance mirror (Step 3 end-state) |

**WRITE_SET_EXPANSION = NO** — all 11 application source files are from the frozen MUST-WRITE set; MAY-WRITE count = 0.

Confirmed zero changes to:
- `services/api-gateway/**` — count: 0
- `services/ai-service/**` — count: 0
- `services/container-manager/**` — count: 0
- `docker-compose*.yml` — count: 0
- root `package.json` — count: 0
- migrations — count: 0
- `frontend/app/[locale]/agents/**` or any new route — count: 0

---

## 5. Frozen UX contract verification (22 items)

| # | Contract item | Verified |
|---|---|---|
| 1 | User-created detail surface has Ask CTA | ✅ `agent-detail-panel.tsx` renders Ask `Link` on user-created branch |
| 2 | No new route created | ✅ Route list unchanged; Ask navigates to existing `/[locale]/app` |
| 3 | Ask navigation: `/[locale]/app?userAgentId=<uuid>` | ✅ `href={`${localePrefix}/app?userAgentId=${encodeURIComponent(agent.id)}`}` |
| 4 | `userAgentId` binding is visit-scoped/local to AppPage | ✅ `useState<string | null>` in `page.tsx`; not localStorage/zustand |
| 5 | Existing `selectedSessionId` remains session source | ✅ 104 occurrences in `page.tsx`; `boundUserAgentId` adds no session creation |
| 6 | Platform does not create sessions | ✅ Ask CTA is a `Link` (navigation only); `POST /api/sessions` not called from detail panel |
| 7 | Conversation execute request includes `agentId` via helper | ✅ `...buildPersistedUserAgentAskRequestFields(...)` spread at both execute sites (lines 4049 + 4387) |
| 8 | Build/`workspace_mutation` never includes `agentId` | ✅ Helper returns `{}` unless intent is `'conversation'` |
| 9 | `harnessVersion` remains absent from frontend | ✅ Grep of all frontend source files: zero production occurrences; test files assert absence only |
| 10 | Build disabled while user agent bound | ✅ Build button `disabled={... \|\| isUserAgentAskBound}` with tooltip `userAgentAskBuildLockedTooltip` |
| 11 | Bound-agent indicator exists | ✅ `data-testid="workspace-user-agent-ask-bound"` with `props.aiMessages.userAgentAskBound` |
| 12 | Dismiss removes only bound user-agent state | ✅ `setBoundUserAgentId(null)` at dismiss; no forced intent switch |
| 13 | Existing WorkspaceChatPanel/thread/stream/poll lifecycle reused | ✅ No second execute lifecycle; existing orchestration unchanged |
| 14 | Existing Builder Ask unchanged when unbound | ✅ Helper returns `{}` when `boundUserAgentId === null` |
| 15 | Existing Builder Build unchanged when unbound | ✅ Build enabled; helper returns `{}` for `workspace_mutation` |
| 16 | User-agent 404 mapping exists | ✅ `resolvePersistedUserAgentAskExecuteError` maps 404 (non-session) → `ai.userAgentAskNotFound` |
| 17 | Session-not-found mapping exists | ✅ 404 with session-pattern message → `ai.userAgentAskSessionNotFound` |
| 18 | Generic/network errors preserve existing behavior | ✅ Function returns `null` when unbound or non-404; existing `toChatAssistantFailureMessage` handles rest |
| 19 | All six frozen i18n keys in all three locales | ✅ `platform.agentCreate.askButton`, `ai.userAgentAskBound`, `ai.userAgentAskDismiss`, `ai.userAgentAskNotFound`, `ai.userAgentAskSessionNotFound`, `ai.userAgentAskBuildLockedTooltip` — present in en/zh-TW/zh-CN |
| 20 | No hardcoded new English UX copy | ✅ Ask CTA and bound chip use i18n keys exclusively |
| 21 | Heroicons v2 Outline; no new icon dependency | ✅ `ArrowRightIcon` from `@heroicons/react/24/outline`; workspace-shell reuses existing heroicons import |
| 22 | No backend/runtime architecture expansion | ✅ 0 services/ files changed; 0 gateway/AI-service writes |

---

## 6. Request contract verification

### `buildPersistedUserAgentAskRequestFields` helper

Located in `frontend/components/workspace/workspace-execution-intent.logic.ts`:

- Returns `{ agentId }` only when `normalizeWorkspaceExecutionIntent(executionIntent) === 'conversation'` AND `agentId` is a non-empty trimmed string ✅
- Otherwise returns `{}` — no key emitted ✅
- Never emits `harnessVersion` ✅
- Never puts `agentId` on Build / `workspace_mutation` ✅
- Spread on both execute fetch bodies in `page.tsx` ✅

### `parseUserAgentIdQueryParam` helper

- Accepts UUID-shaped values only (regex `[0-9a-f]{8}-...-[0-9a-f]{12}`) ✅
- Rejects empty, non-string, garbage values → returns `null` ✅

---

## 7. Security / ownership boundary verification

Backend security invariants remain structurally enforced by locked AGENT-PLATFORM-CREATE-01D. No backend source was modified in this task.

| Invariant | Evidence |
|---|---|
| `CROSS_USER_AGENT_EXECUTION_BLOCKED` | Backend: `findOneByIdAndUserId(agentId, identity.userId)` returns `null` for cross-user; `NotFoundException` HTTP 404; no enqueue. Locked in CREATE-01D checkpoint §18. |
| `USER_AGENT_BUILD_ESCAPE_BLOCKED` | Frontend: helper returns `{}` for `workspace_mutation`; Build toggle disabled while bound. Backend: 400 if `agentId` + non-`conversation` intent. Dual-layer. |
| `USER_AGENT_HARNESS_ESCAPE_BLOCKED` | Backend: 400 if `agentId` + `harnessVersion` present. Frontend: zero `harnessVersion` in production source. |

All three = YES ✅

---

## 8. Scope compliance

| Dimension | Value |
|---|---|
| Backend source changes | 0 |
| AI-Service changes | 0 |
| Container-Manager changes | 0 |
| Migrations | 0 |
| Dependencies | 0 |
| New routes | 0 |
| Broad redesign | 0 |
| Unrelated feature expansion | 0 |
| MAY-WRITE paths written | 0 |
| New icon dependency | 0 |
| Runtime/Docker/Postgres/Redis invocation | 0 |
| Provider-live calls | 0 |
| Credits consumed | 0 |
| Git mutations by worker | 0 |
| Lane 2 admission | 0 |
| Lane 3 enablement | 0 |
| Invitation registration | 0 |

---

## 9. Automated validation evidence (Step 3; not rerun per rules)

| Suite | Result |
|---|---|
| Targeted — platform (`platform-dashboard.test.ts`) | 33/33 PASS |
| Targeted — execution-intent (`workspace-execution-intent.logic.test.ts`) | 23/23 PASS |
| Targeted — workspace-shell (`workspace-shell.test.tsx`) | 452/452 PASS |
| Broad — frontend `npm test` | 745/745 PASS |
| TypeScript — `npx tsc --noEmit --incremental false` | PASS |
| Frontend build — `npm run build` | PASS |

Evidence established in Step 3. Rerunning broad local automated suites is not required at checkpoint time by governance rules; no contrary rule found.

---

## 10. Staging deployment evidence

| Field | Value |
|---|---|
| `DEPLOYED_SHA` | `b6b94516aff9981101ae8815aec2e2d36b8b231b` |
| `STAGING_URL` | `https://staging.ainow.biz` |
| Frontend reachability (Step 4 read-only check) | HTTP 200 ✅ |
| `/api/health/ready` (Step 4 read-only check) | HTTP 200 ✅ |
| Staging tree at deployment | CLEAN |
| PM2 services | ONLINE — no crash/restart loop |
| Database connected | YES |
| `GLOBAL_EXECUTION_ENABLED` | `false` |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` |
| `BILLING_CHARGES_ENABLED` | `false` |
| `AI_PROVIDER` | `xai` |
| Provider-live calls for smoke | 0 |
| Credits intentionally consumed | 0 |
| DB mutation by deployment step | NO |
| Migrations applied | 0 |

Deployed SHA matches implementation SHA exactly. Fail-closed safety gates confirmed unchanged.

---

## 11. Manual browser smoke evidence

| Field | Value |
|---|---|
| `MANUAL_STAGING_BROWSER_SMOKE` | PASS |
| Evidence source | Keith manual staging attestation — 2026-08-28 |
| Smoke scope | Frozen contract per `docs/AGENT-PLATFORM-CREATE-01E-STAGE-START.md` §18 |
| Cursor performed browser smoke | NO — this is Keith's attestation only |

Frozen smoke scope covered:
1. Existing persisted user-created agent visible on Command Center / Platform ✅
2. New Ask CTA present ✅
3. Navigation to `/[locale]/app?userAgentId=<uuid>` ✅
4. Selected user-created agent bound in existing workspace context ✅
5. Build remains visible but disabled while bound ✅
6. Existing session/chat input remains available ✅
7. Bounded Ask submission through existing lifecycle ✅
8. Execution allowed to fail closed at existing safety gate ✅
9. No provider-live execution required ✅
10. Dismissing bound agent restores ordinary Builder Ask/Build state ✅

---

## 12. Living-authority follow-up

`PRD.md` and `ARCHITECTURE.md` were not modified in this lifecycle (not authorized). The landing of product-facing user-agent Ask UI may make one or both living authority documents lightly stale regarding the current product-facing state.

**Recommended bounded follow-up (not registered here):** A new governance task analogous to GOV-AUTH-01 to record the CREATE-01E product-facing fact in PRD.md and ARCHITECTURE.md after this lock is committed. This is not a prerequisite for locking CREATE-01E.

---

## 13. Remaining limitations

- Provider-live execution not validated (GLOBAL_EXECUTION_ENABLED=false; fail-closed confirmed)
- Agent name not displayed in bound chip (design decision: avoids adding `useUserAgents` to every AppPage mount in this first slice)
- Delete UI for user-created agents remains unimplemented (out of scope; unregistered)
- Full executable user-created-agent runtime (Build, Harness, tools, skills) remains APPROVED FUTURE

---

## 14. Invitation invariant

`PRIVATE-BETA-INVITE-01` remains **PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED**.

`INVITATION_EXECUTION_PERMITTED = NO` — unchanged ✅

---

## 15. Lane 3 invariant

Lane 3 remains **DISABLED**.

`GOV-PARALLEL-01 LANE3_DECISION = KEEP_DISABLED_UNTIL_FUTURE_MATERIAL_NEED` — unchanged ✅

---

## 16. Final board / mutex state

| Resource | State after lock |
|---|---|
| Lane 1 | EMPTY — AGENT-PLATFORM-CREATE-01E COMPLETE AND LOCKED |
| Lane 2 | EMPTY — not admitted |
| Lane 3 | DISABLED |
| FRONTEND | UNOWNED — released at this lock |
| I18N | UNOWNED — released at this lock |
| GATEWAY | UNOWNED |
| GOVERNANCE | UNOWNED (acquired transiently for this Step 4 write then released) |
| ACTIVE_IMPLEMENTATION_LANES | 0/2 |

---

## 17. Step 4 activity ledger

LIVE=0, SSH=0, staging mutation=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, product implementation=0, frontend implementation=0, backend implementation=0, production source changes=0, AI-SERVICE=0, frontend/i18n application edits=0, migrations=0, dependencies=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, Git mutations=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, next product task registered=0.

Step 4 read-only staging checks: frontend HTTP 200 ✅; `/api/health/ready` HTTP 200 ✅.

Step 4 writes: this checkpoint document, `TASKS.md` board final lock fields, `TASKS_BACKLOG_FULL.md` registry final lock body.

---

## 18. Final git checks

```
git diff --check     → (empty — PASS)
git status --short   → (empty tree before Step 4 writes)
git rev-parse HEAD   → b6b94516aff9981101ae8815aec2e2d36b8b231b
```

Step 4 expected dirt only:
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/AGENT-PLATFORM-CREATE-01E-CHECKPOINT.md` (this file)

---

## 19. Final verdict

**AGENT-PLATFORM-CREATE-01E COMPLETE AND LOCKED — PASS — 2026-08-28**

| Verification | Result |
|---|---|
| Precondition (branch=main, HEAD=implementation SHA, tree=clean) | PASS |
| Step 3 write-set (11 MUST-WRITE + 2 governance = 13 files, no expansion) | PASS |
| Frozen UX contract (22 items) | PASS |
| Request-contract verification (helper + parse + no harnessVersion + both execute sites) | PASS |
| Security boundary (CROSS_USER/BUILD/HARNESS escape all blocked) | PASS |
| Scope compliance (backend=0, AI-Service=0, migrations=0, deps=0, routes=0) | PASS |
| Automated validation evidence (platform 33/33, execution-intent 23/23, shell 452/452, 745/745 broad, TS, build) | PASS |
| Staging deployment (SHA match, health 200, frontend 200, fail-closed gates) | PASS |
| Manual browser smoke (Keith attestation 2026-08-28) | PASS |
| Provider-live calls | 0 |
| Credits intentionally consumed | 0 |
| Migrations | 0 |
| Invitation invariant | UNCHANGED |
| Lane 3 invariant | DISABLED / UNCHANGED |
| `git diff --check` | PASS |

---

AGENT-PLATFORM-CREATE-01E COMPLETE AND LOCKED — PASS — 2026-08-28 — FIRST PRODUCT-FACING SINGLE-SHOT ASK UI FOR PERSISTED USER-CREATED AGENTS VERIFIED: FROZEN ASK CTA → EXISTING /APP ROUTE WITH userAgentId QUERY → VISIT-SCOPED BIND → EXISTING SINGLE-SHOT LIFECYCLE → BUILD DISABLED WHILE BOUND → DISMISS RESTORES BUILDER → SIX I18N KEYS IN ALL THREE LOCALES → GATEWAY READ ONLY → BACKEND UNCHANGED → STAGING PASS → KEITH MANUAL SMOKE PASS — CROSS_USER_AGENT_EXECUTION_BLOCKED=YES — USER_AGENT_BUILD_ESCAPE_BLOCKED=YES — USER_AGENT_HARNESS_ESCAPE_BLOCKED=YES
