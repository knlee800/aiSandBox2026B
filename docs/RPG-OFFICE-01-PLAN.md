# RPG-OFFICE-01 — Plan

**Status:** approved by Keith on 2026-11-05.

**Task context:** written for GOV-RPG-OFFICE-PLAN-01. Drafted by Fable 5.1; edits by the control plane after Keith's review are marked **[CP edit]**. Design only. Nothing here admits, schedules or implements. RPG office stays **APPROVED FUTURE** (`PRD.md` line 617 and the office note at line 620) until Keith approves; it is step 5 of the reset order (`docs/GOV-HARNESS-RESET-01-DECISION.md`, order-of-work table, row 5).

## 1. Goal and non-goals

**Goal.** A screen where the signed-in user sees their agents as desks in an office and, for each, what it is doing now or did last, from authoritative server data.

**Non-goals.**
- No walking-town / moving-character simulation (`PRD.md` line 482). No game engine, canvas world, zones or pathfinding (`docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md` section 13, rows 1, 3, 6).
- No code, assets, architecture or renderer from the look reference (`PRD.md` line 620; `docs/GOV-RPG-UI-COMPAT-01-REVIEW-RECORD.md` "Visual preference").
- The office owns no run. Starting, approving, cancelling and applying stay in the workspace and collaboration screens.
- No change to auth, guards, checkpoint or file-action flows (`CLAUDE.md` Auth and Security Rules, AI Workspace File-Action Rules).

## 1a. Order and prerequisites [CP edit]

Keith chose on 2026-11-05: office slice 1 first, with GOV-COLLAB-PLAN-01 (the collaboration plan, a document only) written alongside, so collaboration decisions are made before OFFICE-03 and OFFICE-05. Two small backend tasks come before OFFICE-01 and can run in parallel with each other:

| Task | Change | Write scope | Mutex | Evidence |
|---|---|---|---|---|
| USAGE-DURATION-01 (USAGE-DATA-01 item 1) | The AI-service worker writes usage_records.execution_duration_ms when it finalizes an execution | services/ai-service/src/worker/ (worker and spec) | AI-SERVICE | LOCAL-TESTS |
| RUN-LIST-COLLAB-01 | GET /api/ai/executions also returns collaborationRunId and builderProfileId, read from the metadata keys the usage ledger already stores (usage-ledger.service.ts lines 162-163) | services/api-gateway/src/ai/execution-result.service.ts, ai-execution.controller.ts, the list DTO and their specs | GATEWAY | LOCAL-TESTS |

**One approval flow.** The office never gets its own way to approve, reject, hand off or cancel work. Any later action calls the same guarded route the workspace or Team page uses.

## 2. First slice — static office

**Where it lives.** New route: `frontend/app/` → existing locale segment directory → `office/page.tsx`, mirroring `frontend/app/` locale → `platform/page.tsx`, which is a 10-line server component delegating to a client component. Rationale: the platform screen is already dense (stations, create form, detail panel in `frontend/components/platform/platform-dashboard.tsx` lines 331-549) and its last two tasks are locked; a separate route keeps revert isolation and lets the office be linked from both platform and workspace.

**Screens and states.**
- Auth gate: same pattern as `platform-dashboard.tsx` lines 167-195 (`GET /api/auth/me`, else redirect to `/{locale}/login`); shows `office.loading`.
- Office floor: one desk per agent — the four static agents from `listAgents()` (`frontend/lib/agent-platform/agent-registry.ts` lines 135-233) and the user's agents from `GET /api/agents` through `useUserAgents()` (`frontend/hooks/useUserAgents.ts` lines 93-170). Coming-soon system agents render as empty desks with a "vacant" sign; no run data is looked up for them (assumption: they can never have runs, since `agentId` is only written for persisted user agents, `services/api-gateway/src/ai/ai-execution.controller.ts` lines 871, 893, 920).
- Desk panel (side panel, same layout convention as `AgentDetailPanel`): opened by selecting a desk. See section 3.
- Empty: no user agents and no runs → floor shows Builder desk idle plus `office.emptyBody` with a link to `/{locale}/platform` to create an agent.
- Error: run fetch failed → desks still render from registry; banner `office.runsLoadError` + `office.retry`. Agents fetch failed → `office.agentsLoadError` + retry. 401 → login redirect.
- Live refresh [CP edit, moved from OFFICE-02]: poll the active list every 5 s while any desk is Queued, Working or Stopping; pause while the tab is hidden; refresh on becoming visible and on the manual button. Footer "Updated N s ago".
- Team desk [CP edit]: runs with a collaborationRunId (from RUN-LIST-COLLAB-01) go to one "Team" desk, labelled with the role from builderProfileId, instead of the Builder desk.
- Durations [CP edit]: active runs show elapsed time from startedAt; finished runs show durationMs once USAGE-DURATION-01 lands, and "—" for older rows with no duration.

