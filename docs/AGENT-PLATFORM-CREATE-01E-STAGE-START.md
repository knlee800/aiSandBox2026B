# AGENT-PLATFORM-CREATE-01E — Stage-Start / UX, Session, and Exact Frontend Contract Freeze

**Task ID:** AGENT-PLATFORM-CREATE-01E
**Title:** First Product-Facing Single-Shot Ask UI for Persisted User-Created Agents
**Step:** 2 — UX / Session / Source-Path Stage-Start and Exact Contract Freeze
**Status:** COMPLETE (design/planning only — no implementation)
**Date:** 2026-08-28
**Nature:** Read-only source inspection + contract freeze
**Step 2 base HEAD:** `7a4a0970f976417ca680f384139ccd72e240469f` (branch `main`, clean tree verified)
**Step 1 HEAD / commit:** `7a4a0970f976417ca680f384139ccd72e240469f` (`register AGENT-PLATFORM-CREATE-01E product-facing user-agent Ask UI`)
**Stage-start document:** `docs/AGENT-PLATFORM-CREATE-01E-STAGE-START.md`

This is design only. No application source, tests, runtime, Docker, PostgreSQL, Redis, staging, provider, credits, browser, or Git commit/push.

---

## 1. Verdict

**PASS — contracts frozen for bounded FRONTEND + I18N Step 3.**

| Flag | Value |
|---|---|
| Selected UX | Approach A — Ask CTA on existing Create Agent detail, then existing `/[locale]/app` Ask surface |
| `NEW_ROUTE_REQUIRED` | NO |
| `USER_AGENT_ASK_SESSION_SOURCE` | Existing AppPage `selectedSessionId` (sessionStorage + `GET /api/sessions` + existing create-session UX) |
| `GATEWAY_CONTRACT_HOLE` | NO |
| `CHILD_SLICES_REQUIRED` | NO |
| `MANUAL_BROWSER_SMOKE_REQUIRED` | YES (not run in Step 2 or Step 3; Keith guided later) |
| Evidence class | LOCAL-TESTS (manual browser smoke after Step 3 automated validation; no provider-live authorization) |
| `IMPLEMENTATION_AUTHORIZED` | NO until Keith commits this Step 2 state |
| `PROCEED_TO_STEP_3` | NO until that commit; after commit, Step 3 may consume authorization for only the frozen write set |

---

## 2. Precondition record

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `7a4a0970f976417ca680f384139ccd72e240469f` |
| Tree | CLEAN (`git status --short` empty) |
| Recent log | `7a4a097 register AGENT-PLATFORM-CREATE-01E product-facing user-agent Ask UI` |
| AGENT-PLATFORM-CREATE-01E | ACTIVE — Step 1 COMPLETE — Step 2 was PENDING |
| Lane 1 | ACTIVE with AGENT-PLATFORM-CREATE-01E |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| FRONTEND | OWNED by AGENT-PLATFORM-CREATE-01E |
| I18N | OWNED by AGENT-PLATFORM-CREATE-01E |
| GATEWAY | UNOWNED / READ ONLY |
| GOVERNANCE | UNOWNED at Step 2 start; acquired transiently for this write then released UNOWNED |
| `IMPLEMENTATION_AUTHORIZED` | NO (unchanged) |

---

## 3. Files inspected (read-only)

### Scheduler / registry / living authority

| File | Method |
|---|---|
| `TASKS.md` CURRENT EXECUTION BOARD | Read — stop at LEGACY / FROZEN |
| `TASKS_BACKLOG_FULL.md` AGENT-PLATFORM-CREATE-01E body | Read |
| `docs/AGENT-PLATFORM-CREATE-01D-CHECKPOINT.md` | Read — frozen Gateway Ask identity |
| `docs/GOV-AUTH-01-CHECKPOINT.md` | Read — CURRENT vs FUTURE product/architecture |
| `docs/AGENT-PLATFORM-CREATE-01B-STAGE-START.md` | Read — Create Agent UX precedent |
| `docs/AGENT-PLATFORM-CREATE-01D-STAGE-START.md` | Read — freeze-document format |
| `PRD.md` | Targeted — user-created agents CURRENT vs FUTURE |
| `ARCHITECTURE.md` | Targeted — `POST /api/ai/execute` `agentId?` Ask-only |

