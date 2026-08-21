# PRIVATE-BETA-E2E-AUTO-01H — Step 1 Diagnosis

**Task ID:** PRIVATE-BETA-E2E-AUTO-01H
**Title:** Diagnose and (later) Correct Builder `executionId` Observation Mismatch
**Classification:** AUTOMATION_TOOLING_INVESTIGATION
**Workstream:** RELIABILITY
**Lifecycle:** 3-step bounded task (Step 1 registration + investigation; Step 2 smallest proven automation fix + TDD/CONTRACT; Step 3 consolidation/checkpoint/lock)
**Step:** 1 — COMPLETE
**Date:** 2026-08-21
**Lane:** Lane 1
**Parent:** PRIVATE-BETA-E2E-AUTO-01 (COMPLETE AND LOCKED — PASS)
**Triggering evidence:** PRIVATE-BETA-E2E-LIVE-06 (COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — WAIT_FOR_AUTO_APPLY — 2026-08-21)
**Predecessor:** PRIVATE-BETA-E2E-AUTO-01G (COMPLETE AND LOCKED — PASS — 2026-08-21) recorded this defect as residual / unfixed and did not register it

```
STEP_1_IMPLEMENTATION_PERFORMED=NO
PRODUCT_SOURCE_MODIFIED=NO
AUTOMATION_IMPLEMENTATION_MODIFIED=NO
LIVE_RUNS=0
SSH_CONNECTIONS=0
STAGING_ACCESS=0
PROVIDER_CALLS=0
CREDITS_MUTATED=0
GATE_MUTATION=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
PHASE_ORDER_CHANGED=NO
ROOT_CAUSE_PROVEN=YES
CORRECT_OBSERVATION_SIGNAL_PROVEN=YES
PRODUCT_SOURCE_CHANGES_REQUIRED=NO
PRODUCT_CHANGE_REQUIRED_FOR_STEP_2=NO
PHASE_ORDER_CHANGE_REQUIRED=NO
ONE_PROVIDER_CALL_SEMANTICS_PRESERVED=YES
POST_API_AI_EXECUTIONS_COLLECTION_POST_EXISTS=NO
```

Local tree at Step 1 (read-only):

- `git rev-parse HEAD` = `dc237cd4349bf7ad5c8cf9d853cccaf56799ab12`
- `git status --short` = empty (CLEAN)

This SHA is recorded as an observation only. It is **not** frozen as a required Step 2 SHA.

Do not implement Step 2 in this document. Do not rerun LIVE-06. Do not convert LIVE-06 to PASS. Do not reopen AUTO-01G. Do not register PRIVATE-BETA-INVITE-01.

---

## 1. Identifier verification

`PRIVATE-BETA-E2E-AUTO-01H` was **unused as a registered task** before this registration.

Repo-wide occurrences before registration (all historical prose, none a registration):

| Location | Nature |
|---|---|
| `TASKS.md` Current next product gate | "likely identifier `PRIVATE-BETA-E2E-AUTO-01H` (verify unused at registration)" — **NOT REGISTERED AND NOT AUTHORIZED HERE** |
| `docs/PRIVATE-BETA-E2E-AUTO-01G-CHECKPOINT.md:309` | "**Likely identifier:** `PRIVATE-BETA-E2E-AUTO-01H` (verify unused at future registration)." / "**Do NOT register it here.**" |
| `TASKS_BACKLOG_FULL.md` AUTO-01G locked end-status | "likely `PRIVATE-BETA-E2E-AUTO-01H` (verify unused at registration)" |

`TASKS_BACKLOG_FULL.md` contained **zero** `### PRIVATE-BETA-E2E-AUTO-01H` registry entries. Historical prose recommending AUTO-01H does not count as prior registration.

Rejected alternatives: `PRIVATE-BETA-E2E-AUTO-02` (implies another runner build), `PRIVATE-BETA-E2E-LIVE-07` (implies LIVE execution — this task is CONTRACT-only), reopening AUTO-01/01A/01B/01C/01D/01E/01F/01G (all LOCKED), reopening LIVE-06 (LOCKED).

