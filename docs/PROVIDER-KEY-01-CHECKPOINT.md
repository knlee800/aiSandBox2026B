# PROVIDER-KEY-01 — Checkpoint

**Task:** PROVIDER-KEY-01 — Keyless provider: a safe missing-key message and a working default
**Status:** COMPLETE AND LOCKED — 2026-11-13. Not deployed: STAGING-DEPLOY-PKEY-01.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the HARNESS-FIXES-01C narrowing; Keith asked to start it ("Start PROVIDER-KEY-01") and approved the stage-start ("Yes, approve all three").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission for the stage-start | Lane 1, no mutex, write set the stage-start document | 77f2ca3 |
| 2. Stage-start | docs/PROVIDER-KEY-01-STAGE-START.md, fable subagent (Fable 5.2), fast-forwarded; facts checked against the code by the control plane | 6f1e164, 8e6e64d |
| 3A. Backend slice | AI-SERVICE and GATEWAY; write set widened from 15 to 17 files (b7236ca); opus subagent 7160a29, cherry-picked | 9c4dc79, b7236ca, f4af7ec, d0728ce |
| 3B. Frontend slice | FRONTEND and I18N; opus subagent (the brief chose opus over sonnet for the page.tsx run-completion wiring), fast-forwarded | d0728ce, f5c3428 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Keith's decisions (2026-11-13)

1. "Usable" means the AI service has a key; the provider switch is not part of it.
2. The usage-limit sentence also reaches the workspace chat.
3. Remembering the chosen provider is not part of this task.

Contracts C1 to C4 (stage-start section 3) were frozen for Step 3.

## What changed