### Existing Create Agent / command-center surface

| File | Method |
|---|---|
| `frontend/app/[locale]/platform/page.tsx` | Read — locale wrapper only |
| `frontend/components/platform/platform-dashboard.tsx` | Read — list, empty, detail wiring |
| `frontend/components/platform/agent-detail-panel.tsx` | Read — Builder CTA vs user-created dead-end |
| `frontend/components/platform/agent-station-card.tsx` | Read — select-only cards |
| `frontend/hooks/useUserAgents.ts` | Read — `GET/POST /api/agents` |
| `frontend/components/platform/platform-dashboard.test.ts` | Read — i18n key list + API contract tests |
| `frontend/messages/en.json` | Read — `platform.agentCreate.*`, `platform.detail.*`, `ai.*` |
| `frontend/messages/zh-TW.json` | Targeted — `ai` + `platform.agentCreate` |
| `frontend/messages/zh-CN.json` | Targeted — `platform.agentCreate` |

### Existing Builder Ask / session / execute client

| File | Method |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Read — session bootstrap, `handleCreateSession`, `handleSubmitChatPrompt`, orchestrated execute, stream + poll |
| `frontend/components/workspace/workspace-shell.tsx` | Read — Ask/Build control, composer `canSubmit`, chat error/loading |
| `frontend/components/workspace/workspace-execution-intent.logic.ts` | Read — conversation vs `workspace_mutation` payload |
| `frontend/components/workspace/workspace-execution-intent.logic.test.ts` | Read |
| `frontend/components/workspace/workspace-chat-persistence.logic.ts` | Read — session-scoped chat persist |
| `frontend/lib/open-project-in-fresh-session.ts` | Read — existing `POST /api/sessions` reuse |
| `frontend/package.json` | Read — `test` / `build` scripts |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Read-only confirm — session ownership then agent lookup; no frontend hole |
| `services/api-gateway/src/sessions/session.service.ts` | Read-only — missing session 404 message |

Advisory skills read only: `.agents/skills/impeccable/SKILL.md`, `.agents/skills/emil-design-eng/SKILL.md`. No craft/shape/live loops. No source edits from skills.

No `.env`, secret, credential, or token files were opened.

---

## 4. Frozen backend contract (unreopened)

Frontend Step 3 must send existing:

```text
POST /api/ai/execute
```

with:

- `agentId` = persisted user-agent UUID
- `executionIntent = 'conversation'`
- `harnessVersion` ABSENT

Locked CREATE-01D already guarantees owner-scoped lookup, missing/cross-user/soft-deleted → 404 never 403, Ask-only, no Build, no Harness, name/role/description identity, usage metadata.

**`GATEWAY_CONTRACT_HOLE=NO`.** Frontend can add optional `agentId` additively to the existing JSON body. GATEWAY remains READ ONLY.

Current frontend execute bodies (both sites in `page.tsx`) already omit `harnessVersion` (repo-wide frontend grep: zero matches). Step 3 must keep that absence.

---

## 5. UX approaches considered

### A. Ask action from Create Agent profile/list that reuses existing Builder/chat session (SELECTED)

User selects a persisted agent on `/[locale]/platform`, clicks Ask on the existing detail panel (today a status-only dead-end), and lands on the existing workspace route `/[locale]/app` with a visit-scoped `userAgentId` query. Ask uses the existing composer, thread, execute client, stream, and poll.

### B. Agent selector inside the existing Ask/chat workspace (REJECTED for this first slice)