**Endpoints (all existing).**
- `GET /api/auth/me` — auth.
- `GET /api/agents` — user agents (`useUserAgents.ts` line 103).
- `GET /api/ai/executions?state=active&limit=50` and `GET /api/ai/executions?state=recent&limit=50` — owner-scoped, `SessionOrApiKeyAuthGuard`, bound parameters, user filter always applied (`ai-execution.controller.ts` lines 1051-1077; `services/api-gateway/src/ai/execution-result.service.ts` lines 93-135). Each row: `executionId, status, sessionId, provider, model, tokensUsed, startedAt, durationMs, mode, agentId` (`ai-execution.controller.ts` lines 608-621).

**Attribution rule (client, pure function, tested).** Row `collaborationRunId` set → Team desk [CP edit]. Row `agentId` matches a user agent → that desk. `agentId` null → Builder desk (assumption: every non-user-agent run is Builder; collaboration member runs also have null `agentId` and are not distinguishable in this list because only `runMode` and `agentId` metadata keys are selected, `execution-result.service.ts` lines 125-126 — see risk 1). `agentId` not in the user's current list → one muted "Former agents" desk (assumption: soft-deleted agent).

**New backend.** None inside slice 1; it depends on RUN-LIST-COLLAB-01 and USAGE-DURATION-01 (section 1a) [CP edit].

**Write scope (repository paths).**
- `frontend/app/` locale segment directory `/office/page.tsx` (new)
- `frontend/components/office/office-screen.tsx`, `office-desk.tsx`, `office-desk-panel.tsx`, `office-art.tsx` (new)
- `frontend/lib/office/office.logic.ts`, `office.logic.test.ts` (new; attribution, status derivation, relative time)
- `frontend/hooks/useOfficeRuns.ts` (new)
- `frontend/components/office/office-screen.test.tsx` (new)
- `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json` (I18N lease)
- Optional, needs Keith's yes: `frontend/components/platform/platform-dashboard.tsx` header link + `platform-dashboard.test.ts`

Mutexes: FRONTEND, I18N. Evidence class: LOCAL-TESTS, then a Keith browser check. No PACKAGE, GATEWAY, MIGRATION.

## 3. Answers to the PRD open questions

**Owner-scoped active and recent runs with agent and session attribution.** Exists: `listRunsForUser` filters `user_id = $1`, optional `session_id`, `LIMIT` bound (`execution-result.service.ts` lines 99-134). Agent attribution via `metadata->>'agentId'`; session via `session_id`. Gaps: no finish time (start + duration only, `docs/RUN-STATUS-01-CHECKPOINT.md` "Open items"); `cancel_requested` is folded into public `cancelled` (`ai-execution.controller.ts` lines 520-522) — the office treats a `cancelled` row that appears in the `active` list as "Stopping"; collaboration runs not attributable (risk 1).

**Refresh, reconnect, navigation recovery.** The office is request-driven and stateless: fetch on mount, on `visibilitychange` to visible, and on manual refresh. Nothing is kept in local storage. Run recovery into the chat stays the workspace's job (`frontend/components/workspace/workspace-run-recovery.logic.ts`, `docs/RUN-RECOVER-01-CHECKPOINT.md`); the office's "Open workspace" link goes to `/{locale}/app` or `/{locale}/app?userAgentId=…` (existing pattern, `frontend/components/platform/agent-detail-panel.tsx` line 186). Assumption: `/app` does not accept a session or execution query parameter; deep-linking to the run's session is a later slice.

