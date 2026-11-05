# ACCESS-01C — Stage-start

## 1. Scope and non-goals

The gateway gives every Agent run (`harnessVersion: 'v1'` on `POST /api/ai/execute`) a signed tool profile chosen from `user_entitlements.agent_write_enabled`; the worker refuses a v1 job without a valid signed profile and registers write tools only when the profile is the Agent write profile and `AGENT_HARNESS_ENABLE_WRITE_TOOLS` is on. Non-goals: collaboration hand-off profiles (unchanged), `/api/auth/me`, any frontend or i18n, API-key entitlement, the proof wire format, builder-profile adapter, migrations, `knowledgeScopes` (KNOW-02).

## 2. Current state

| Fact | Citation |
|---|---|
| Agent mode sends `executionIntent: 'conversation', harnessVersion: 'v1'`; nothing else harness-related | `frontend/components/workspace/workspace-agent-mode.logic.ts:75-83` |
| Gateway validates `harnessVersion`, requires `identity.harnessEntitled === true`, captures the HMAC secret before side effects | `services/api-gateway/src/ai/ai-execution.controller.ts:739-760` |
| Job payload is built from named fields only; `harnessVersion`, `agentRole`, `builderProfileId` are copied from the request body; no `harnessToolProfile` or `harnessReadOnly` is ever set for Agent runs | `ai-execution.controller.ts:951-973` |
| Proof = `createHarnessEntitlementProof({executionId,userId,apiKeyId,issuedAt,payloadWithoutProof: payload,secret})`, then `enqueueExecution({...payload, harnessEntitlementProof})` | `ai-execution.controller.ts:975-1001` |
| Proof fields: `version:1, executionId, userId, apiKeyId, harnessVersion:'v1', issuedAt, payloadDigest, signature`; claim string `v=1\|executionId\|userId\|apiKeyId\|harnessVersion=v1\|issuedAt\|payloadDigest` | gateway `:67-76, 111-123, 137-163`; worker `job.types.ts:34-43`, `worker.processor.ts:413` |
| Digest covers **every job key except `harnessEntitlementProof`** (sorted-key canonical JSON, SHA-256). `harnessToolProfile`, `harnessReadOnly`, `harnessVersion`, `agentRole`, `builderProfileId` are therefore already covered when present | `worker.processor.ts:226-269`; gateway `:78-109` |
| Collaboration hand-offs set `{harnessVersion:'v1', harnessToolProfile, harnessReadOnly?:true}` from the target role when `fileAccess` is true, then sign | `orchestration/collaboration-tool-profile.ts:44-73`; `orchestration.service.ts:826-828, 2485-2522` |
| `AIExecutionRequest` has no `harnessToolProfile`/`harnessReadOnly`; the browser cannot set them | `services/api-gateway/src/clients/ai-service-http.client.ts:43-66` |
| `EntitlementService.resolveHarnessEntitled(userId)` reads one column, no row/false/error → false, warn carries only `userId`; `agentWriteEnabled` is stored but unread | `services/api-gateway/src/auth/entitlement.service.ts:46, 63-77` |
| `AuthModule` exports `EntitlementService`; `AIModule` imports `AuthModule` | `auth/auth.module.ts:85-87`; `ai/ai.module.ts:44-45` |
| Worker: proof verified at `:1586-1617`, then `resolveHarnessToolProfile` at `:1618-1630` (undefined profile → `ok, profile:null`; non-v1 with profile → invalid; not read/review/write → invalid; `harnessReadOnly` true with non-read → conflict) | `worker.processor.ts:535-577` |
| `signedToolProfile === 'write' && !resolvedConfig.enableWriteTools` → stored failure `harness_write_tools_disabled`; review/write with validation off → `harness_validation_tools_disabled` | `worker.processor.ts:1706-1736` |
| Profile `null` (today's Agent run) and `harnessReadOnly` false: write_file, delete_file, run_validation, browser_smoke (each behind its flag), file actions kept; profile `'write'` gets no delete_file and no browser_smoke | `worker.processor.ts:1802-1920, 2065-2069`; spec `worker.processor.spec.ts:5734-5788` |
| `enableWriteTools` is a strict-boolean env flag defaulting false; `resolveBuilderHarnessConfig` can merge `enableWriteTools` from a builder harness profile, but the only registered profile (`builder-default`) has no `harnessProfile`, so `resolvedConfig.enableWriteTools` equals the process flag for every job today | `agent-harness.config.ts:49-53, 101-102`; `builder-harness-config-adapter.ts:25-47, 115-117`; `builder-profile.registry.ts:15` |

## 3. Contract change: HARNESS_ENTITLEMENT_PROOF_V1

**No wire-format change.** The proof object, claim string, `version: 1`, canonicalisation and digest coverage stay byte-identical, because the digest already covers every payload key; a changed or removed profile already fails `HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH`. The change is to the signed payload's **semantics**:

| Aspect | Before | After |
|---|---|---|
| `AiExecutionJob.harnessToolProfile` type | `'read' \| 'review' \| 'write'` | `'read' \| 'review' \| 'write' \| 'agent-write'` (value name: Decision 1) |
| Presence on v1 jobs | Optional; absent on Agent jobs ("Absent on agent-mode jobs", `job.types.ts:74-78`) | **Required on every v1 job.** Gateway sets it for Agent runs; orchestration already sets it for hand-offs |
| `harnessReadOnly` on Agent jobs | absent | still absent (every worker branch keyed on it is already decided by a non-null profile; see §5) |
| Proof version | 1 | 1 (no bump: no new proof field, no new claim element) |
| Worker on v1 job without profile | Agent run with full tools | fail closed `harness_tool_profile_missing` |

Files under the contract id that change: `ai-execution.controller.ts` (sets the field), `job.types.ts` (union and comment), `worker.processor.ts` (rules). Re-freeze at LOCK. KNOW-02 later adds `knowledgeScopes` under its own contract-change protocol; nothing here anticipates it.

## 4. Gateway

- `EntitlementService` gains `resolveAgentWriteEnabled(userId: string): Promise<boolean>`: `findOne({where:{userId}, select:['agentWriteEnabled']})`; no row, false row, or thrown error → `false`; error path `logger.warn(userId)` only. Same shape as `resolveHarnessEntitled`.
- `AIExecutionController` constructor gains a last parameter `@Optional() private readonly entitlementService?: EntitlementService`. Optional because 13 constructions in `ai-execution.controller.spec.ts` and 13 in `__tests__/ai-execution.workspace-context.spec.ts` are positional; absent service → `false` → read profile (fail closed). A wiring test asserts `AIModule` resolves it from `AuthModule`.
- In `execute()`, directly after the secret capture (`:750-760`, so before the ledger intent write): `const harnessToolProfile = request.harnessVersion === 'v1' ? ((await this.entitlementService?.resolveAgentWriteEnabled(identity.userId)) === true ? 'agent-write' : 'read') : undefined;`. Harness entitlement is already enforced at `:746`, so "write only when harness-entitled and agent_write_enabled" holds by construction.
- Payload (`:967`) adds `...(harnessToolProfile !== undefined && { harnessToolProfile })`. No `harnessReadOnly`. The existing `createHarnessEntitlementProof` call signs the payload unchanged, so the profile is covered by `payloadDigest`.
- Body-supplied `harnessToolProfile`/`harnessReadOnly` remain ignored because the payload is built from named fields.

## 5. Worker

Rule for Agent runs (harness branch, after proof verification): write tools register only when `signedToolProfile === 'agent-write'` **and** `enableWriteTools` is true. Outcomes:

| Job | Result |
|---|---|
| v1, no `harnessToolProfile` | `resolveHarnessToolProfile` returns `ok:false, code: HARNESS_TOOL_PROFILE_MISSING ('harness_tool_profile_missing')`, message "No tool profile was signed for this run, so it was stopped."; stored via `persistStoredExecutionFailure` (`:1619-1630`); add to `knownHarnessMessages` (`:615-643`) |
| v1, profile not in the four values | existing `harness_tool_profile_invalid` (message text extended to name `agent-write`) |
| profile changed after signing, or proof forged | existing `PAYLOAD_INTEGRITY_MISMATCH` / `INVALID_SIGNATURE` at `:1586-1617`, before profile resolution |
| `agent-write` with flag off | `harness_write_tools_disabled` (extend `:1706-1709` to `'write' \|\| 'agent-write'`) |
| `agent-write` with flag on | same tools as today's null profile: write_file, delete_file, run_validation (if validation flag), browser_smoke (if its flag), file actions kept, no `harnessChangedPaths`/`harnessValidationRuns` metadata |
| `read` | read_file, list_files, search_workspace only; file actions `[]` (`:2065-2069` already) |
| non-v1 job | unchanged plain path (`resolveHarnessToolProfile` still returns `profile:null`) |

Code points: `resolveHarnessToolProfile` (`:535-577`) adds the missing-on-v1 branch and `'agent-write'`; `allowHarnessMutation` (`:1803-1805`) becomes `'write' || 'agent-write'`; `browser_smoke` condition (`:1882`) `signedToolProfile === null` → `=== 'agent-write'`; `selectAdvertisedAgentHarnessTools` (`:1900-1918`) treats `agent-write` as `resolvedConfig.enableWriteTools/enableValidationTools/enableBrowserSmoke`; `effectiveFileActions` (`:2066-2067`) keeps actions for `'write'` and `'agent-write'`. The validation gate (`:1721-1736`) stays review/write only, so an Agent run with validation off runs without `run_validation` as today. Builder-config resolution is untouched.

Collaboration unchanged: hand-off jobs carry `read`/`review`/`write` with `harnessReadOnly` from `collaborationHarnessJobFields`; none of the branches for those three values change, and the COLLAB-WRITE-01 specs (`:5428-5733`) must pass unmodified.

## 6. Deployment and compatibility

- Gateway and AI service deploy together. Every mixed state fails closed: old gateway → new worker: Agent jobs lack a profile → `harness_tool_profile_missing`, no writes; new gateway → old worker: `agent-write` is `harness_tool_profile_invalid`, no writes; collaboration jobs are unaffected in both.
- Queued Agent jobs at deploy time are refused with a readable stored reason. Recommended: stop the gateway, let the worker drain, restart both (Decision 2).
- After deploy, Agent mode is **read-only for everyone** until `PATCH /api/admin/users/<id>/entitlements {agentWriteEnabled:true, reason}` is called for Keith's row; `AGENT_HARNESS_ENABLE_WRITE_TOOLS` must remain `true` on the worker.
- Rollback: revert both services together; queued `agent-write` jobs fail closed on the old worker.

## 7. Tests per acceptance criterion

| AC | Tests | Spec file |
|---|---|---|
| Gateway signs profile | entitled + `agentWriteEnabled` true → payload `harnessToolProfile:'agent-write'`; false, no row, repository throws, service absent → `'read'`; no `harnessVersion` → no field; body `harnessToolProfile:'agent-write'` ignored; `harnessReadOnly` absent; proof recomputed from captured payload matches, and a payload with the profile flipped fails `verifyHarnessEntitlementProof`-style recompute; wiring test for `AIModule` | `services/api-gateway/src/ai/ai-execution.controller.spec.ts` (new ACCESS-01C describe; adjust existing payload-equality assertions that now see the field) |
| `resolveAgentWriteEnabled` | selects only `agentWriteEnabled`; true row → true; false row/no row → false; throws → false and `warn(userId)` | `services/api-gateway/src/auth/entitlement.service.spec.ts` |
| Worker write rule | `agent-write` + flag on → full Agent tool set and delete allowed; `agent-write` + flag off → `harness_write_tools_disabled`, no provider call; `read` → read tools only, write_file "No handler registered" | `services/ai-service/src/worker/worker.processor.spec.ts` (new describe, reusing `runProfile`/`withHarnessProof`) |
| Missing or changed profile | v1 without profile → `harness_tool_profile_missing` stored failure, no provider call; profile `read`→`agent-write` after signing → integrity mismatch; `agent-write` with `harnessReadOnly:true` → conflict; `agent-write` on non-v1 → invalid | same file |
| Collaboration unchanged | COLLAB-WRITE-01 and COLLAB-FILES-01 describes pass unmodified | same file (`:4834-5789`) |
| Type | `AiExecutionJob` accepts `'agent-write'` | `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` |
| Fixture migration | every existing v1 job fixture that runs the harness without a profile (e.g. `:5121`, `:5734`, HARNESS-SAVE-01, HARNESS-FAIL-RECORD-01, HARNESS-PROGRESS-01, RUN-ERROR-01 harness cases, 01C5B2 Cycle C) adds `harnessToolProfile:'agent-write'` before signing, or asserts the new refusal | same file |
| Builds | gateway and AI-service `npm test` / `npm run build` against baselines (gateway: 14 known runtime-only smoke.integration failures) | — |

## 8. Risks

| Risk | Handling |
|---|---|
| Large fixture churn in `worker.processor.spec.ts` hides a behavioural regression | COLLAB specs must pass byte-unchanged; new describe asserts the exact advertised set for `agent-write` equals the former null-profile set (`:5771-5778`) |
| Builder harness profile could set `enableWriteTools:true` when the env flag is off | No registered profile has a `harnessProfile`; adapter is out of scope; follow-up 2 |
| DI omission makes Agent mode silently read-only | fail closed by design; wiring test; staging check after deploy |
| Keith locked out of Agent writes after deploy | §6 operational step recorded in checkpoint |
| In-flight jobs at deploy | drain before restart (Decision 2) |
| Digest coverage assumption | already proven by `:2687` "canonicalizes the complete job payload excluding only harnessEntitlementProof" and `:5558` |

## 9. Decisions for Keith

1. **Profile value for Agent writes — recommend `agent-write`.** Reusing `'write'` would strip delete_file and browser_smoke from Agent mode (`:1834, 1882`) and change HARNESS-DELETE-01 behaviour; `agent-write` keeps Agent mode's tool set and keeps the collaboration writer "never delete". The plan (§3 item 3) already names `agent-write`. The AC's "signed profile is write" is read as "the Agent write profile".
2. **Deploy with a drained queue — recommend yes.** Alternative: accept that queued Agent jobs fail with `harness_tool_profile_missing`.
3. **`/me` exposing `agentWriteEnabled` and a read-only notice in Agent mode — recommend a registered follow-up**, not a widening (auth controller and frontend are outside the write scope).

## 10. Follow-ups

| Follow-up | Disposition |
|---|---|
| `/me` returns `agentWriteEnabled`; Agent-mode UI says file changes are off for this account (en/zh-TW/zh-CN) — inherited from ACCESS-01B | Register `AGENT-WRITE-UI-01`, NOT_READY; ready when ACCESS-01C is LOCKED and Keith admits; Keith names saturationClass; productClass CURRENT |
| Builder harness profile can override `enableWriteTools` (`builder-harness-config-adapter.ts:38`); the flag is not a platform veto like `allowArbitraryShell` | Register `HARNESS-WRITE-VETO-01`, NOT_READY; ready when any builder profile defines a `harnessProfile` or Keith asks; Keith names saturationClass |
| Set `agentWriteEnabled:true` on Keith's row after deploy | Superseded by the next STAGING-DEPLOY task's deploy checklist (control plane adds the criterion at registration); recorded in the ACCESS-01C checkpoint until then |
| `HARNESS_WRITE_TOOLS_DISABLED_MESSAGE` says "writer step" for Agent runs | Drop: stored failure text, accurate in substance; worker messages are not i18n product copy |
| KNOW-02 also mutates the contract | Superseded by KNOW-02's own admission under the contract-change protocol after this task re-freezes |

`FOLLOWUPS: 2 registered / 2 superseded / 1 dropped / 0 undisposed` (proposed; Keith confirms the drop).

---

**Files read**

- `TASKS_BACKLOG_FULL.md` (ACCESS-01C, KNOW-02 bodies)
- `docs/ACCESS-READY-01-PLAN.md` §3, §8, §9, reviewer notes; `docs/ACCESS-01B-STAGE-START.md` (grep: entitlements, service, follow-ups)
- `docs/control-plane/lane-saturation-state.json` (contract entry, ACCESS-01C candidate)
- `services/api-gateway/src/ai/ai-execution.controller.ts` (60-180, 226-241, 480-540, 600-770, 930-1040); `ai/ai.module.ts`; `ai/ai-execution.controller.spec.ts` (grep); `__tests__/` listing
- `services/api-gateway/src/auth/entitlement.service.ts`, `entitlement.service.spec.ts` (grep), `auth.module.ts` (grep)
- `services/api-gateway/src/orchestration/collaboration-tool-profile.ts`; `orchestration.service.ts` (805-850, 2470-2535); `internal-collaboration.controller.spec.ts` (grep)
- `services/api-gateway/src/clients/ai-service-http.client.ts` (43-66)
- `services/ai-service/src/queue/job.types.ts`; `worker/worker.processor.ts` (225-585, 612-652, 1570-1930, 2055-2080); `worker/worker.processor.spec.ts` (describe/it index; 1905-1940, 5428-5470, 5734-5789); `worker/__tests__/` listing and builder-config spec index
- `services/ai-service/src/agent-harness/config/agent-harness.config.ts`; `builder-profiles/builder-harness-config-adapter.ts`; `builder-profile.registry.ts` (grep)
- `frontend/components/workspace/workspace-agent-mode.logic.ts` (60-97)

**Assumptions**

- `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true` on the staging worker today (not verified; env not read).
- `withHarnessProof` / `runProfile` helpers in `worker.processor.spec.ts` sign the job as given, so adding `harnessToolProfile` to a fixture before signing yields a valid proof (inferred from `:5756-5760`, helper bodies not read).
- Existing gateway specs that assert the full queued payload with `toEqual` will need the new field; which ones was not enumerated.
- No ledger, metrics or stream consumer keys on the literal set `'read' | 'review' | 'write'` outside the files cited (grep over `services/api-gateway/src` found only orchestration files and specs).

---

## Control-plane review and Keith's decisions (binding; these override the sections above where they differ)

Drafted by Fable 5.1 (requested claude-fable-5-1-thinking-high, resolved "Claude Fable 5.1 300K High") through Cursor in read-only mode. The control plane checked against the code: the payload digest covers every job key except harnessEntitlementProof (worker.processor.ts copyJobPayloadWithoutProof, lines 226-235), so a gateway-set harnessToolProfile is signed without a wire-format change; the collaboration write profile registers no delete_file (line 1834) and browser_smoke registers only for a null profile (line 1882), which is why Agent runs need their own value; no registered builder profile defines a harnessProfile.

**Correction — the staging write flag.** Assumption 1 is wrong: AGENT_HARNESS_ENABLE_WRITE_TOOLS is false on the staging baseline and is set true only inside live windows (STAGING-DEPLOY-04 evidence: BEFORE false, window true). After this task, Agent writes on staging need both Keith's agentWriteEnabled row and a live window; section 6's "must remain true" applies to live windows only.

**Keith's decisions, 2026-11-05:**

1. The Agent write profile value is `agent-write`. Acceptance criteria that say "signed profile is write" mean the Agent write profile `agent-write`; the collaboration `write` profile keeps its current behaviour.
2. Deploy with a drained queue: the staging deploy checks that no executions are active before it starts.
3. The /me field and the read-only notice in Agent mode are a separate follow-up, not part of this task.

**Follow-up dispositions (replace section 10):**

| Follow-up | Disposition |
|---|---|
| AGENT-WRITE-UI-01: /me returns agentWriteEnabled; Agent mode says file changes are off for this account (en, zh-TW, zh-CN) | Register at this task's LOCK, NOT_READY, ready when ACCESS-01C is LOCKED and Keith admits it; saturationClass OPTIONAL; productClass CURRENT |
| HARNESS-WRITE-VETO-01: a builder harness profile can override enableWriteTools | Register at this task's LOCK, NOT_READY, ready when a builder profile defines a harnessProfile or Keith asks; saturationClass OPTIONAL |
| Setting agentWriteEnabled true on Keith's staging row after deploy | Superseded by the next STAGING-DEPLOY task's checklist |
| HARNESS_WRITE_TOOLS_DISABLED_MESSAGE says "writer step" for Agent runs | Dropped by Keith 2026-11-05: internal stored failure text, not translated product copy |
| KNOW-02 also changes HARNESS_ENTITLEMENT_PROOF_V1 | Superseded by KNOW-02's own admission under the contract-change protocol after this task re-freezes the contract |

**Clarification — four test fixtures (Keith, 2026-11-05).** Section 7 says the COLLAB-FILES-01 and COLLAB-WRITE-01 describes pass unmodified, but four cases inside them sign a v1 job without a profile, which is the old Agent-mode shape, not a real hand-off (hand-offs always carry a profile, or no harness when file access is off: collaboration-tool-profile.ts collaborationHarnessJobFields; orchestration.service.ts lines 826-828). Keith allowed exactly these edits in services/ai-service/src/worker/worker.processor.spec.ts: the case at about line 5017 adds harnessToolProfile 'read'; the case at about line 5121 adds 'agent-write'; the case at about line 5219 adds 'read' so the same refusals are still tested; the case at about line 5734 sets 'agent-write' and its no-profile assertion expects 'agent-write'. Their tool expectations stay the same. The collaboration-profile cases (read, review and write through runProfile, about lines 5428-5732) stay unedited.