A dropdown/list in `WorkspaceChatPanel` next to Ask/Build. Session is already present, but this invents a new in-workspace agent-runtime control, loads `GET /api/agents` on every Builder visit, and sits beside Build — higher leak and redesign risk. Discoverability is worse: agents are created on Command Center, not in chat.

### C. Other existing surfaces (REJECTED)

- `frontend/app/[locale]/driver/page.tsx` — debug execute harness, not product UX.
- Platform-local execute without a session — would require a second session/execute architecture; Gateway requires an owned session.
- New `/agents/:id/ask` route — forbidden unless unavoidable; existing `/app` already has Ask.

**Why A is smallest/safest:** it fills the existing hole next to Builder’s `Start Building` `Link` to `/app`, reuses one execute client, one session lifecycle, one chat surface, and needs no new route or selector architecture. Platform does **not** create sessions.

---

## 6. Product surface contract

```text
USER_ENTRY_POINT =
  frontend/components/platform/agent-detail-panel.tsx
  user-created branch (data-testid="agent-detail-user-created")
  on /[locale]/platform via PlatformDashboard

ASK_INPUT_SURFACE =
  frontend/components/workspace/workspace-shell.tsx
  WorkspaceChatPanel composer
  (data-testid="workspace-chat-prompt-input"
   + existing Ask/Build segmented control)

RESPONSE_SURFACE =
  existing WorkspaceChatPanel thread / response / status / error
  (workspace-chat-response-*, workspace-chat-status, workspace-chat-error)
  plus existing session-scoped chat persistence

POST_ASK_NAVIGATION =
  none after submit (user already on /[locale]/app).
  Entry navigation only: /[locale]/platform → /[locale]/app?userAgentId=<uuid>
  using the same Link pattern as platform.detail.startBuilding → /app.

AGENT_SELECTION_MECHANISM =
  existing user-agent card select (AgentStationCard onSelect)
  → AgentDetailPanel user-created Ask CTA
  → visit-scoped query userAgentId
  → AppPage local React state boundUserAgentId
  No in-workspace agent picker in this slice.
  No zustand / localStorage "active agent runtime".
```

```text
NEW_ROUTE_REQUIRED=NO
```

`/[locale]/app` already exists. Query `userAgentId` is additive on that route. `AppPage` currently has no `useSearchParams`; Step 3 must read the query on the existing client page (prefer `window.location.search` in a mount effect to avoid a new Next.js Suspense boundary on this giant page). Invalid/non-UUID values are ignored (no bind).

---

## 7. Session contract

```text
USER_AGENT_ASK_SESSION_SOURCE =
  existing AppPage selectedSessionId
  restored from sessionStorage key workspace_tab_selected_session_id
  (TAB_SELECTED_SESSION_STORAGE_KEY)
  after GET /api/sessions?includeTerminated=true
  and/or created through existing handleCreateSession → POST /api/sessions
```

Exact lifecycle (reuse only; do not add a second architecture):

1. Sessions are created only inside `/[locale]/app` via `handleCreateSession` (`POST /api/sessions`) or existing project-open helpers (`openProjectInFreshSession` → same `POST /api/sessions`). Platform Ask CTA must not create sessions.
2. `sessionId` for execute is `selectedSessionId` already passed into `handleSubmitChatPrompt` / `submitOrchestratedChatPrompt`.
3. Builder Ask already obtains `sessionId` this way. User-created-agent Ask uses that same field.
4. User-agent Ask must occur with a usable owned workspace session. A project is **not** required (`canSubmit` only requires `selectedSessionId`).
5. When no usable session exists: existing composer stays disabled (`canSubmit` false); existing `ai.emptyNoSession` empty copy. User creates/selects a session with already-supported workspace UX. Bound `userAgentId` remains for the visit.
6. Navigation **is** required from Command Center to `/app` to reach a valid session surface. That navigation already exists (`platform-back-to-workspace`, Builder `Start Building`).
7. Do not auto-create a session from the Ask CTA.

