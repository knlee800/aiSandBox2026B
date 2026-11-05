# LIMIT-MESSAGE-01 — Checkpoint

**Task:** LIMIT-MESSAGE-01 — Show the real reason when a run is refused by a limit
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT.
**Source:** registered by ACCESS-LIVE-01 (check 3 showed the generic 429 text). Keith approved the scope and the message table and admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with the ACCESS-LIVE-01 lock | 942dcec19e43529270673fa5b5826e2ace36fcbb |
| 1b. Admission | Lane 1 with FRONTEND and I18N (applied in the same Cursor run as Part A, committed alone) | c400f75b1721e9673f45bb5024cf009248a5199b |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

Cursor runs: 61ed4dac-b276-4428-91ec-eaa70b5cf665 stopped at Part A's dry run (MALFORMED: the sidecar write path frontend/app/[locale]/app/page.tsx has square brackets, which the validator refuses; the record was regenerated with frontend/app/ and nothing was applied); d017e057-3be9-4c0c-b6cd-ecd9dc4ca371 applied the admission and implemented, then a delta in the same session fixed two review findings.

## What changed

- frontend/components/workspace/workspace-quota-usage.logic.ts: a 429 is mapped from the response body: cap user gives the own daily-credit message, cap platform the platform message, details.quota_type max_tokens_per_24h the daily token message with the reset time in the page locale (or "try again tomorrow"), a 429 whose message names a quota or usage limit the quota message, otherwise the per-minute message with Retry-After seconds or "shortly". All texts are passed in as translated copies; the hardcoded English is gone.
- frontend/components/workspace/workspace-credit-error.logic.ts: a 402 with required_credits gives "This run needs {required} credits, and you have {count}."; other 402s keep their copies.
- frontend/app/[locale]/app/page.tsx: the two execute-error paths pass the parsed body, the locale and the copies; other callers pass the copies.
- frontend/lib/collaboration/logic.ts and frontend/components/collaboration/collaboration-page.tsx: a credit-cap 429 is the new dailyCredits refusal with its own message.
- Ten new keys in en.json, zh-TW.json and zh-CN.json (ai.dailyCreditLimitOwn, ai.dailyCreditLimitPlatform, ai.dailyTokenLimitWithTime, ai.dailyTokenLimitTomorrow, ai.creditInsufficientForRun, ai.rateLimitRetrySeconds, ai.rateLimitRetryShortly, ai.quotaLimitGuidance, ai.accessRulesGuidance, collaboration.refusalDailyCredits). Tests for each body variant, the collaboration mapping and the keys in all three files.

**Review findings fixed before LOCK:** (1) the first version sent every other 429 to the rate-limit copy, so a 429 naming a quota (other quota guards) lost the quota message; the quota check is back in the 429 branch with a test. (2) Four keys per language used 信用額度 / 信用额度 and 代幣 / 令牌; they now use the existing terms 點數 / 点数 for credits and "token" for AI tokens.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx tsx --test` (quota, credit-error and collaboration logic tests) | 54 passed, 0 failed |
| frontend `npm test` | 856 passed, 0 failed (baseline 836 before LIMIT-MESSAGE-01's tests and earlier additions) |
| frontend `npm run build` | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | only files in the admitted write scope changed; no gateway change |

Evidence in `C:/Users/knlee/aisb-preflight/LIMIT-MESSAGE-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-lm-delta.txt` | 2927 | `cc03a0e21fa9f4e846dab867fe6b0069f89795c45161692c48c8fd831b99fc21` |
| `brief-lm.txt` | 6355 | `a6979e20edf788a96c29cd4b6834458601c5a7e8532455cb5321e7bb9638508e` |
| `cursor-result-1.json` | 4995 | `cc1902b80f6805d3a6ac0965f6a8e8ceb38af50e261579a0aa9b98ec52f4e85a` |
| `cursor-result-2.json` | 11105 | `e7ef9af7c53ae903c5111ee8fb84faec15e39501019e098deb21d459c31f847e` |
| `cursor-result-3.json` | 2565 | `f9e9f202ec9c4f996af0015c29110f470efed4944733798ee542b23a7e6d37d3` |
| `reviewer-build.log` | 3108 | `81604c1db018cef40b7f2707e74512c4bbb2fe605f3f6fcd76a25bf0b1d1a2b6` |

## Acceptance criteria

All eight met by diff review and the reviewer run; no browser check, as approved (the messages appear only during a live window; the tests cover each body). Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not deployed; the next staging deploy brings it.
- The reset time is shown in the browser's own time zone; the two daily-credit messages state midnight UTC.
- Collaboration uses the own-limit wording for both cap values.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED.