---

## 2. Admission / state

Admitted to **Lane 1** as ACTIVE at Step 1. Lane 2 EMPTY. Lane 3 DISABLED.

Admission checks: lane capacity available (0/2 used at admission); Start condition READY; dependencies satisfied (AUTO-01/01A/01B/01C/01D/01E/01F/01G locked PASS; LIVE-06 locked with the triggering evidence); no dependency on unfinished lane output; write scope is automation-investigation only; GOVERNANCE acquired for this board/registry/diagnosis write then released; evidence class LOCAL-TESTS for Step 2; revert isolation acceptable (runner-only, reversible).

No runtime, staging, provider, credit, or gate authority is granted. Step 2 is **not** authorized by this admission.

---

## 3. Exact current `submitBuild()` implementation

The only real implementation is the LIVE adapter.

Repo-wide `submitBuild` sites:

| Site | Role |
|---|---|
| `e2e/builder-golden-path/lib/runner.ts:42-45` | interface |
| `e2e/builder-golden-path/lib/runner.ts:131-135` | call; stores `build.executionId` |
| `e2e/builder-golden-path/lib/runner.ts:287-290` | CONTRACT stub returns `'exec-contract'` immediately |
| `e2e/builder-golden-path/lib/live-adapters.ts:284-325` | **real implementation** |

```284:325:e2e/builder-golden-path/lib/live-adapters.ts
    async submitBuild({ providerGuard, sessionCreatedAt: createdAt }) {
      assertSafeHeadroomBeforeProvider({
        sessionCreatedAt: createdAt,
        now: Date.now(),
      });
      providerGuard.authorizeCall();
      const providerSelect = page.locator(SELECTORS.providerSelector);
      if (await providerSelect.count()) {
        await providerSelect.selectOption({ value: PROVIDER }).catch(async () => {
          await providerSelect.selectOption({ label: 'xAI' });
        });
      }
      const modelSelect = page.locator(SELECTORS.modelSelector);
      if (await modelSelect.count()) {
        await modelSelect.selectOption({ value: `${PROVIDER}:${MODEL}` }).catch(async () => {
          await modelSelect.selectOption({ value: MODEL }).catch(async () => {
            await modelSelect.selectOption({ label: MODEL });
          });
        });
      }
      await page.locator(SELECTORS.intentBuild).click();
      await page.locator(SELECTORS.promptInput).fill(BUILDER_PROMPT);
      const executionResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/api\/ai\/executions\/?$/.test(new URL(response.url()).pathname),
        { timeout: BUILD_TIMEOUT_SAFE },
      );
      await page.locator(SELECTORS.chatSubmit).click();
      const buildSubmittedAt = Date.now();
      let executionId: string | undefined;
      try {
        const executionResponse = await executionResponsePromise;
        const payload = (await executionResponse.json().catch(() => null)) as
          | { id?: string; executionId?: string }
          | null;
        executionId = payload?.id ?? payload?.executionId;
      } catch {
        executionId = undefined;
      }
      return { executionId, buildSubmittedAt };
    },
```

Timeout constant:

```446:446:e2e/builder-golden-path/lib/live-adapters.ts
const BUILD_TIMEOUT_SAFE = 120_000;
```

`lib/constants.ts:28` also declares `BUILD_TIMEOUT_MS = 180_000`. `submitBuild` does **not** use it.

### Exact current matcher (WRONG)

| Field | Value |
|---|---|
| Function | `submitBuild` |
| File/lines | `e2e/builder-golden-path/lib/live-adapters.ts:284-325` |
| Listener armed | `page.waitForResponse(...)` **before** the Send/Build click (`:306-311` then click at `:312`) |
| URL matcher | `/\/api\/ai\/executions\/?$/` against `new URL(response.url()).pathname` |
| HTTP method matcher | `response.request().method() === 'POST'` |
| Timeout | `BUILD_TIMEOUT_SAFE = 120_000` ms |
| Expected payload | JSON object with `id` or `executionId` |
| Parse | `payload?.id ?? payload?.executionId` |
| Status check | **none** |
| On miss / timeout / JSON failure | empty `catch` sets `executionId = undefined` |
| After timeout | function **still returns** `{ executionId: undefined, buildSubmittedAt }` — not a typed terminal failure |
| BUILD phase result | runner marks BUILD successful (`runner.ts:130-136`) even when `executionId` is missing |