Composer already blocks double-submit and no-session submit (`isSending` + `!selectedSessionId`). Keep that.

Do not change the existing `sessionId: selectedSessionId ?? crypto.randomUUID()` fallback except by still using the same expression. User-agent Ask cannot reach execute without `selectedSessionId` because `canSubmit` requires it.

---

## 8. Ask request contract

Exact execute-client path:

1. `handleSubmitChatPrompt` in `frontend/app/[locale]/app/page.tsx` — primary `fetch('/api/ai/execute', …)` (~line 4350)
2. `submitOrchestratedChatPrompt` in the same file — second `fetch('/api/ai/execute', …)` (~line 4024); orchestration default is `false`

Additive helper in existing `workspace-execution-intent.logic.ts`:

```ts
buildPersistedUserAgentAskRequestFields(input: {
  agentId?: string | null;
  executionIntent: unknown;
}): { agentId: string } | {}
```

Rules:

- Return `{ agentId }` only when `normalizeWorkspaceExecutionIntent(executionIntent) === 'conversation'` AND `agentId` is a non-empty trimmed string.
- Otherwise return `{}` (no key).
- Never emit `harnessVersion`.
- Never put `agentId` on Build / `workspace_mutation`.
- Both execute `JSON.stringify` bodies must spread this helper. Do not inline `agentId` only at one site.

`parseUserAgentIdQueryParam(search: string): string | null` also lives in that helper module (UUID-shaped values only).

**agentId lives only in:**

- visit query `userAgentId`
- AppPage local state `boundUserAgentId`
- conversation execute JSON body

Not in localStorage, not zustand, no persistent runtime.

When bound: force `chatExecutionIntent` to `'conversation'` on bind; disable the Build toggle while bound (do not hide the control; disable it). Dismissing the bound chip clears `boundUserAgentId` only; do not auto-switch to Build.

### Proof Build cannot receive agentId

1. Helper returns `{}` unless intent is `conversation`.
2. Build toggle is disabled while bound, so `onExecutionIntentChange('workspace_mutation')` is not available in this flow.
3. Existing Builder Ask/Build with `boundUserAgentId === null` is unchanged: helper returns `{}`.
4. Tests assert Build payload has no `agentId` key; Ask-with-agent has `agentId` + `executionIntent: 'conversation'` and no `harnessVersion`.

### Proof harnessVersion is absent

Frontend currently has zero `harnessVersion` references. Step 3 tests must `assert.doesNotMatch` both execute bodies / helper output / page source for `harnessVersion`.

---

## 9. Success flow (reuse existing result lifecycle)

```text
select persisted user-agent card on /[locale]/platform
→ AgentDetailPanel Ask CTA
→ /[locale]/app?userAgentId=<uuid>
→ AppPage binds UUID, sets Ask intent
→ existing selectedSessionId (or user creates one via existing UX)
→ existing composer submit
→ POST /api/ai/execute with agentId + executionIntent=conversation
→ existing 202 queued handling
→ existing EventSource /api/ai/executions/:id/stream
→ existing poll refreshChatExecutionStatus while queued/running
→ existing thread persist (local + persistSessionChatMessageToBackend)
→ existing response rendering
```

Do not invent a second response lifecycle. Stay on `/app` after submit.

---

## 10. Error / loading / empty contract

Reuse existing patterns. No new state framework.