**Completion vs saved output vs pending approval vs application in progress vs outcome.** Server knows: execution status, and saved output for completed runs (`GET /api/ai/executions/:id` returns `output`, `fileActions` only when `completed`, `ai-execution.controller.ts` lines 1113-1128). Browser only knows: awaiting-confirmation, pending, skipped apply states (`frontend/app/` locale → `app/page.tsx` lines 5597-5637, `pendingConfirmationExecutionIdsRef`); the review record notes pending approval is discarded on restore by design. Build-apply confirmation is a billing fact (`frontend/lib/build-apply-confirm-proxy.server.ts` line 6). So slice 1 shows **only** server-known states and, for `build`/`agent` mode completed runs, the neutral label `office.outcomeUnknown` ("Finished — check the workspace for applied changes"). It never claims "applied". Collaboration `pending_approval` is server-known (`frontend/components/collaboration/collaboration-page.tsx` lines 31-41) and arrives in slice OFFICE-05.

**What selecting a character opens.** A desk panel: name, role, status badge, current run (mode, provider/model, started, elapsed), last five runs (status, mode, started, duration, tokens), buttons `Open workspace`, `Agent profile` (→ `/{locale}/platform`). No cancel, delete or approve in slice 1.

**Authorization.** Office reads only; every call is the existing cookie-session endpoint with server-side owner filtering. No client-side authorization decision. 401 → login redirect; a 403 from any later collaboration call hides that section (`collaboration.controller.ts` lines 278-286 requires `harnessEntitled`). Any later action (cancel, approve, reject) calls the existing guarded route and renders the server's refusal; cancellation is added only after the authorization concern in the review record is checked (`docs/GOV-RPG-UI-COMPAT-01-REVIEW-RECORD.md` deferred-concerns table).

**Decorative vs authoritative.** One typed status enum derived from fetched rows drives badge text and ARIA; art and (later) animation are a presentational mapping from that enum and never the source. No "working" motion without a `running` row. `prefers-reduced-motion` disables motion. Freshness timestamp always visible.

## 4. Status model

Backend `execution_status` values are those in `mapPublicExecutionStatus` (`ai-execution.controller.ts` lines 510-527); `active` list = `pending, running, cancel_requested` (`execution-result.service.ts` line 109).

| Backend status | Public status | In list | Office desk label (key) | Badge / art |
|---|---|---|---|---|
| pending | queued | active | Queued (`office.status.queued`) | amber, agent seated, screen off |
| running | running | active | Working (`office.status.working`) | emerald, screen on |
| cancel_requested | cancelled | active | Stopping (`office.status.stopping`) | amber |
| completed | completed | recent | Done (`office.status.done`); build/agent mode adds `office.outcomeUnknown` | slate, tick |
| failed | failed | recent | Failed (`office.status.failed`) | red |
| cancelled | cancelled | recent | Stopped (`office.status.stopped`) | slate |
| timeout | timeout | recent | Timed out (`office.status.timedOut`) | red |
| unknown value | queued (default branch) | either | Queued | amber |
| no rows for agent | — | — | Idle (`office.status.idle`) | slate, screen off |
| coming-soon system agent | — | — | Vacant desk (`office.status.vacant`) | muted |

Desk precedence: newest active row wins; else newest recent row with "Last run" prefix; else Idle.

## 5. Graphics

