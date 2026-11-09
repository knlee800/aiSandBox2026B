# HARNESS-FIXES-01B — Checkpoint

**Task:** HARNESS-FIXES-01B — Harness fixes in ai-service: xAI wording, output limits, unanswered tool calls, .env offer
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** split from HARNESS-FIXES-01 (items 2, 3, 4 and 7) and admitted to Lane 2 by Keith in d54a979c80690c5c1e29c662cbd686fa1f57b4fc. Code and LOCK in one record (GOV-OS-04, LOCAL-TESTS). Plan: docs/AGENT-OPS-PLAN.md section 0 item 16.

## What changed

| Item | Cause | Fix | Tests |
|---|---|---|---|
| 2. xAI tool failures used OpenAI's wording | parseResponsesToolUseResponse always said "Malformed OpenAI response", and xAI shares it | The mapper takes the provider name; OpenAI passes OpenAI, xAI passes xAI (adapter-tool-use.mapper.ts, openai-ai.adapter.ts, xai-ai.adapter.ts) | names xAI when a tool response is malformed |
| 3. Plain output limit fixed at 4096 for OpenAI, xAI and DeepSeek | A literal 4096 in each adapter's plain path | resolvePlainOutputTokenLimit in model-profile.registry.ts reads the matching profile's maxOutputTokens, 4096 when no profile matches; the three adapters use it; tool-use limits stay 16000 | uses the model profile plain output limit instead of a fixed 4096 (three adapters); uses the profile maxOutputTokens and 4096 when the profile has none |
| 4. A malformed tool call could go unanswered | With canonicalToolCalls non-empty, a call only on toolCalls was dropped, and a dispatch throw dropped the batch | agent-harness-loop.ts answers every call with an id: error results for malformed and unknown calls and when dispatch throws; a call with no id is still omitted (no invented ids) | answers a malformed call and an unknown call the canonical list omitted; returns an error tool result when dispatch throws so the next request answers the call |
| 7. The model offered to create .env | Nothing in the instructions said .env is refused | New prompts/harness-instructions.ts: "Do not offer to create or edit .env files, because the platform refuses them."; appended to tool-use requests by the OpenAI, xAI, DeepSeek and Anthropic adapters (Anthropic too, since the live offer was on Claude); plain Builder requests unchanged | tells the model not to offer to create or edit .env files; appends that one line to harness instructions and does not repeat it |

Also services/ai-service/src/agent-harness/index.ts exports the new helpers. The frozen HARNESS_ENTITLEMENT_PROOF_V1 files (worker.processor.ts, job.types.ts) are untouched.

**Limit of item 3, stated plainly:** profiles exist only for gpt-4o, grok-3 and deepseek-chat, which are all 4096. The live catalogue models (gpt-6.1-sol, gpt-6-astra, gpt-6.1-terra, gpt-6-luna, grok-4.5, grok-4.7, deepseek-flash, deepseek-v4-pro, deepseek-v4-flash) have no profile, so their plain calls still send 4096 until their limits are recorded. Recording them needs each provider's limit proven live, so it is item 13 of the HARNESS-FIXES-01 umbrella with the live proofs (item 9). Anthropic's 16000 and Groq's plain path are unchanged.

## Gates (rerun by the control plane under Node 22.14.0)

ai-service: 53 suites passed; 1167 passed, 1 skipped, 0 failed (1157 at CONN-01, plus 10). npm run build exit 0. Cursor's run under Node 24.22.1 showed the known better-sqlite3 ABI failures in src/messages/__tests__/messages.service.spec.ts (environmental).

Cursor: grok-4.7-high requested, resolved Grok 4.7 256K High. The run continued after the app restarted; the control plane read its saved final report and diff.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: n/a, no tracked artifact changed), BACKEND 6/6 (1 and 2: auth, guards and internal routes unchanged; 3: n/a, no generated-app templates; 4: frozen contract untouched; 5: n/a, no entity or migration; 6: no new failures against 1157)
FOLLOWUPS: 0 registered / 4 superseded / 0 dropped / 0 undisposed (superseded: live models' output limits, Groq's fixed 4096 and a tool call with no id, as items 13 to 15 of HARNESS-FIXES-01; the .env line in the worker's harness text, by CONN-GRANT-01, which already changes worker.processor.ts)

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 2 released EMPTY; AI-SERVICE released UNOWNED. Not deployed.