| Case | Frozen UX |
|---|---|
| 1. Ask submitting/loading | Existing `chatRequestState` submitting/queued/running; composer `isSending`; `ai.sending`; `workspace-chat-status` |
| 2. Ask succeeds | Existing completed thread + streamed/polled assistant content; `POST_ASK_NAVIGATION=none` |
| 3. Agent 404 / deleted / inaccessible | HTTP 404 whose message is **not** `Session with ID … not found` (Nest default `"Not Found"` for CREATE-01D agent miss) → `workspace-chat-error` with `ai.userAgentAskNotFound` |
| 4. Session missing/invalid | Local: composer disabled + `ai.emptyNoSession`. After submit: HTTP 404 message `Session with ID … not found` → `ai.userAgentAskSessionNotFound` via same `workspace-chat-error` |
| 5. Generic execute failure | Existing `toChatAssistantFailureMessage` / `workspace-chat-error` |
| 6. Network failure | Existing `handleSubmitChatPrompt` catch → same chat error |
| 7. Agent list empty | Existing `user-agents-empty` + `platform.agentCreate.emptyTitle/emptyBody`; no Ask CTA |
| 8. Double-submit | Existing `canSubmit` / `isSending`; do not add a second guard |

Bound-chip when query UUID is set: `ai.userAgentAskBound` on the existing context-indicator row (`data-testid="workspace-user-agent-ask-bound"`). Optional dismiss uses `ai.userAgentAskDismiss`. Do not fetch agent name in this slice (avoids adding `useUserAgents` to every AppPage mount).

---

## 11. Multilingual contract

Any new visible string uses existing `resolveNestedMessage` / `getAiMessages` patterns. Update all three locale files in Step 3.

Frozen **new** keys only:

| Key | Surface |
|---|---|
| `platform.agentCreate.askButton` | Ask CTA label (same visual role as `platform.detail.startBuilding`) |
| `ai.userAgentAskBound` | Bound-identity chip in composer |
| `ai.userAgentAskDismiss` | Dismiss bound chip (aria-label / button) |
| `ai.userAgentAskNotFound` | Agent 404/deleted/inaccessible |
| `ai.userAgentAskSessionNotFound` | Session 404 after submit |
| `ai.userAgentAskBuildLockedTooltip` | Build toggle title while bound |

Do **not** fix unrelated I18N-SHELL residual strings. Do not hardcode new English copy.

---

## 12. Icon / design contract

- Ask CTA: reuse `ArrowRightIcon` already imported in `agent-detail-panel.tsx` (same as Start Building). **NEW_ICON_REQUIRED=NO.**
- Bound chip: no new icon, or reuse `ChatBubbleLeftIcon` already imported in `workspace-shell.tsx`. If an icon is added on the CTA instead, it must be `@heroicons/react/24/outline` only.
- No Lucide / Font Awesome / Material / emoji-as-icon.
- No new dependencies.
- Match Start Building button classes; do not restyle Command Center, cards, or chat chrome.

---

## 13. Advisory UX skills (advisory only)

### Impeccable (bounded; craft/shape/live gates not run; no redesign)

| Before | After | Why |
|---|---|---|
| User-created detail is a status-only dead-end beside Builder’s full-width primary CTA | Same full-width primary `Link` as Start Building, Ask copy, `ArrowRightIcon` | Native to the existing detail panel; no second card/visual system |
| Extra chrome in chat | One 11px chip on the existing context-indicator row | Same density as Global/Project/Repo Docs |
| New page or selector | Query handshake into `/app` | Existing route; no navigation concept |

Do not: restyle Command Center, rebuild agent cards, add decorative gradients, or invent a runtime dock.

### Emil Kowalski (bounded)

| Before | After | Why |
|---|---|---|
| New modal/toast for Ask errors | Keep `workspace-chat-error` inline | Errors already live next to the composer |
| Animate Ask CTA / chip | No new motion | Ask is a repeated action; existing hover/focus rings are enough |
| Hide Build while bound | Disable Build (`disabled` + tooltip), do not unmount | Removing the control would feel like a mode redesign |
| Extra loading skeleton | Existing `Sending...` / queued / running | `isSending` already prevents double submit |

---

## 14. Source write-set freeze

### MUST WRITE