**Own art.** [CP edit] Slice 1 uses clean, simple geometric desks and figures; the real art style (Keith's, commissioned, or generated and curated) is decided before OFFICE-03. Style: flat 2D, lightly pixel-flavoured desks and a seated figure, dark slate palette matching `platform-dashboard.tsx` (`bg-slate-950`, indigo accent). Format: inline SVG React components (`office-art.tsx`) using CSS custom properties for the status tint, so one desk drawing serves all states. Avatars: initials badge (reuses the initials rule in `frontend/components/platform/agent-station-card.tsx` lines 55-60); the registry's `avatarRef` / `spriteRef` (`agent-registry.ts` lines 82-83) are unused today and stay unused in slice 1. Budget: ≤ 12 KB per SVG, ≤ 80 KB art total, no raster, no font files. Provenance: drawn in-house or commissioned; Keith decides the source; licence must be ours.

**Rendering.** Plain React + CSS grid. No library: slice 1 is a handful of static SVGs; `frontend/package.json` has no canvas/game dependency (grep for pixi/phaser/three/konva/framer-motion: none), and the reset plan excludes game engines. Later animation uses CSS keyframes or sprite-sheet `steps()`; a renderer (PixiJS would be the candidate) is reconsidered only if Keith approves a free-roaming scene, as a separate PACKAGE-mutex task.

## 6. i18n

Namespace `office` in all three message files; read through `useTranslations('office')` (`collaboration-page.tsx` line 9) or the `resolveNestedMessage` pattern. Icons: Heroicons v2 Outline only — `BuildingOffice2Icon`, `ArrowPathIcon`, `ArrowLeftIcon`, `ArrowRightIcon`, `XMarkIcon`, `ClockIcon`, `ExclamationTriangleIcon`, `UserCircleIcon`.

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| office.title | Office | 辦公室 | 办公室 |
| office.subtitle | Your agents at work | 你的代理正在工作 | 你的代理正在工作 |
| office.loading | Loading… | 載入中… | 加载中… |
| office.backToPlatform | Command Center | 指揮中心 | 指挥中心 |
| office.refresh | Refresh | 重新整理 | 刷新 |
| office.updatedAgo | Updated {seconds}s ago | {seconds} 秒前更新 | {seconds} 秒前更新 |
| office.emptyTitle | The office is quiet | 辦公室很安靜 | 办公室很安静 |
| office.emptyBody | Create an agent in the Command Center to fill a desk. | 到指揮中心建立代理來填補座位。 | 到指挥中心创建代理来填补座位。 |
| office.runsLoadError | Could not load run status. | 無法載入執行狀態。 | 无法加载运行状态。 |
| office.agentsLoadError | Could not load your agents. | 無法載入你的代理。 | 无法加载你的代理。 |
| office.retry | Try again | 再試一次 | 重试 |
| office.deskHint | Open desk | 開啟座位 | 打开工位 |
| office.formerAgents | Former agents | 已離職代理 | 已离职代理 |
| office.teamDesk [CP edit] | Team | 團隊 | 团队 |
| office.teamRole [CP edit] | Role: {role} | 角色：{role} | 角色：{role} |
| office.status.queued | Queued | 排隊中 | 排队中 |
| office.status.working | Working | 工作中 | 工作中 |
| office.status.stopping | Stopping | 停止中 | 停止中 |
| office.status.done | Done | 已完成 | 已完成 |
| office.status.failed | Failed | 失敗 | 失败 |
| office.status.stopped | Stopped | 已停止 | 已停止 |
| office.status.timedOut | Timed out | 逾時 | 超时 |
| office.status.idle | Idle | 閒置 | 空闲 |
| office.status.vacant | Vacant desk | 空座位 | 空工位 |
| office.lastRun | Last run | 上次執行 | 上次运行 |
| office.currentRun | Current run | 目前執行 | 当前运行 |
| office.recentRuns | Recent runs | 最近執行 | 最近运行 |
| office.noRuns | No runs yet | 尚無執行 | 暂无运行 |
| office.outcomeUnknown | Finished — check the workspace for applied changes. | 已完成 — 請到工作區確認已套用的變更。 | 已完成 — 请到工作区确认已应用的更改。 |
| office.mode.ask | Ask | 提問 | 提问 |
| office.mode.build | Build | 建置 | 构建 |
| office.mode.agent | Agent | 代理人 | 智能体 |
| office.mode.unknown | Run | 執行 | 运行 |
| office.started | Started | 開始 | 开始 |
| office.duration | Duration | 時長 | 时长 |
| office.tokens | Tokens | 代幣 | 令牌 |
| office.openWorkspace | Open workspace | 開啟工作區 | 打开工作区 |
| office.agentProfile | Agent profile | 代理檔案 | 代理档案 |
| office.closePanel | Close | 關閉 | 关闭 |
| office.comingSoonBody | This desk is reserved for a future agent. | 此座位保留給未來的代理。 | 此工位保留给未来的代理。 |
| platform.openOffice (optional) | Office | 辦公室 | 办公室 |

Chinese copy is a first draft for Keith's review. [CP edit] Terms aligned with the existing message files: 代理 for agent and 代幣 for tokens in zh-TW, 代理 and 令牌 in zh-CN; the Agent run mode keeps the existing labels 代理人 (zh-TW) and 智能体 (zh-CN).

## 7. Later slices

| Slice | Content | Depends on |
|---|---|---|
| OFFICE-02 Push updates | [CP edit] Polling moved into slice 1; this slice replaces it with SSE only if polling proves costly. | OFFICE-01 |
| OFFICE-03 Characters | [CP edit] Waits for the art-source decision and GOV-COLLAB-PLAN-01. Per-agent figure variants; system agents from a fixed set; user agents pick from a palette. Needs an `appearance` column on `user_agents` (MIGRATION, GATEWAY) and a field on `GET /api/agents`. | OFFICE-01, Keith on schema |
| OFFICE-04 Animation | Typing/idle loops via CSS sprite `steps()`, driven only by the status enum; reduced-motion honoured. | OFFICE-03 |
| OFFICE-05 Collaboration in the office | Add `collaborationRunId` and `builderProfileId` to `ListedRunDto` (GATEWAY, bounded) or read `GET /api/collaboration/runs?projectId=` for entitled users; show per-role team desks, `pending_approval` badge, approve/reject through the Team page's existing routes only (one approval flow). [CP edit] The list fields come from RUN-LIST-COLLAB-01. | OFFICE-01, GOV-COLLAB-PLAN-01 decisions |
| OFFICE-06 Run detail | Desk panel opens saved output via `GET /api/ai/executions/:id`. | OFFICE-01 |
| OFFICE-07 Cancel from office | Only after the authorization concern on cancellation is checked. | review-record follow-up |

## 8. Risks and open decisions (recommendation first)

1. **Collaboration member runs show as Builder runs** — [CP edit] resolved before slice 1 by RUN-LIST-COLLAB-01 and the Team desk.
2. **New route vs platform tab** — recommend new route `office`; tab alternative touches a locked, dense component.
3. **Optional header link in `platform-dashboard.tsx`** — recommend including it (one link, one key); otherwise the office is reachable only by URL.
4. **Art source** — [CP edit] simple geometric art in slice 1; Keith decides the real art source before OFFICE-03.
5. **Former-agent runs** — recommend one muted "Former agents" desk; alternative is to hide them.
6. **Recent limit 50 is global, not per agent** — a heavy user's older agents may show Idle; recommend a later optional bound `agentId` query on the existing endpoint, not in slice 1.
7. **`cancel_requested` is indistinguishable from `cancelled` in the public status**; the office infers "Stopping" from list membership. Recommend accepting; a public `stopping` status is a gateway change.
8. **Not deployed / not seen in a browser** — staging check needs Keith (`CLAUDE.md` Runtime / Live-Smoke Rules).
9. **saturationClass** — Keith names it; recommend OPTIONAL given step-5 ordering.

## 9. Text wireframe (first slice, desktop)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Office icon] OFFICE                                 [← Command Center]      │
│ Your agents at work                 Updated 12s ago   [⟳ Refresh]            │
├───────────────────────────────────────────────┬──────────────────────────────┤
│  OFFICE FLOOR                                 │  DESK                        │
│                                               │  Builder Agent          [×]  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  Builds and edits code       │
│  │ [desk]   │  │ [desk]   │  │ [desk]   │     │  ● Working                   │
│  │  BA      │  │  CS      │  │  PS      │     │                              │
│  │ Builder  │  │ Chief of │  │ Product  │     │  CURRENT RUN                 │
│  │ ● Working│  │ Staff    │  │ Strategy │     │  Build · anthropic / model   │
│  │ 2m       │  │ Vacant   │  │ Vacant   │     │  Started 14:02 · 2m elapsed  │
│  └──────────┘  └──────────┘  └──────────┘     │                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  RECENT RUNS                 │
│  │ [desk]   │  │ [desk]   │  │ [desk]   │     │  Done    Ask   13:40  12s    │
│  │  TA      │  │  RW      │  │  QA      │     │  Failed  Build 13:12  40s    │
│  │ Tech     │  │ Research │  │ QA Bot   │     │  Done    Ask   12:58   9s    │
│  │ Advisor  │  │ Writer   │  │ Last run:│     │  Finished — check the        │
│  │ Vacant   │  │ Idle     │  │ Done 1h  │     │  workspace for applied…      │
│  └──────────┘  └──────────┘  └──────────┘     │                              │
│                                               │  [Open workspace →]          │
│  (Former agents desk appears here if needed)  │  [Agent profile]             │
├───────────────────────────────────────────────┴──────────────────────────────┤
│ ⚠ Could not load run status. [Try again]        (only when a fetch failed)   │
└──────────────────────────────────────────────────────────────────────────────┘
Mobile (<xl): panel stacks below the floor; floor grid is 1 column at <sm, 2 at sm.
```

---

**Files read**
- `PRD.md` (lines 1-40, 470-500, 590-640)
- `CLAUDE.md` (Multilingual-First UX/UI Rule, Icons, UX/UI Work Rules — via workspace rules)
- `docs/GOV-RPG-UI-COMPAT-01-REVIEW-RECORD.md`
- `docs/GOV-HARNESS-RESET-01-DECISION.md`
- `docs/AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md`
- `docs/AGENT-PLATFORM-RPG-03A-CHECKPOINT.md`
- `docs/RUN-STATUS-01-CHECKPOINT.md`, `docs/RUN-RECOVER-01-CHECKPOINT.md`, `docs/HARNESS-PROGRESS-01-CHECKPOINT.md`, `docs/COLLAB-SCREEN-01-CHECKPOINT.md`
- `frontend/app/` locale → `platform/page.tsx`, `collaboration/page.tsx`; `app/page.tsx` (lines 5590-5660, grep results only)
- `frontend/components/platform/platform-dashboard.tsx`, `agent-station-card.tsx`, `agent-detail-panel.tsx`
- `frontend/components/collaboration/collaboration-page.tsx` (lines 1-60)
- `frontend/components/workspace/workspace-run-recovery.logic.ts`
- `frontend/hooks/useUserAgents.ts`
- `frontend/lib/agent-platform/agent-registry.ts`; `frontend/lib/collaboration/api.ts` (grep); `frontend/lib/build-apply-confirm-proxy.server.ts` (grep)
- `frontend/messages/en.json` (namespace grep only); `frontend/package.json` (grep only)
- `services/api-gateway/src/ai/ai-execution.controller.ts` (lines 480-650, 852-922, 1040-1140, 1184-1227)
- `services/api-gateway/src/ai/execution-result.service.ts` (lines 86-135)
- `services/api-gateway/src/ai/dto/execution-result.dto.ts`
- `services/api-gateway/src/orchestration/collaboration.controller.ts` (lines 112-227, 278-286)

**Assumptions**
- A run row with `agentId` null is a Builder run; collaboration member executions also have null `agentId` and are therefore misattributed to Builder in slice 1.
- Coming-soon system agents never have runs because `agentId` is written only for persisted user agents.
- An `agentId` that matches no agent in `GET /api/agents` belongs to a soft-deleted agent.
- `/{locale}/app` does not accept a session or execution query parameter for deep linking (not checked).
- `useTranslations` resolves a nested namespace the way `collaboration-page.tsx` uses it; the `{seconds}` placeholder works with the existing hook (`fillTemplate` exists in `frontend/lib/collaboration/logic`, not read).
- `useUserAgents` can be reused outside the platform component without modification.
- Chinese translations are draft quality pending Keith's review.

---

## Reviewer notes (control plane, 2026-11-05)

Drafted by Fable 5.1 (claude-fable-5-1-thinking-high, resolved "Claude Fable 5.1 300K High") through Cursor in read-only mode. The control plane checked these claims against the code and found them correct: the 10-line platform page; the auth gate in platform-dashboard.tsx; the four static registry agents (builder, chief-of-staff, product-strategy, technology-advisor) and the unused avatarRef / spriteRef; GET /api/agents in useUserAgents.ts; agentId written only for persisted user agents (ai-execution.controller.ts lines 871, 893, 920); GET /api/ai/executions with SessionOrApiKeyAuthGuard and its row fields; mapPublicExecutionStatus folding cancel_requested into cancelled; output and fileActions only for completed runs; the /app?userAgentId= link; the initials rule; no canvas or animation dependency in frontend/package.json; useTranslations, COLLABORATION_POLL_MS and pending_approval in collaboration-page.tsx; the harnessEntitled check; no stored finish time; no existing office namespace or route. One line reference is off by one (the metadata keys are at execution-result.service.ts lines 126-127).

**Correction:** durationMs is always null today. The worker never writes usage_records.execution_duration_ms (USAGE-DATA-01 item 1). The desk panel's Duration column and any "took Ns" text would be blank. Slice 1 should show elapsed time for active runs from startedAt, and "—" for a finished run's duration, until USAGE-DATA-01 item 1 lands. Recommendation: do USAGE-DATA-01 item 1 before or with OFFICE-01; it is a small worker change.