What the matcher can match: only `POST` whose pathname is exactly `/api/ai/executions` or `/api/ai/executions/`.

What it cannot match:

- `POST /api/ai/execute`
- `GET /api/ai/executions/:executionId`
- `GET /api/ai/executions/:executionId/stream`
- `POST /api/ai/executions/:executionId/confirm-build-apply`
- `POST /api/ai/executions/:executionId/cancel`

### 120-second behavior

Playwright `waitForResponse` with `timeout: 120000` rejects with `TimeoutError` when no matching response arrives. The empty `catch` at `:321-323` swallows that rejection.

Therefore the 120s wait is **intentionally treated as optional** by the current adapter: observation failure degrades to `undefined` instead of failing BUILD. LIVE-06 printed `executionId=null` and `LAST_SUCCESSFUL_PHASE=BUILD` for exactly this reason.

The page is **not** paused by `waitForResponse`. The Send click at `:312` already dispatched the real product request. Provider/worker/apply/confirm/deduction therefore proceed on the product path during the dead wait. That is why LIVE-06 could complete one xAI call, write `e2e-auto.html`, confirm, and deduct 1180 credits while the runner sat in BUILD.

The matcher was introduced in the original runner commit `7b42fef` (`implement automated Builder golden-path runner`) and has not been corrected since.

---

## 4. Real Build request (product)

Default Builder Send/Build is the **non-orchestrated** chat path. Orchestration is `useState(false)` (`frontend/app/[locale]/app/page.tsx:985`). LIVE-06 used exactly **one** provider call, which matches this path, not the orchestration loop.

Call site: `handleSubmitChatPrompt` → `fetch('/api/ai/execute', …)` at `page.tsx:4350-4364`.

| Field | Proven value |
|---|---|
| Frontend call site | `frontend/app/[locale]/app/page.tsx:4350` (`handleSubmitChatPrompt`) |
| URL | `POST /api/ai/execute` (relative; staging Caddy routes `/api/*` to API Gateway `:4000`) |
| Method | `POST` |
| Headers | `Content-Type: application/json` |
| Body | `{ prompt, provider, model, sessionId, conversationId, …buildExecutionIntentRequestPayload(executionIntent), optional workspaceContext }` |
| Next.js App Router handler | **none** for `/api/ai/execute` (only `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` exists under `frontend/app/api/ai/`) |
| Gateway controller | `@Controller('ai')` + `app.setGlobalPrefix('api')` + `@Post('execute')` → `POST /api/ai/execute` |
| HTTP status | **202 Accepted** (`@HttpCode(HttpStatus.ACCEPTED)`) |
| Response protocol | **JSON** (normal finite HTTP body). **Not** SSE. **Not** chunked streaming of tokens. |
| Response body | `{ executionId: string, status: 'queued' }` (`ai-execution.controller.ts:411, 626-630`) |

The orchestrated path at `page.tsx:4024` also posts `POST /api/ai/execute` and also reads `queuedPayload.executionId` from JSON (`:4068-4069`). It is not the LIVE-06 Builder path (default orchestration = false; one provider call).

There is a **separate** later stream:

```4416:4418:frontend/app/[locale]/app/page.tsx
      if (nextExecutionId) {
        const stream = new EventSource(
          `/api/ai/executions/${encodeURIComponent(nextExecutionId)}/stream`,
```

That is `GET /api/ai/executions/:executionId/stream` (SSE), opened **after** the JSON `executionId` is already known. Token/file_action/complete events do not introduce the ID; they consume it.