| File | Why |
|---|---|
| `frontend/components/platform/agent-detail-panel.tsx` | User-created Ask CTA |
| `frontend/components/platform/platform-dashboard.tsx` | Wire Ask label into detail panel |
| `frontend/components/workspace/workspace-execution-intent.logic.ts` | Query parse + `agentId` payload helper |
| `frontend/app/[locale]/app/page.tsx` | Bind query, force Ask, spread helper on both execute sites, map 404 copy |
| `frontend/components/workspace/workspace-shell.tsx` | Bound chip; disable Build while bound |
| `frontend/messages/en.json` | New keys |
| `frontend/messages/zh-TW.json` | New keys |
| `frontend/messages/zh-CN.json` | New keys |
| `frontend/components/platform/platform-dashboard.test.ts` | Entry + i18n tests |
| `frontend/components/workspace/workspace-execution-intent.logic.test.ts` | Payload / query / harness / Build-escape tests |
| `frontend/components/workspace/workspace-shell.test.tsx` | Chip + Build-locked + no hardcoded English |

### MAY WRITE IF REQUIRED

| File | Why it might be needed | Default |
|---|---|---|
| `frontend/components/workspace/workspace-ai-file-actions.logic.test.ts` | Only if existing `page.tsx` source-slice tests break | Do not touch unless red |
| New `frontend/components/workspace/workspace-user-agent-ask.logic.ts` | Only if helper extraction outgrows execution-intent module | Prefer existing module |

### READ ONLY

- Entire `services/api-gateway/**` (including execute controller)
- `services/ai-service/**`
- `frontend/hooks/useUserAgents.ts`
- `frontend/components/platform/agent-station-card.tsx`
- `frontend/components/platform/create-agent-form.tsx`
- `frontend/app/[locale]/platform/page.tsx`
- `frontend/lib/open-project-in-fresh-session.ts`
- `frontend/components/workspace/workspace-chat-persistence.logic.ts`
- `PRD.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `AGENTS.md`

### OUT OF SCOPE

Build-with-agent, Harness, Delete UI, specialist stations, driver page, I18N residual cleanup, RPG, navigation IA, migrations, dependencies, Lane 2 / Lane 3.

```text
CHILD_SLICES_REQUIRED=NO
```

Platform CTA and workspace consume are one handshake, not two features. Splitting would ship a dead CTA or an unreachable bind.

---

## 15. Hotfile / mutex leases

| Resource | Step 3 |
|---|---|
| FRONTEND | OWNED by AGENT-PLATFORM-CREATE-01E (covers `page.tsx` and workspace/platform source) |
| I18N | OWNED — atomic lease on the three message files |
| `HOTFILE:frontend/app/[locale]/app/page.tsx` | **Not required.** File is not a currently registered HOTFILE. FRONTEND already exclusive. Do not add a redundant HOTFILE. |
| GATEWAY | UNOWNED / READ ONLY |
| GOVERNANCE | UNOWNED after this Step 2 write |
| All other mutexes / HOTFILEs | UNOWNED |

Final mutex set for Step 3: **FRONTEND + I18N only.**

---

## 16. Test contract

Automated only in Step 3. No Gateway/provider tests.

Minimum coverage:

1. Persisted user-agent Ask CTA appears on user-created detail (not on coming-soon; Builder keeps Start Building).
2. CTA href is `/${locale}/app?userAgentId=<uuid>` (or equivalent localePrefix).
3. `parseUserAgentIdQueryParam` accepts UUID and rejects empty/garbage.
4. Helper emits `agentId` only for conversation + non-empty id.
5. `executionIntent === 'conversation'` when helper emits `agentId`.
6. Helper output / page execute bodies omit `harnessVersion`.
7. Build / `workspace_mutation` payload has no `agentId` key.
8. User-created flow does not add a Build-with-agent CTA.
9. Existing Builder Ask without `agentId` remains `{}` from helper; page still spreads helper so omitted key means unchanged JSON shape when unbound.
10. Existing Builder Build remains unbound + no `agentId`.
11. Execute still uses `selectedSessionId` (page source assertion on both fetch sites).
12. Composer `canSubmit` / `isSending` unchanged (shell source/tests).
13. Success stays on `/app` (no extra `router.push` after submit).
14. Agent 404 maps to `ai.userAgentAskNotFound`.
15. Session 404 maps to `ai.userAgentAskSessionNotFound`.
16. Generic/network still uses existing chat error path.
17. New keys resolve in en / zh-TW / zh-CN; add them to `AGENT_CREATE_KEYS` and an `ai.*` key list.
18. No hardcoded new English in changed TSX (Ask CTA and chip use keys).
19. Heroicons: if any new icon import appears, it is `@heroicons/react/24/outline`.
20. Empty user-agent list still has no Ask CTA.

Do not require `useUserAgents.test.ts` unless that hook is written (it is READ ONLY by default).

---

## 17. Automated validation commands (PowerShell, absolute paths)

Targeted:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsx --test components/platform/platform-dashboard.test.ts
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsx --test components/workspace/workspace-execution-intent.logic.test.ts
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsx --test components/workspace/workspace-shell.test.tsx
```