**The finding that shaped it:** the gateway status route never returned a stored failure reason (`getExecution` left the DTO's `error` empty). So the chat showed "Execution ended with status: failed." for every failed run, whatever the sanitiser stored. For the same reason, the PROVIDER-LIMIT-MSG-01 sentence had never reached the workspace chat.

**Slice 3A (backend, 17 files):**

- **AI service:**
  - `ProviderKeyMissingError` (new `provider-key-missing.error.ts`) is raised in `getAdapter`, before any adapter is built or any provider is called, through one shared key read (`readProviderKey` / `requireProviderKey`).
  - A warn log names the provider and the variable, never the value.
  - `getProviderKeyAvailability()` uses the same read.
  - The new `GET /api/internal/provider-availability` sits under the global internal-key guard with no exemption, and answers booleans only (C3).
- **Worker:** `resolveStoredExecutionError` checks the error by type (`instanceof`) first and stores C1, `provider_key_missing` / `AI provider is not configured`. The code is added to `knownHarnessMessages`. `looksLikeCredential`, `isUnsafeExecutionErrorText` and the fallback are unchanged.
- **Gateway:**
  - `getExecution` adds `error` for a failed run only through an allow-list with the gateway's own constants (new `execution-error.ts`, C2). The two entries are `provider_key_missing`, and `execution_failed` only with the stored sentence exactly `AI provider usage limit reached`.
  - New `GET /api/ai/providers` (`SessionOrApiKeyAuthGuard`; 401 without identity; 503 'AI providers are unavailable') answers C4 from the AI service. It is parsed strictly, cached 60 seconds, failures are not cached (new `provider-availability.ts`), and the client's 3-second GET never logs the error object.
- **Tests:** five providers × no, empty, blank and non-string key; C1 stored by type; a plain error that mentions a key still stores "This step failed."; both sides of the usage-limit match; the C2 and C4 answers; 401 and 503; the cache; the internal route over real HTTP through the guard.

**Slice 3B (frontend, 12 files):**

- New `lib/ai/provider-availability.ts`: a strict C4 parse into usable ids, or null when unknown.
- `provider-model.catalogue.ts`:
  - **Filter:** `getUsableFrontendProviderEntries` filters the providers by the usable list.
  - **Selection:** `resolveFrontendProviderModelSelectionWithinUsable` keeps a usable choice, otherwise moves to the first usable provider and its default model, and returns null when none is usable. A null list keeps today's behaviour.
- `workspace-quota-usage.logic.ts`: an `errorCode` input, checked first. `provider_key_missing` gives the translated `ai.providerKeyMissing`, never the raw text. `readExecutionStatusError` accepts only `{code, message}` strings.
- `page.tsx`:
  - **The list:** one `/api/ai/providers` fetch after `/api/auth/me`; any failure leaves the list unknown, and the page works as before.
  - **The picker:** offers only usable providers, with the default moved to the first usable one.
  - **Failure sites:** both terminal-failure sites pass `data.error` into the failure copy, so the usage-limit match now fires.
  - **Submit guard:** a guard in `handleSubmitChatPrompt` sends no run when none is usable.
- `workspace-shell.tsx`: with none usable, one disabled `ai.noProviderOption` option, both selects disabled, Send disabled (a new `canSendPrompt`; the pinned `canSubmit` expression unchanged) and the `ai.noProviderAvailable` hint. The four test ids are kept.
- **Translations:** three keys in en, zh-TW and zh-CN, as in the stage-start table: `ai.providerKeyMissing`, `ai.noProviderAvailable`, `ai.noProviderOption`.
- **Design:** the advisory skills impeccable and emil-design-eng and DESIGN.md were read. Applied: no new components, no animation, a native disabled option in the existing hint slot. Their shape and craft gates were not applied, because this is no redesign.

## Control-plane review

- **Slice 3A:** read both services' source diffs.
  - The error is recognised by type.
  - No key value, length, prefix or variable name appears in any answer.
  - The internal route stays behind the internal key.
  - `GET providers` cannot be shadowed: the other GET routes on the controller are `executions` and `executions/:executionId`.
  - HARNESS_ENTITLEMENT_PROOF_V1 is unchanged; the entitlement code appears only in context lines.
- **Write-set widening:** the worker stopped before any edit because two existing tests pin the old behaviour (`__tests__/internal-key.http.spec.ts`, the exact guarded-route list; `ai-execution.phase30c.spec.ts`, the old missing-key sentence). The control plane added them (b7236ca); the stage-start's section 5.1 table had missed them.
- **The changed constructor assertion:** one existing gateway assertion changed because the controller gained a last `@Optional()` parameter (the EntitlementService constructor position test). Reviewed: it follows from the new parameter, with no behaviour change.
- **Slice 3B:** read the page, shell, catalogue and failure-copy diffs; all match section 4 of the stage-start.
- **Mutation checks:** both workers ran them (3A: 6, 3B: 9), and every one made tests fail.
- **Line endings:** the 3A cherry-pick and the 3B fast-forward are LF in the index and the working tree.

| Gate (control-plane rerun) | Baseline | On the branch | On main at f5c3428 |
|---|---|---|---|
| ai-service `npx jest` | 1331 passed, 1 skipped | 1381 passed, 1 skipped (66 suites) | 1381 passed, 1 skipped |
| ai-service `npm run build` | rc 0 | rc 0 | rc 0 |
| api-gateway `npx jest --maxWorkers=2` | 4236 passed, 7 skipped, 14 known smoke.integration failures | 4265 passed, 7 skipped, the same 14 | 4265 passed, 7 skipped, the same 14 |
| api-gateway `npm run build` | rc 0 | rc 0 | rc 0 |
| frontend `npx tsc --noEmit` | rc 0 | rc 0 | rc 0 |
| frontend `npm test` | 1849 / 1849 | 1877 / 1877 | 1877 / 1877 |
| frontend `npm run build` | rc 0 | rc 0 | rc 0; tsconfig.tsbuildinfo restored |

The 14 gateway failures are the known `smoke.integration` suites that need a database (environment, not code).

All worktrees and branches were removed, the junctions were unlinked first, and the main checkout's node_modules is intact.

**Workers' process note:** while its mutation check hung, the 3B worker stopped only its own node and python processes and left two unrelated `tests/db` processes running.

## Not proven here (live)

STAGING-DEPLOY-PKEY-01 will check the real answers from the host and run Keith's short browser check of the picker and the empty state. The translated `provider_key_missing` sentence after a real keyless run needs runs on; tests cover it until then.

**Note, no work:** each adapter's constructor still has its own "API key is required" check, which `getAdapter` now makes unreachable.

## Follow-ups

- **Registered (NOT_READY; OPTIONAL by control-plane default; Keith may change):**
  - STAGING-DEPLOY-PKEY-01: deploy with ACCESS-01J and check;
  - PROVIDER-SWITCH-01: the chat route checks the `AI_PROVIDER` switch, not the chosen provider's; a guard change, 4-step;
  - CHAT-FAILURE-REASONS-01: other failure reasons and the hardcoded English fallback in the chat;
  - PROVIDER-KEY-02: the orchestration-step failure site, the Team page `collaboration.providerKeyMissing` mapping, the stale live-adapter comment;
  - PROVIDER-REMEMBER-01: remember the chosen provider, from Keith's question 3;
  - GOV-ARCH-PKEY-01: an ARCHITECTURE.md note, governance, Keith approves the wording.
- **Superseded:** the two tests missing from the 3A write set (the b7236ca widening); the dead adapter constructor checks (the note above, no work); the submit guard reusing `ai.noProviderAvailable` (acceptance as designed); the changed constructor assertion (the review above).

CHECKLIST: EVERY 11/11 (1: admitted 77f2ca3, 9c4dc79, d0728ce; 2: 4-step with an approved stage-start; 3: fable for the stage-start, opus for both slices, named before dispatch; 4: self-contained briefs, no further subagents; 5: every file inside its slice's write set, 3A widened by the control plane before any edit, no dependency; 6: tests added for each slice; 7: gates rerun by the control plane on the branches and on main; 8: no runtime started; 9: tsconfig.tsbuildinfo restored; 10: worktrees, cherry-pick and fast-forward by the control plane, worktrees and branches removed; 11: FOLLOWUPS line), BACKEND 6/6 (1: no guard, cookie, CSRF or internal-key change; the new routes use the existing guards; 2: the internal route stays under the internal key and is reached only through the gateway client; 3: no generated-app template; 4: C1 to C4 implemented as frozen, HARNESS_ENTITLEMENT_PROOF_V1 unchanged; 5: no entity or schema change; 6: compared with the baselines, no new failure), UI 9/9 (1: three keys in en, zh-TW and zh-CN through the existing hook, tests render all three; 2: I18N held; 3: no icon; 4: both advisory skills read, what was applied stated above; 5: DESIGN.md tokens unchanged; 6: empty and failed states translated and tested, loading and fetch failure behave as before; 7: no redesign, routing, dependency or refactor; 8: the four test ids kept and tested; 9: live browser check in STAGING-DEPLOY-PKEY-01)
FOLLOWUPS: 6 registered (STAGING-DEPLOY-PKEY-01; PROVIDER-SWITCH-01; CHAT-FAILURE-REASONS-01; PROVIDER-KEY-02; PROVIDER-REMEMBER-01; GOV-ARCH-PKEY-01) / 4 superseded (the two tests missing from the 3A write set by b7236ca; the dead adapter constructor checks by the note above; the submit guard reusing ai.noProviderAvailable by acceptance; the changed constructor assertion by the review) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-13 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and I18N released UNOWNED (AI-SERVICE and GATEWAY were released at slice 3A);
- not deployed: staging still runs aa0b32a, with runs off.