---

## 5. Where `executionId` is created

Proven flow is **B and A together**: created **while handling** `POST /api/ai/execute`, **before** the provider request.

Gateway `AIExecutionController.execute` (`services/api-gateway/src/ai/ai-execution.controller.ts`):

1. Guards / validation / session ownership.
2. `executionId = uuidv4()` (`:562` for the normal no-`Idempotency-Key` Builder path; LIVE-06 frontend fetch sends no `Idempotency-Key`).
3. `usageLedgerService.writeExecutionIntent({ executionId, … })` (`:563-582`).
4. `queueService.enqueueExecution({ executionId, prompt, model, … })` (`:603-624`) — BullMQ `queue.add('execute-ai', jobData, { attempts: 1 })` (`queue.service.ts:39-45`). Enqueue does **not** call the provider.
5. **Return immediately** `{ executionId, status: 'queued' }` (`:626-630`). Comment at `:626`: "Return immediately — do NOT wait for AI execution."

Ledger write (`usage-ledger.service.ts:144-175`) inserts `usage_records` with:

- PK `execution_id` = the UUID (`usage-record.entity.ts:40-41`)
- `executionStatus: 'pending'`
- `tokensUsed` NULL (not known yet)

Worker (`services/ai-service/src/worker/worker.processor.ts:629-632, :981-984`) dequeues later, claims the row (`pending` → `running`), then `aiExecutionService.execute(...)` — **this** is the provider dispatch. LIVE-06 DB id `1a995035-6b1c-431b-acc2-8dd1e51a53da` is this pre-provider UUID.

**Not C:** the ID is not created after the provider response.

Idempotent reuse (`:515`) only applies when a client `Idempotency-Key` already maps to a timeout/failed row. The Builder chat fetch does not send that header.

---

## 6. Where `executionId` first becomes externally observable

**First external observation = the 202 JSON body of `POST /api/ai/execute`.**

Order on the wire for one Build:

1. `POST /api/ai/execute` completes with 202 `{ executionId, status: 'queued' }`.
2. Frontend `await response.json()` (`page.tsx:4376-4377`) → `data.executionId`.
3. `setChatExecutionId(nextExecutionId)` (`:4396`) and assistant-message `executionId` (`:4408`).
4. `EventSource GET /api/ai/executions/:executionId/stream` (`:4417`) — ID in the **URL**, not in SSE event payloads.
5. Because status is `'queued'`, frontend calls `refreshChatExecutionStatus` (`:4559-4568`) and starts an interval poll (`:1570-1576`) of `GET /api/ai/executions/:executionId` (`:3792`).
6. Later, after auto-apply: `POST /api/ai/executions/:executionId/confirm-build-apply` (PUBLIC_CONFIRM; ID in URL and JSON body `{ executionId, triggered, reason }`).

| Channel | Present? | Timing vs provider |
|---|---|---|
| `POST /api/ai/execute` JSON body `executionId` | **YES — first** | Before provider |
| Response headers of execute | **Not proven / not sent by controller** | n/a |
| First SSE event/chunk | **NO** (events are `token` / `file_actions` / `complete`; ID already known) | After ID exists |
| Later SSE event | **NO** as the ID source | After |
| Frontend state `chatExecutionId` / `workspace-chat-execution-id` | YES, after JSON parse; UI only while `isSending` (`workspace-shell.tsx:4104-4107`) | After JSON |
| `GET /api/ai/executions/:id` | YES in URL and JSON `executionId`; `tokensUsed` only when `status === 'completed'` | After JSON; tokens after provider |
| Confirm POST | YES in URL | After apply |

LIVE-06 DB `1a995035-6b1c-431b-acc2-8dd1e51a53da` is this same UUID: ledger PK written in step 3 above, returned in the 202, later used as `credit_deduction_records.source_event_id`.

---

## 7. Exact transport path (DB record → frontend)

Conceptual path for LIVE-06 execution `1a995035-6b1c-431b-acc2-8dd1e51a53da`:

```
uuidv4() in AIExecutionController.execute
  → writeExecutionIntent → usage_records.execution_id (pending)
  → enqueueExecution (BullMQ; attempts: 1)
  → HTTP 202 JSON { executionId, status: 'queued' }
  → browser fetch() body
  → frontend data.executionId / setChatExecutionId
  → EventSource URL / status GET URL / later confirm URL
  → worker claims row, calls provider (xAI grok-4.5)
  → completed + tokens_used=1180
  → confirm-build-apply → deduction source_event_id = same UUID
```

Classification:

| Hypothesis | Verdict |
|---|---|
| A. ID exists before provider request | **CONFIRMED** |
| B. ID is created while handling `/api/ai/execute` | **CONFIRMED** (authoritative creation point) |
| C. ID is created only after provider response | **REFUTED** |
| D. Frontend never receives it directly | **REFUTED** |
| E. Frontend receives it through a stream/event | **REFUTED as the first/authoritative path**; stream URL repeats an already-known ID |
| F. Another exact flow | Additional later copies exist (status GET, confirm URL); they are not the creation path |

---

## 8. Does `POST /api/ai/executions` exist?

**No collection POST exists in current product source, and it does not apply to this Builder flow.**

Current public `/api/ai/executions*` routes on `AIExecutionController`:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/ai/executions/:executionId` | status DTO |
| GET SSE | `/api/ai/executions/:executionId/stream` | token stream |
| POST | `/api/ai/executions/:executionId/cancel` | cancel |
| POST | `/api/ai/executions/:executionId/confirm-build-apply` | 03J public confirm |

Repo search for `@Post('executions')` (collection, no `:executionId`) in `services/` = **zero**. Git log `-S "@Post('executions')"` on the controller = **empty**. Creation has been `@Post('execute')` since `acc6bdd` (PHASE-32A-CHECKPOINT era) and remains so.

The runner matcher is therefore waiting for a **historical/incorrect automation URL**, not a renamed or GET-only product route. Step 2 must not merely shorten 120s; it must observe `POST /api/ai/execute`.

---

## 9. Candidate automation signals

| Option | Signal | Semantic fact | Timing | Bounded | One-provider-call safe | Early capture needed | Body-consumption risk | Later-phase duplicate | Product change |
|---|---|---|---|---|---|---|---|---|---|
| **1 — ACCEPTED** | Observe `POST /api/ai/execute` and parse JSON `executionId` | Queue accepted this Build; ledger ID exists | Immediately on 202, before provider | Yes (`waitForResponse` timeout) | Yes — observation only; still one Send click | Arm before click (already true) | **Low** — finite JSON; see §10 | No — DEDUCTION still GETs status + SSH row | No |
| 2 | Parse SSE chunk of `/stream` | Stream connected / tokens | After 202 | Stream is long-lived | Yes if URL-only | After execute JSON | **High if body consumed** | No | No |
| 3 | Subsequent status GET or confirm URL | Same ID, later | After frontend already has ID; confirm is PUBLIC_CONFIRM | Yes | Yes | Confirm already ARM_LISTENERS | Confirm JSON already observed by existing listener | **Yes for confirm** — would collapse PUBLIC_CONFIRM into BUILD | No |
| 4 | `data-testid="workspace-chat-execution-id"` | UI echo of state | After JSON; only while `isSending` | Fragile | Yes | After JSON | None | Presentation coupling (AUTO-01G class) | No |
| 5 | DB/API query after BUILD | Ledger row | After 202, but extra SSH/DB | Unbounded vs product flow | Extra staging query | No | n/a | DEDUCTION already queries DB | No |
| 6 | Confirm URL as BUILD's ID source | Applied+confirmed | After apply | Already armed | Yes | ARM_LISTENERS | Existing | **Yes** — PUBLIC_CONFIRM | No |

**Best signal: Option 1.** It is the same JSON the product uses as the first ID, available before the provider call, naturally produced by the one real execution, and it requires no product change.

Option 3 confirm-URL recovery already exists at `runner.ts:152` (`ids.executionId = confirm.executionId ?? ids.executionId`). That is a **later-phase backup**, not the BUILD observation. AUTO-01H must not make BUILD depend on PUBLIC_CONFIRM.

---

## 10. Safe streaming-observation conclusion

`POST /api/ai/execute` is **not streamed**. It is 202 JSON `{ executionId, status: 'queued' }`.

SSE lives on a **different** request: `GET /api/ai/executions/:executionId/stream` (`@Sse`, `ai-execution.controller.ts:798-816`). Playwright must **not** call `response.text()` / `json()` / `body()` on that GET; doing so would wait for stream end and could interfere with the page `EventSource`.

Safe observation for Option 1:

- `page.waitForResponse` matching `POST` + pathname `/\/api\/ai\/execute\/?$/` (must **not** use a prefix that would also match `/api/ai/executions…`).
- Read the finite JSON via Playwright's buffered `response.json()`, the same pattern already used by `armConfirmBuildApplyListener` (`lib/network.ts:105-106`) and CREATE_SESSION body reads.
- Playwright Network interception keeps a copy independent of the page `fetch()` body. The frontend also calls `response.json()` on execute (`page.tsx:4376`). This is observation, not `page.route()` fulfill/continue mutation.

Do **not** consume the SSE body even as a backup. If a backup were ever needed, the stream **URL** already contains `executionId` without reading chunks. It is unnecessary once Option 1 works.

---

## 11. Arming / timing

The execute POST is **click-triggered**. It cannot fire during ARM_LISTENERS / CREATE_SESSION.

Current code already arms `waitForResponse` **immediately before** the Send click. That is the correct timing class (not the AUTO-01D "listener armed too late" class).

**Verdict:** keep arming immediately before the BUILD click (or equivalent capture armed no later than that). ARM_LISTENERS capture-style is **not required** for this signal. Do not move the wait to after the click. Do not change frozen phase order.

Preserve:

```
PREPARE_BROWSER → AUTH → SAFETY → STARTING_BALANCE → ARM_LISTENERS
→ CREATE_SESSION → BUILD → WAIT_FOR_AUTO_APPLY → PREVIEW
→ CHECKPOINT → PUBLIC_CONFIRM → DEDUCTION → BALANCE → CLEANUP
```

---

## 12. `verifyDeduction()` dependency

```376:399:e2e/builder-golden-path/lib/live-adapters.ts
    async verifyDeduction(executionId) {
      if (!executionId) {
        throw new Error('Cannot verify deduction without executionId.');
      }
      const executionResponse = await page.request.get(
        `${baseURL}/api/ai/executions/${encodeURIComponent(executionId)}`,
      );
      const execution = (await executionResponse.json().catch(() => ({}))) as {
        tokens_used?: number;
        tokensUsed?: number;
      };
      const tokensUsed = execution.tokens_used ?? execution.tokensUsed;
      if (typeof tokensUsed !== 'number') {
        throw new Error('Execution status did not include actual tokens_used.');
      }
      const deductionRaw = await staging.queryDeduction(executionId);
      const deductionCount = countDeductionRowsForExecution(deductionRaw, executionId);
      ...
      validateDeduction(evidence);
```

| Step | What it needs |
|---|---|
| Null guard | any non-empty `executionId` string |
| `GET /api/ai/executions/:id` | same UUID; DTO field `tokensUsed` when `status === 'completed'` (`ai-execution.controller.ts:716-717`) — adapter already accepts `tokensUsed` |
| SSH `queryDeduction` | `credit_deduction_records.source_event_id = executionId` (`staging.ts:232-233`) |
| `validateDeduction` | exactly 1 row, `tokensUsed > 0`, credits == tokens, overflow 0 |

LIVE-06: deduction `source_event_id` = `1a995035-6b1c-431b-acc2-8dd1e51a53da` = ledger PK = execute 202 `executionId`.

**Correct captured execute `executionId` is sufficient for the existing DEDUCTION logic.** No additional DEDUCTION-phase implementation belongs in AUTO-01H.

Caveat (not a Step 2 expansion): `verifyDeduction` is a **single** GET with no retry. After Option 1, BUILD returns on 202 (queued), so DEDUCTION must still run **after** WAIT_FOR_AUTO_APPLY / PREVIEW / CHECKPOINT / PUBLIC_CONFIRM so the execution is completed and the confirm-triggered row exists. Frozen phase order already guarantees that. Do not add DEDUCTION polling here.

If BUILD stays fail-open with `null`, DEDUCTION throws `Cannot verify deduction without executionId` even after AUTO-01G unblocks WAIT_FOR_AUTO_APPLY — unless PUBLIC_CONFIRM's URL backup fills `ids.executionId` first (`runner.ts:152`). AUTO-01H must not rely on that backup.

---

## 13. Why 88 CONTRACT tests missed this

| Mechanism | Effect |
|---|---|
| CONTRACT runner stub | `createRecordingAdapters().submitBuild` returns `{ executionId: 'exec-contract' }` with **no network** (`runner.ts:287-290`) |
| `golden-path.spec.ts` | never calls real `submitBuild`; confirm fixture uses `#fire-confirm` → `POST …/exec-fixture/confirm-build-apply` |
| AUTO-01G fixture **emits the fake collection POST** | after `POST /api/ai/execute`, the page script also `fetch('/api/ai/executions', { method: 'POST' })` (`local-fixture.ts:369, 388`) |
| Fixture execute JSON is wrong-shaped | `POST /api/ai/execute` → **200** `{ id: AUTO_APPLY_EXECUTION_ID }` (`:445-447`), not 202 `{ executionId, status: 'queued' }` |
| Fixture executions JSON | `POST /api/ai/executions` → **201** `{ id: AUTO_APPLY_EXECUTION_ID }` (`:449-451`) — **exactly what the wrong matcher waits for** |
| Real adapter path under-tested | the one test that calls live `submitBuild` (`live-adapters.spec.ts:1818-1820`) uses that dual-POST fixture, so the wrong matcher **succeeds** |
| Null tolerated at BUILD | empty `catch` + `executionId?: string` + CONTRACT `verifyDeduction()` stub ignores the id |
| Real product URL never required | no test asserts `POST /api/ai/execute` as the BUILD execution request, nor that collection POST count is 0 |

**Missing regression:** one Send/Build; fixture issues **only** `POST /api/ai/execute` with 202 `{ executionId, status: 'queued' }`; **zero** `POST /api/ai/executions` collection requests; product-like file write / confirm still occur; current `submitBuild` dead-waits then returns `undefined`; provider-call simulation remains exactly one.

---

## 14. Step 2 RED design (do not implement now)

Deterministic CONTRACT RED against the **actual** `createLiveAdapters().adapters.submitBuild`:

1. New fixture mode (or dedicated server) whose Send click:
   - fires **exactly one** `POST /api/ai/execute`
   - responds **202** `{ executionId: <id>, status: 'queued' }`
   - does **not** fire `POST /api/ai/executions` (collection)
   - may still fire the AUTO-01G file-write 204 so later phases stay independently testable
2. Inject a small `buildTimeoutMs` (same seam style as existing `autoApplyTimeoutMs`) so CONTRACT does not wait 120s. Production default remains `BUILD_TIMEOUT_SAFE` until the matcher is fixed, then a still-finite bound.
3. Call real `submitBuild` (one `authorizeCall()` / `ProviderCallGuard(1)`).
4. **Before matcher fix, expect:** bounded wait expires; function returns `executionId` undefined/null (current catch) **or** — if fail-closed is introduced in the same Step 2 after RED — typed observation error. RED must not inject that error; it must come from the adapter path.
5. Assert execute POST count = 1 and executions collection POST count = 0.
6. No LIVE, no staging, no provider, no credits.

Do not stub `submitBuild`. Do not put `executionId` into the runner by hand.

---

## 15. Smallest safe Step 2 design (do not implement now)

1. Observe `POST /api/ai/execute` with pathname `/\/api\/ai\/execute\/?$/` (not a prefix that matches `executions`).
2. Keep arming `waitForResponse` immediately before the Send click.
3. Parse `executionId` from the 202 JSON (`executionId` field; keep `id` only as a non-authoritative fallback if needed for old fixtures, but the RED/green fixture must use the real `executionId` field).
4. Require a non-empty string; on timeout / non-2xx / missing ID raise a typed `BuildExecutionObservationError` **inside** `runGoldenPath` (fail-closed). Remove the empty `catch` that returns `undefined`.
5. Return that ID from `submitBuild`. Remove the useless 120s wait for a request that never occurs — **as part of observing the real request**, not by shrinking a wrong matcher.
6. Do not `route()`/fulfill execute. Do not read SSE bodies.
7. Do not change phase order, product source, AUTO-01G file-write observation, SSH, traces, or `selectOption` fallbacks.
8. Preserve one Send click and `ProviderCallGuard(1)`.
9. CONTRACT: RED then green; keep the 88 AUTO-01G tests green; add tests for execute-only success, missing execute fail-closed, `executions` collection POST must not be required, matcher must not treat `/api/ai/executions…` as execute.

Expected Step 2 files (automation only):

- `e2e/builder-golden-path/lib/live-adapters.ts`
- `e2e/builder-golden-path/lib/local-fixture.ts`
- `e2e/builder-golden-path/tests/live-adapters.spec.ts`
- `e2e/builder-golden-path/lib/network.ts` only if a tiny shared URL helper/typed error is extracted
- `e2e/builder-golden-path/lib/constants.ts` only if a named bound constant is required

No product source. No `package.json` / lockfile.

---

## 16. Remaining uncertainty

- Playwright-core type docs are not vendored in this workspace; safety of `response.json()` on the **execute JSON** is inferred from Playwright's buffered Network copy plus the in-repo confirm/session observers. SSE non-consumption is independently proven by source (different URL, `@Sse`).
- After BUILD returns on 202, `tokensUsed` is not yet on the status GET; frozen later phases cover that. Not a Step 2 DEDUCTION rewrite.
- Execute response headers were not observed on staging in this Step 1 (no LIVE). Controller return type/body do not set an `executionId` header. Unlikely; Option 1 does not need headers.
- Orchestration remains default-off; a future enabled orchestration would POST execute **per step**. Out of scope; LIVE-06 was one call.

---

## 17. Activity ledger (Step 1)

```
LIVE_RUNS=0
SSH_CONNECTIONS=0
STAGING_ACCESS=0
PROVIDER_CALLS=0
CREDITS=0
GATE_MUTATION=0
PRODUCT_SOURCE_WRITES=0
AUTOMATION_IMPLEMENTATION_WRITES=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
```

---

## 18. Step 1 terminal state / blocker before Step 2

Step 1 COMPLETE. Root cause PROVEN. Step 2 is **not** authorized by this write.

Blocker before Step 2: explicit Keith authorization for the bounded automation-only fix + CONTRACT RED/green. No LIVE, SSH, staging, provider, credit, or gate activity in Step 2.

```
PRODUCT_CHANGES_REQUIRED=NO
PHASE_ORDER_CHANGES_REQUIRED=NO
ONE_PROVIDER_CALL_SEMANTICS_PRESERVED=YES
CORRECT_EXECUTION_ID_ALONE_UNBLOCKS_EXISTING_DEDUCTION=YES
```

---

*Diagnosis created 2026-08-21 — PRIVATE-BETA-E2E-AUTO-01H Step 1 — GOVERNANCE / INVESTIGATION ONLY — no implementation, no LIVE, no staging/SSH, no provider, no credits, no gate mutation, no Git mutation — REAL BUILD EXECUTION-ID TRANSPORT AND RUNNER OBSERVATION MISMATCH PROVEN*
