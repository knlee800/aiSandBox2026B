# HARNESS-PROVIDERS-01 — Stage-Start

**Task:** HARNESS-PROVIDERS-01 (Lane 1; AI-SERVICE, GATEWAY, FRONTEND, PACKAGE; LOCAL-TESTS).
**Base commit:** a92ac99d2233159075bef9d4067740624a1b97a6.
**Approved by Keith:** 2026-11-01.
**Limits:** provider facts below were read from provider documentation on 2026-11-01. Implementation uses mocked providers only. Real behaviour is proven later by HARNESS-LIVE-01, and some details below are a best reading where the documentation is silent.

## Provider findings

| Provider | Finding | Source |
|---|---|---|
| Anthropic | Thinking blocks must be passed back complete and unmodified when returning tool results; thinking counts toward `max_tokens` | https://platform.claude.com/docs/en/build-with-claude/thinking |
| OpenAI | `gpt-6.1-sol` lists both endpoints, and "Tool calling requires the Responses API"; the other GPT-6 models are assumed to work the same way | https://developers.openai.com/api/docs/models/gpt-6.1-sol |
| xAI | Responses is the preferred API; function calling chains steps with `previous_response_id` | https://docs.x.ai/docs/guides/chat, https://docs.x.ai/docs/guides/function-calling |
| DeepSeek | Thinking is on by default; with tools, `reasoning_content` must be passed back or the API returns 400 | https://api-docs.deepseek.com/guides/thinking_mode |

## Decisions

1. **Shared provider state.** Add an optional opaque `providerState` to the adapter tool-use result and the canonical assistant turn. The harness loop carries it unchanged between steps. Adapters that do not set it behave as before.
2. **Anthropic.** Return raw assistant content, including thinking blocks, through `providerState`. Output limit 16,000 tokens. Remove `temperature`. Keep SDK 0.32.1 unless it blocks this work; a package change then needs reporting at review.
3. **OpenAI and xAI.** Tool calls use one shared Responses path, chained with `previous_response_id`. The provider keeps the conversation on its side; this is accepted for one private test project and is to be revisited before any other user's code goes through the platform. The plain path stays on Chat Completions. For GPT-6 models it sends `max_completion_tokens` and omits `temperature`. `gpt-4o` is unchanged.
4. **DeepSeek.** Tool calls on Chat Completions with `reasoning_content` passed back through `providerState`.
5. **Catalogues last.** `supportsToolUse` becomes true only in the final slice, in all three copies, so no provider is marked ready early. Groq is not changed.

## Slices

Each slice: Cursor CLI on `grok-4.7-high`, reviewer rereads the diff and reruns the gates, Keith approves each commit.

1. Shared provider state and Anthropic.
2. OpenAI and xAI on the shared Responses path.
3. DeepSeek.
4. Catalogues in all three copies.

The write scope registered in `TASKS_BACKLOG_FULL.md` covers all of this. The worker, the gateway controller and the frozen HARNESS_ENTITLEMENT_PROOF_V1 are not touched.