Broader relevant frontend tests (package script; does **not** include `components/platform/` — that is why the targeted platform file is run first):

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
```

Typecheck then build (restore buildinfo if `tsc --noEmit` without `--incremental false` is never used; frozen command uses incremental false):

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit --incremental false
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

No Docker, Postgres, Redis, staging, provider, or browser in Step 3 automated validation.

---

## 18. Manual browser smoke

```text
MANUAL_BROWSER_SMOKE_REQUIRED=YES
```

Automated tests cannot prove the live click → session → Ask → visible response chain (`page.tsx` is too large for a full RTL mount; `npm test` does not drive the browser).

**Do not run in Step 2.** After Step 3 automated green, Keith must be asked explicitly and guided step-by-step.

Smallest smoke (no new provider-live authorization):

1. Logged-in user with at least one persisted user-created agent.
2. Prefer an already-usable workspace session; if none, use existing in-app Create Session (do not invent a new path).
3. Open Command Center (`/[locale]/platform`).
4. Select the user-created agent.
5. Click Ask.
6. Confirm land on `/[locale]/app` in Ask mode with bound chip; Build disabled.
7. Submit a short Ask.
8. Confirm existing sending/queued/running then assistant text in the existing thread (or the existing execute error if the local kill-switch/queue blocks — still proves the frontend path).
9. Dismiss bind; confirm ordinary Builder Ask (no `agentId`) and Build still exist.

`PROVIDER-LIVE` is **not** authorized by this task. If a visible model completion cannot appear without a paid provider, report that as a separate decision; do not expand this slice.

---

## 19. Strict non-scope

No: Build-with-agent; workspace mutation via user-agent; Harness; dedicated user-agent runtime; tools; knowledge; skills; model config; specialists; Chief of Staff / Product Strategy / Technology Advisor / Legal Advisor; collaboration; referrals; work objects; Multi-Builder; OAuth; Stripe; invitations; Delete UI; I18N residual cleanup; RPG redesign; new design system; broad navigation change; backend refactor; Gateway edit; AI-SERVICE edit; migration; dependency; Lane 2; Lane 3.

---

## 20. Implementation authorization

```text
IMPLEMENTATION_AUTHORIZED=NO
PROCEED_TO_STEP_3=NO
```

Keith must commit this Step 2 freeze (`docs/AGENT-PLATFORM-CREATE-01E-STAGE-START.md`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`). After a clean commit, Step 3 may consume authorization for **only** the frozen MUST-WRITE (and MAY-WRITE-if-required) set.

---

## 21. Suggested commit message (Keith owns Git)

```text
freeze AGENT-PLATFORM-CREATE-01E user-agent Ask UX and frontend contract
```
